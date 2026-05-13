import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  real,
  smallint,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Enums ---

export const planEnum = pgEnum('plan', ['free', 'pro']);
export const alertChannelEnum = pgEnum('alert_channel', ['email']);
export const alertStatusEnum = pgEnum('alert_status', ['pending', 'sent', 'failed']);
export const monitorStatusEnum = pgEnum('monitor_status', ['active', 'paused', 'unreachable']);

// --- Users ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  plan: planEnum('plan').notNull().default('free'),
  planLimit: integer('plan_limit').notNull().default(150), // Free: 150, Pro: 36000
  checksUsedThisPeriod: integer('checks_used_this_period').notNull().default(0),
  manualChecksUsedThisPeriod: integer('manual_checks_used_this_period').notNull().default(0),
  periodResetAt: timestamp('period_reset_at', { withTimezone: true }).notNull(),
  preferences: jsonb('preferences').$type<{
    emailNotifications: boolean;
  }>().default({ emailNotifications: true }),
  apiToken: text('api_token'),
  suspended: boolean('suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Sessions ---

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // crypto.randomBytes token
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Monitor groups ---
// A group bundles monitors created together (typically from one site discovery)
// so users can pause/delete/edit-shared-settings on the whole batch.

export const monitorGroups = pgTable('monitor_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  baseUrl: text('base_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_monitor_groups_user').on(table.userId),
]);

// --- Monitors ---

export const monitors = pgTable('monitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Optional group membership — SET NULL on group delete so group cleanup
  // doesn't drop monitors (the group endpoint cascades manually if requested).
  groupId: uuid('group_id')
    .references(() => monitorGroups.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  checkIntervalMinutes: integer('check_interval_minutes').notNull().default(1440), // daily
  isActive: boolean('is_active').notNull().default(true),

  // Phase 2: Element targeting
  cssSelector: text('css_selector'), // nullable — only for Pro users
  exclusionRules: jsonb('exclusion_rules'), // nullable — [{type: 'keyword'|'regex', value: string}]
  threshold: real('threshold').default(0.01), // minimum fraction (0-1) change to trigger alert

  // Tiered fetcher: 1=HTTP, 2=Headless, 3=Stealth. null=auto-detect on first run
  fetcherTier: smallint('fetcher_tier'),
  // Adaptive fingerprint for selector recovery
  elementFingerprint: jsonb('element_fingerprint'),
  // Monitor lifecycle status
  status: monitorStatusEnum('status').notNull().default('active'),

  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_monitors_status').on(table.userId, table.status),
]);

// --- Snapshots ---

export const snapshots = pgTable('snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  monitorId: uuid('monitor_id')
    .notNull()
    .references(() => monitors.id, { onDelete: 'cascade' }),

  // DB-stored content (primary path — file paths kept for legacy/rollback)
  content: text('content'),
  diffHtml: text('diff_html'),

  // File paths (legacy — kept for rollback, will be dropped in Phase 9)
  htmlPath: text('html_path'),
  textPath: text('text_path'),
  screenshotPath: text('screenshot_path'),

  httpStatus: integer('http_status'),
  error: text('error'), // null = success

  // SHA-256 hex of post-exclusion text — for identical-run detection
  contentHash: text('content_hash'),

  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('idx_snapshots_hash').on(table.monitorId, table.contentHash),
]);

// --- Diffs ---

export const diffs = pgTable('diffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  monitorId: uuid('monitor_id')
    .notNull()
    .references(() => monitors.id, { onDelete: 'cascade' }),
  snapshotOldId: uuid('snapshot_old_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),
  snapshotNewId: uuid('snapshot_new_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),

  // File path to diff JSON on disk
  diffPath: text('diff_path').notNull(),

  // Short summary is small enough for DB
  changeSummary: text('change_summary').notNull(),
  changePercentage: real('change_percentage').notNull(),

  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// --- Alerts ---

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  monitorId: uuid('monitor_id')
    .notNull()
    .references(() => monitors.id, { onDelete: 'cascade' }),
  diffId: uuid('diff_id')
    .notNull()
    .references(() => diffs.id, { onDelete: 'cascade' }),

  channel: alertChannelEnum('channel').notNull().default('email'),
  status: alertStatusEnum('status').notNull().default('pending'),

  sentAt: timestamp('sent_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Admin Sessions ---

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(), // crypto.randomBytes(32).toString('hex')
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Admin Config (key-value feature flags + plan overrides) ---

export const adminConfig = pgTable('admin_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  monitors: many(monitors),
  monitorGroups: many(monitorGroups),
  alerts: many(alerts),
}));

export const monitorGroupsRelations = relations(monitorGroups, ({ one, many }) => ({
  user: one(users, { fields: [monitorGroups.userId], references: [users.id] }),
  monitors: many(monitors),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  user: one(users, { fields: [monitors.userId], references: [users.id] }),
  group: one(monitorGroups, { fields: [monitors.groupId], references: [monitorGroups.id] }),
  snapshots: many(snapshots),
  diffs: many(diffs),
  alerts: many(alerts),
}));

export const snapshotsRelations = relations(snapshots, ({ one }) => ({
  monitor: one(monitors, { fields: [snapshots.monitorId], references: [monitors.id] }),
}));

export const diffsRelations = relations(diffs, ({ one }) => ({
  monitor: one(monitors, { fields: [diffs.monitorId], references: [monitors.id] }),
  snapshotOld: one(snapshots, { fields: [diffs.snapshotOldId], references: [snapshots.id] }),
  snapshotNew: one(snapshots, { fields: [diffs.snapshotNewId], references: [snapshots.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
  monitor: one(monitors, { fields: [alerts.monitorId], references: [monitors.id] }),
  diff: one(diffs, { fields: [alerts.diffId], references: [diffs.id] }),
}));

// --- Type Exports ---

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type Diff = typeof diffs.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type MonitorGroup = typeof monitorGroups.$inferSelect;
export type NewMonitorGroup = typeof monitorGroups.$inferInsert;
export type MonitorStatus = 'active' | 'paused' | 'unreachable';
export type AdminSession = typeof adminSessions.$inferSelect;
export type AdminConfig = typeof adminConfig.$inferSelect;
