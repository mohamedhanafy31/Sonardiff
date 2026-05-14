'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

type Stats = {
  users: { total: number; free: number; pro: number };
  monitors: { active: number; paused: number; unreachable: number; total: number };
  checksToday: number;
  checksTodayVsYesterday: number | null;
  diffsLast24h: number;
  diffsVsPrev24h: number | null;
  alerts: { sent: number; failed: number; pending: number };
  storageBytes: number;
  checksByDay: { day: string; count: number }[];
};

type FailedAlert = {
  id: string;
  userEmail: string;
  monitorName: string;
  error: string | null;
  createdAt: string;
};

type QueueStats = { name: string; waiting: number; active: number; failed: number; isPaused: boolean }[];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-5 text-[12px]">—</span>;
  const up = pct >= 0;
  return (
    <span className={cn('text-[12px] flex items-center gap-0.5', up ? 'text-green' : 'text-red')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failedAlerts, setFailedAlerts] = useState<FailedAlert[]>([]);
  const [queues, setQueues] = useState<QueueStats>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [s, fa, q] = await Promise.all([
        adminApi.get<Stats>('/stats'),
        adminApi.get<FailedAlert[]>('/stats/failed-alerts'),
        adminApi.get<QueueStats>('/queues'),
      ]);
      setStats(s);
      setFailedAlerts(fa);
      setQueues(q);
    } catch { /* redirect handled by adminApi */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const retryAlert = async (id: string) => {
    setRetrying(id);
    try { await adminApi.post(`/alerts/${id}/retry`); await loadData(); }
    finally { setRetrying(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;
  if (!stats) return <div className="text-ink-4">Failed to load stats.</div>;

  const kpiCards = [
    { label: 'Total Users', value: stats.users.total, sub: `Free: ${stats.users.free} / Pro: ${stats.users.pro}`, trend: null },
    { label: 'Active Monitors', value: stats.monitors.active, sub: `Paused: ${stats.monitors.paused} / Unreachable: ${stats.monitors.unreachable}`, trend: null },
    { label: 'Checks Today', value: stats.checksToday.toLocaleString(), sub: 'vs. yesterday', trend: stats.checksTodayVsYesterday },
    { label: 'Diffs Detected (24h)', value: stats.diffsLast24h, sub: 'vs. previous 24h', trend: stats.diffsVsPrev24h },
    { label: 'Alerts Sent (24h)', value: stats.alerts.sent, sub: `Failed: ${stats.alerts.failed}`, trend: null },
    { label: 'Storage Used', value: formatBytes(stats.storageBytes), sub: `${stats.monitors.total} total monitors`, trend: null },
  ];

  const planData = [
    { name: 'Free', value: stats.users.free },
    { name: 'Pro', value: stats.users.pro },
  ];
  const COLORS = ['#475569', '#06B6D4'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Platform Overview</h1>
        <p className="text-ink-4 text-[13.5px] mt-1">Live snapshot of SonarDiff health and activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-bg-card border border-line rounded-[14px] p-5">
            <div className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-2">{card.label}</div>
            <div className="flex items-end gap-2">
              <div className="font-display text-[26px] font-semibold text-foreground leading-none">{card.value}</div>
              {card.trend !== null && <Trend pct={card.trend} />}
            </div>
            <div className="text-[12px] text-ink-5 mt-1.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-bg-card border border-line rounded-[14px] p-5">
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-4">Checks Over Time (7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.checksByDay} barSize={20}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#06B6D4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-bg-card border border-line rounded-[14px] p-5">
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={planData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {planData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Queue health strip */}
      <div>
        <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">Queue Health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {queues.map(q => (
            <Link href="/admin/queues" key={q.name} className="bg-bg-card border border-line rounded-[12px] p-4 hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11.5px] text-ink-3">{q.name.replace('-queue', '')}</span>
                {q.isPaused && <span className="text-[10px] bg-red/15 text-red px-1.5 py-0.5 rounded-full font-medium">PAUSED</span>}
              </div>
              <div className="flex gap-3 text-[12px]">
                <span className={cn('font-medium', q.waiting > 50 ? 'text-yellow-400' : 'text-ink-3')}>W: {q.waiting}</span>
                <span className="text-accent-2 font-medium">A: {q.active}</span>
                <span className={cn('font-medium', q.failed > 0 ? 'text-red' : 'text-ink-4')}>F: {q.failed}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent failed alerts */}
      {failedAlerts.length > 0 && (
        <div>
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">Recent Failed Alerts</h3>
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-bg-soft">
                  <th className="px-4 py-3 text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-4 font-semibold">Monitor</th>
                  <th className="px-4 py-3 text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-4 font-semibold">User</th>
                  <th className="px-4 py-3 text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-4 font-semibold">Error</th>
                  <th className="px-4 py-3 text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-4 font-semibold">When</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {failedAlerts.map(a => (
                  <tr key={a.id} className="border-b border-line/50 hover:bg-bg-muted/30">
                    <td className="px-4 py-3 text-foreground font-medium">{a.monitorName}</td>
                    <td className="px-4 py-3 text-ink-3">{a.userEmail}</td>
                    <td className="px-4 py-3 text-red text-[12px] font-mono max-w-[200px] truncate">{a.error ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-4 text-[12px]">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => retryAlert(a.id)}
                        disabled={retrying === a.id}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-line text-ink-3 text-[12px] hover:bg-bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {retrying === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
