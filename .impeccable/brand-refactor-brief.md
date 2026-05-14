# SonarDiff — Brand Identity Refactor: Design Brief

**Status:** Confirmed  
**Surfaces:** Landing page · User dashboard · Admin shell  
**Fidelity:** Production-ready, shipped quality  
**Date:** 2026-05-14

---

## Visual Direction Probes (Approved)

Three direction probes were generated and confirmed by the user. Reference images are at:

- `probe-a-landing-hero.png` — Landing: The Signal Room at full Committed-color intensity
- `probe-b-dashboard-monitors.png` — Dashboard: Dense monitor list, committed cyan active state, sweep-implied rows
- `probe-c-admin-overview.png` — Admin: Same dark stack, red topbar border as operator context signal

**Confirmed direction:** All three probes approved. Key callouts carried into implementation:
- Probe B: The persistent cyan glow streaks on rows in the probe are banned. The sweep is an entrance animation only; rows have no glow at rest.
- Probe C: Red 2px bottom border on the admin topbar is the correct operator signal.

---

## 1. Feature Summary

This refactor encodes SonarDiff's visual identity into all three surface families — the marketing landing page, the user-facing dashboard, and the internal admin panel — so the product feels like a specific instrument rather than a generic dark-SaaS template.

The current implementation has four compounding problems:
1. **Banned animations exist in `globals.css` and are actively used** — `fade-in`, `fade-in-up`, `fade-in-blur`, `float`, `reveal` (translateY scroll-reveal) all violate the One Sweep Rule.
2. **The admin shell renders in light mode** — `bg-bg-soft` / `bg-bg-card` resolve to light surfaces. The design intent is dark-first everywhere.
3. **The three surfaces share identical visual language** — no differentiation between landing, dashboard, and admin context.
4. **The Committed color strategy is implemented at 8% opacity** in several active states. The spec requires 15–22%.

---

## 2. Primary User Action Per Surface

| Surface | Primary action |
|---|---|
| **Landing** | Understand the product's value in under 10 seconds and click "Start free trial" |
| **Dashboard** | Arrive after an alert, see what changed, and act — in under 2 minutes |
| **Admin** | Assess platform health at a glance and triage the one degraded signal |

---

## 3. Design Direction

**All three surfaces share the base language:**
- Surface stack: Chrome `#05070A` → Base `#07090C` → Card `#0F172A` → Elevated `#162030`
- Committed Electric Cyan `#06B6D4` at 20–30% visual presence
- Geist Mono for all data values (URLs, counts, percentages, timestamps)
- Clip-path sweep as the only entrance animation

### Landing — "The Transmission"

*A founder opens the URL for the first time at 9pm, deciding in 8 seconds whether this tool is worth their attention. The screen is dark because they are working late. The content — not a colorful illustration — is the evidence.*

- Color: **Committed** — Cyan CTA at 25–30% visual prominence. Radial hero gradient (subtle, top-center, 12% opacity) is the only ambient decoration permitted.
- Differentiation from dashboard: Marketing surfaces get the eyebrow label system, section separators, hero copy hierarchy, and the `frame` browser-mockup component. These don't appear in the product.
- Anchor references: Linear.app marketing page; Vercel deployment dashboard.

### Dashboard — "The Instrument"

*The same founder is back 3 days later because they got an alert. Purposeful, not exploring. Session target: 90 seconds.*

- Color: **Committed** — Active nav item and active row at `rgba(6,182,212,0.15)` minimum. Filter pills active at same. Sweep entrance visible on every list mount. Zero decorative gradients.
- Differentiation from landing: no marketing copy, no section eyebrows, no hero radial gradient. Sidebar always visible. Data density governs layout.
- Anchor references: Linear app list view; Axiom log explorer.

### Admin — "The Control Room"

*An operator checking queue health after a Slack ping. Not a user. Elevated access and risk.*

- Color: **Red-shifted Committed** — Red `#EF4444` replaces cyan as the primary active/accent color within the admin shell. The **2px red bottom border on the topbar** is the single persistent operator context signal. Active nav states use `rgba(239,68,68,0.12)` fill. Cyan still appears for neutral interactive elements (focus rings, non-nav CTAs) but the active state grammar is red.
- Differentiation: Topbar `border-b-2 border-red/60`. "ADMIN" badge chip with red wash. Active nav item red instead of cyan. Same dark surface stack underneath.
- Anchor references: Probe C (approved reference). Stripe Dashboard internal tools.

---

## 4. Scope

- **Fidelity:** Production-ready, shipped quality
- **Breadth:** All three surface families, all pages. Shell components (sidebar, topbar, layout) are the highest priority — inner page components derive from them.
- **Interactivity:** Shipped-quality — sweep animation fires on page mount, active states update on navigation, filter pills update on click.

---

## 5. Layout Strategy

### Landing

- Fixed `max-w-[1160px]` centered container. Section rhythm: `py-24`, `border-t border-white/[0.06]` separators.
- Hero: two-column at ≥768px (headline/CTA left, browser frame mockup right), single column below.
- Features: bordered list block — current `space-y-0 border` approach is correct, keep it.
- Pricing: 3-column grid, Pro card gets `shadow-[0_0_0_1px_rgba(6,182,212,0.2)]` lift with `-translate-y-1.5`.
- **Kill `animate-float`** on the hero frame. Replace with static, grounded placement.
- **Kill `reveal` translateY** scroll animation. Use IntersectionObserver-triggered `.sd-sweep` (clip-path) on section headers and feature rows only. Stagger with `--i` index.

### Dashboard

- Left sidebar: always `248px` on ≥768px. Fixed/sticky, `#05070A`, no top header on desktop.
- Main content: `flex-1`, `overflow-y-auto`, `py-8 px-10`. Max-width `1160px` inner container.
- Page pattern: `<header class="sd-header">` (blur-opacity reveal — persistent chrome, not sweep) + staggered `.sd-sweep` filter pills + list rows with individual sweep stagger `style="--i: N"`.
- **Lists before cards.** Data displayed in rows, not card grids. Cards only for isolated detail views (monitor detail, billing, settings).

### Admin

- Left sidebar: `220px`. Topbar: `48px` with `border-b-2 border-red/60`. Main: `flex-1`, `p-8`, max-width `1280px`.
- More table-dense than dashboard. KPI stat tiles are compact (4 tiles in a single responsive row) — not the hero-metric template.
- Sweep animation on table rows and KPI tiles at mount. Same stagger grammar as dashboard.

---

## 6. Key States

### Landing
| State | Behavior |
|---|---|
| Default | Hero with radial gradient, frame demo cycling (opacity-only transition, no float/scale) |
| Authenticated | Immediate push to `/dashboard` |
| Mobile | Single-column hero, frame below CTA, nav collapses |

### Dashboard — Monitors
| State | Behavior |
|---|---|
| Default | List rows sweep in at mount. Cyan active filter pill. |
| Empty (0 monitors) | Centered message: "No monitors yet." + "Add monitor" accent CTA. No sweep (nothing to sweep). |
| Loading | 3–5 skeleton rows. Opacity-40 surface. No spinner. |
| Error fetch | Inline red dismissable banner above list. List does not disappear. |
| All paused | Amber summary pill in page header: "All monitors paused." |
| Quota exceeded | Amber widget in sidebar. "Add monitor" button disabled with tooltip. |

### Dashboard — Diff Detail
| State | Behavior |
|---|---|
| Default | Before/after diff blocks with `.diff-add` / `.diff-del`. Sweep in on mount. |
| Large diff (>500 tokens) | Collapsed with "Show all" expansion. |
| No change | "No content change detected above threshold." Muted state. |

### Auth (Login / Register)
| State | Behavior |
|---|---|
| Default | Centered single-column form on `#07090C` base. No sidebar. `.dark` class on `<html>`. |
| Error | Red inline message below the field. No toast. |
| Loading submit | Button spinner, disabled, no layout shift. |

### Admin — Overview
| State | Behavior |
|---|---|
| Default | 4 KPI tiles + Queue Health + Recent Alerts sweep in at mount. |
| Queue degraded | Degraded row: `text-red` + `bg-red/[0.08]` row tint. |
| Maintenance active | Red banner in main content, below topbar. |

---

## 7. Interaction Model

### The Clip-Path Sweep (identity entrance grammar)

```css
@keyframes sd-sweep-in {
  from { clip-path: inset(0 100% 0 0); opacity: 0; }
  to   { clip-path: inset(0 0% 0 0); opacity: 1; }
}
.sd-sweep {
  animation: sd-sweep-in 350ms cubic-bezier(0.19, 1, 0.22, 1) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
```

Applied to: monitor rows, alert rows, admin table rows, feature list rows (landing), pricing cards (landing), admin KPI tiles.

**NOT applied to:** sidebar, topbar, page shell, nav items, buttons, inputs.

### Page Header Reveal (blur-opacity, not sweep)

```css
@keyframes sd-header-reveal {
  from { opacity: 0; filter: blur(4px); }
  to   { opacity: 1; filter: blur(0); }
}
.sd-header { animation: sd-header-reveal 400ms cubic-bezier(0.19, 1, 0.22, 1) both; }
```

Applied to: page `<h1>` on route change. One element per page. Not the sweep.

### RTL sweep variant

```css
[dir="rtl"] .sd-sweep {
  animation-name: sd-sweep-in-rtl;
}
@keyframes sd-sweep-in-rtl {
  from { clip-path: inset(0 0 0 100%); opacity: 0; }
  to   { clip-path: inset(0 0 0 0%); opacity: 1; }
}
```

### Hover interactions

- **Buttons:** `translateY(-1px)` 120ms ease-out-expo.
- **Monitor rows:** `background: rgba(255,255,255,0.04)` on hover. Action buttons reveal at `opacity: 1`. No position shift.
- **Nav items:** `background: rgba(255,255,255,0.04)` hover, `color: #CBD5E1`.
- **Admin nav active:** red wash `rgba(239,68,68,0.12)`.

### Focus

All interactive elements: `outline: none; box-shadow: 0 0 0 2px #06B6D4` on focus-visible. Inputs additionally get the accent glow (the One-Glow Rule exception).

---

## 8. Content Requirements

### Microcopy voice guide

- No exclamation points. Ever.
- No "Amazing!" / "You're all set!" / "Woohoo!" confirmations.
- **Successful save:** "Monitor saved." (not "Monitor saved successfully!")
- **Empty states:** Declarative + directional. "No monitors yet. Add one to start tracking." (not "Looks like you haven't set up any monitors yet!")
- **Errors:** Specific. "Could not reach the URL. Check that it's publicly accessible." (not "Something went wrong.")
- **Quota:** Math-first. "412 / 1,200 checks used · resets in 18d."
- **Admin:** Operational only. Status labels. No encouragement copy.

### Dynamic content ranges

| Content | Range | Handling |
|---|---|---|
| Monitor name | 1–80 chars | Truncate with ellipsis |
| URL | 1–200 chars | Geist Mono, always truncate |
| Diff content | 0–50,000+ tokens | Virtualize or paginate at >200 |
| Queue lag | 0–100,000+ jobs | Mono, locale-formatted |

### RTL / Arabic

- Cairo font already loaded.
- Use logical CSS properties (`padding-inline-start` vs `padding-left`) in all new components.
- Sweep direction reverses in RTL (see RTL variant above).

### Image / media roles (all semantic — no raster assets needed)

| Role | Strategy |
|---|---|
| Landing hero browser frame | Semantic HTML/CSS `.frame` component. Already implemented. Keep. |
| Logo | Inline SVG `<Logo>` component. Keep. |
| Status dots | Inline SVG strokes, 16×16, strokeWidth 1.7. Keep. |
| Hero illustrations | None. Not used. |

---

## 9. Design System Deltas

### `globals.css` changes

#### Kill banned animations

Remove entirely:

```css
/* DELETE ALL OF THESE */
@keyframes fade-in { ... }
@keyframes fade-in-up { ... }
@keyframes fade-in-blur { ... }
@keyframes float { ... }
.animate-float { ... }
.reveal { ... }
.reveal.visible { ... }
```

#### Fix `sd-header-reveal` keyframes

Current (wrong — uses translateY):
```css
@keyframes sd-header-reveal {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Replace with:
```css
@keyframes sd-header-reveal {
  from { opacity: 0; filter: blur(4px); }
  to   { opacity: 1; filter: blur(0); }
}
```

#### Fix Committed active state opacity

In `.filter-pill.active`, change:
```css
/* FROM */
background: rgba(6, 182, 212, 0.08);
/* TO */
background: rgba(6, 182, 212, 0.15);
```

#### Add admin surface tokens

```css
@theme {
  --color-sd-admin-border: rgba(239, 68, 68, 0.6);
  --color-sd-admin-active-bg: rgba(239, 68, 68, 0.12);
  --color-sd-admin-active-ink: #EF4444;
}
```

#### Add RTL sweep variant

```css
[dir="rtl"] .sd-sweep {
  animation-name: sd-sweep-in-rtl;
}
@keyframes sd-sweep-in-rtl {
  from { clip-path: inset(0 0 0 100%); opacity: 0; }
  to   { clip-path: inset(0 0 0 0%); opacity: 1; }
}
```

#### Force dark mode baseline

Add to `:root`:
```css
color-scheme: dark;
```

And in `frontend/src/app/layout.tsx`, set `<html lang="en" className="dark">`.

### Component / layout file changes

| File | Current issue | Required change |
|---|---|---|
| `app/layout.tsx` | No `class="dark"` on `<html>` | Add `className="dark"` |
| `(dashboard)/layout.tsx` | Main `bg-background` may resolve to white | Confirmed dark once `<html class="dark">` is set |
| `admin/(admin-shell)/layout.tsx` | Full light mode (`bg-bg-soft`, `bg-bg-card`) | Convert sidebar + main to dark surface stack; add red topbar border |
| `app/page.tsx` (landing) | `animate-float` on frame; `reveal` translateY on sections | Kill float; replace with IntersectionObserver-triggered `.sd-sweep` |
| Admin nav active state | `bg-accent/8 text-accent-2` (cyan) | `bg-sd-admin-active-bg text-sd-admin-active-ink` (red) |

---

## 10. Open Questions

None. All decisions made:

- **Dark mode toggle:** Not building one. `class="dark"` on `<html>` is permanent.
- **Landing frame demo cycling:** Keep opacity-only transition on card swap. No float. No scale. Duration 400ms.
- **Admin active color:** Red. This is the operator context signal. Not configurable.
- **RTL implementation:** CSS-only at the direction-flag level. No JavaScript switching needed.

---

## Recommended References (for implementation agent)

- `design.json` → `components` section: all component CSS specs (buttons, nav items, monitor rows, diff highlights)
- `design.json` → `narrative.rules`: the 9 rules to check against every component
- `design.json` → `motion`: all animation keyframe specs with duration/easing values
- `probe-c-admin-overview.png`: approved reference for admin shell visual treatment
- `probe-b-dashboard-monitors.png`: approved reference for dashboard list + sidebar committed cyan state

---

*Brief confirmed by user on 2026-05-14. Hand to `/impeccable craft` for implementation.*
