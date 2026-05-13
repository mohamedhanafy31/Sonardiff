'use client';

import { useEffect, useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';

type RevenueData = {
  mrr: number; arr: number; totalRevenue: number;
  activeSubscriptions: number; churnRate: number; avgRevenuePerUser: number;
  newSubscriptionsThisMonth: number; cancelledThisMonth: number;
  revenueByMonth: { month: string; mrr: number; newSubs: number; cancelled: number }[];
  planBreakdown: { free: number; pro: number; proRevenue: number };
  topCustomers: unknown[];
  billingConnected: boolean;
};

const COLORS = ['#475569', '#06B6D4'];

function ZeroCard({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="bg-bg-card border border-line rounded-[14px] p-5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-2">{label}</div>
      <div className="font-display text-[26px] font-semibold text-foreground leading-none">$0</div>
      <div className="text-[11.5px] text-ink-5 italic mt-1.5">{sub ?? 'Billing not yet connected'}</div>
    </div>
  );
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<RevenueData>('/revenue').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;
  if (!data) return <div className="text-ink-4">Failed to load revenue data.</div>;

  const planData = [
    { name: 'Free', value: data.planBreakdown.free },
    { name: 'Pro', value: data.planBreakdown.pro },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Revenue</h1>
        <p className="text-ink-4 text-[13.5px] mt-1">Business metrics — connect Stripe to activate live data</p>
      </div>

      {/* Connect Billing CTA — always shown until billing connected */}
      {!data.billingConnected && (
        <div className="bg-accent/6 border border-accent/20 rounded-[14px] p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
            <CreditCard className="w-5 h-5 text-accent-2" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-[14px] mb-1">Revenue tracking is not yet active</h3>
            <p className="text-ink-3 text-[13px] leading-relaxed">
              Connect Stripe to start tracking MRR, ARR, and customer LTV. All cards above will populate automatically.
              Plan distribution (Free vs Pro) uses real data from your users table now.
            </p>
          </div>
          <button disabled title="Coming soon"
            className="shrink-0 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-2 text-[13px] font-medium opacity-50 cursor-not-allowed">
            Connect Stripe
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ZeroCard label="MRR" />
        <ZeroCard label="ARR" />
        <div className="bg-bg-card border border-line rounded-[14px] p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-2">Active Subscriptions</div>
          <div className="font-display text-[26px] font-semibold text-foreground leading-none">{data.planBreakdown.pro}</div>
          <div className="text-[11.5px] text-ink-5 mt-1.5">Pro users (real count)</div>
        </div>
        <ZeroCard label="Total Revenue (All-time)" />
        <div className="bg-bg-card border border-line rounded-[14px] p-5">
          <div className="text-[11px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-2">Churn Rate</div>
          <div className="font-display text-[26px] font-semibold text-foreground leading-none">0%</div>
          <div className="text-[11.5px] text-ink-5 italic mt-1.5">Billing not yet connected</div>
        </div>
        <ZeroCard label="Avg Revenue / User" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-line rounded-[14px] p-6">
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-4">MRR Over Time (12 months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.revenueByMonth}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`$${v ?? 0}`, 'MRR']}
              />
              <Area type="monotone" dataKey="mrr" stroke="#06B6D4" strokeWidth={2} fill="url(#mrrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-center text-[11.5px] text-ink-5 italic mt-2">Live once Stripe is connected</p>
        </div>

        <div className="bg-bg-card border border-line rounded-[14px] p-6">
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-4">Plan Distribution (Real Data)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={planData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {planData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {planData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[12px] text-ink-4">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="font-semibold text-[14px]">Monthly Breakdown</h3>
        </div>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-bg-soft border-b border-line">
            {['Month', 'New Subscriptions', 'Cancellations', 'Net MRR Change', 'Cumulative MRR'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.revenueByMonth.map((r, i) => (
              <tr key={i} className="border-b border-line/40 hover:bg-bg-muted/20">
                <td className="px-4 py-2.5 text-foreground font-medium">{r.month}</td>
                <td className="px-4 py-2.5 text-ink-4">—</td>
                <td className="px-4 py-2.5 text-ink-4">—</td>
                <td className="px-4 py-2.5 text-ink-4">—</td>
                <td className="px-4 py-2.5 text-ink-4 font-mono">$0</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
