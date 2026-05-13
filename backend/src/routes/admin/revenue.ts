import { Router, type Request, type Response } from 'express';
import { eq, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';

export const adminRevenueRouter: import('express').Router = Router();

// Generate last N months labels
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
  }
  return months;
}

adminRevenueRouter.get('/', async (_req: Request, res: Response) => {
  // Only the plan breakdown uses real DB data; everything else is stub zeros
  const planCounts = await db
    .select({ plan: users.plan, cnt: count() })
    .from(users)
    .groupBy(users.plan);

  const planMap = Object.fromEntries(planCounts.map(r => [r.plan, Number(r.cnt)]));
  const freePlan = planMap.free ?? 0;
  const proPlan = planMap.pro ?? 0;

  const months = lastNMonths(12);

  res.json({
    mrr: 0,
    arr: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    churnRate: 0,
    avgRevenuePerUser: 0,
    newSubscriptionsThisMonth: 0,
    cancelledThisMonth: 0,
    revenueByMonth: months.map(month => ({
      month,
      mrr: 0,
      newSubs: 0,
      cancelled: 0,
    })),
    planBreakdown: {
      free: freePlan,
      pro: proPlan,
      proRevenue: 0,
    },
    topCustomers: [],
    billingConnected: false,
  });
});
