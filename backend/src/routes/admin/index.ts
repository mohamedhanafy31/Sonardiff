import { Router } from 'express';
import { adminAuthRouter } from './auth.js';
import { adminStatsRouter } from './stats.js';
import { adminUsersRouter } from './users.js';
import { adminMonitorsRouter } from './monitors.js';
import { adminQueuesRouter } from './queues.js';
import { adminAlertsRouter } from './alerts.js';
import { adminStorageRouter } from './storage.js';
import { adminConfigRouter } from './config.js';
import { adminRevenueRouter } from './revenue.js';
import { requireAdmin } from '../../middlewares/requireAdmin.js';

export const adminRouter: import('express').Router = Router();

// Auth routes (login/logout/me) — partially public
adminRouter.use('/auth', adminAuthRouter);

// All other admin routes require a valid admin session
adminRouter.use('/stats', requireAdmin, adminStatsRouter);
adminRouter.use('/users', requireAdmin, adminUsersRouter);
adminRouter.use('/monitors', requireAdmin, adminMonitorsRouter);
adminRouter.use('/queues', requireAdmin, adminQueuesRouter);
adminRouter.use('/alerts', requireAdmin, adminAlertsRouter);
adminRouter.use('/storage', requireAdmin, adminStorageRouter);
adminRouter.use('/revenue', requireAdmin, adminRevenueRouter);

// Config has one public sub-route (/config/public) handled inside the router
adminRouter.use('/config', adminConfigRouter);
