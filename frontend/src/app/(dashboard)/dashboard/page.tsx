'use client';

import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Clock, Activity } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  activeMonitors: number;
  checksToday: number;
  changesDetected: number;
  recentDiffs: any[];
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [statsRes, monitorsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/monitors'),
        ]);
        setStats(statsRes.data);
        setMonitors(monitorsRes.data.monitors || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const quotaUsed = user?.checksUsedThisPeriod ?? 0;
  const quotaLimit = user?.planLimit ?? 500;
  const quotaPercent = Math.min((quotaUsed / quotaLimit) * 100, 100);

  const kpiCards = [
    { label: 'Active monitors', value: stats?.activeMonitors ?? 0 },
    { label: 'Checks today', value: stats?.checksToday ?? 0 },
    { label: 'Changes detected', value: stats?.changesDetected ?? 0 },
    { label: 'Quota used', value: `${Math.round(quotaPercent)}%` },
  ];

  return (
    <div>
      {/* Page head */}
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Dashboard</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">Welcome back, {user?.name}</div>
        </div>
        <Link href="/monitors/new" className="btn accent">
          <Plus className="w-4 h-4" />
          Add monitor
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {kpiCards.map((kpi) => (
              <div key={kpi.label} className="bg-bg-card border border-line rounded-[14px] p-5">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">
                  {kpi.label}
                </div>
                <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Monitor table */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Monitors</h3>
              <span className="text-xs text-ink-4 font-mono">{monitors.length} total</span>
            </div>

            {monitors.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bg-muted mb-4">
                  <Clock className="w-6 h-6 text-ink-4" />
                </div>
                <h3 className="text-[16px] font-semibold mb-2">No monitors yet</h3>
                <p className="text-ink-3 text-[14px] mb-6 max-w-sm mx-auto">
                  Create your first monitor to start tracking website changes.
                </p>
                <Link href="/monitors/new" className="btn accent">
                  <Plus className="w-4 h-4" />
                  Create monitor
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13.5px]">
                  <thead>
                    <tr className="bg-bg-soft text-ink-4 text-[11.5px] uppercase tracking-[0.08em] font-semibold">
                      <th className="px-5 py-2.5">Name / URL</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Frequency</th>
                      <th className="px-5 py-2.5">Last checked</th>
                      <th className="px-5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.slice(0, 10).map((monitor) => (
                      <tr key={monitor.id} className="border-t border-line-soft hover:bg-bg-soft/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">{monitor.name}</div>
                          <div className="text-xs text-ink-4 font-mono truncate max-w-[260px] mt-0.5">{monitor.url}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`pill text-[11px] ${monitor.isActive ? 'live' : 'paused'}`}>
                            <span className="dot" />
                            {monitor.isActive ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-ink-3 font-mono text-xs">
                          {monitor.checkIntervalMinutes >= 60
                            ? `Every ${monitor.checkIntervalMinutes / 60}h`
                            : `Every ${monitor.checkIntervalMinutes}m`}
                        </td>
                        <td className="px-5 py-3.5 text-ink-4 text-xs font-mono">
                          {monitor.lastCheckedAt
                            ? new Date(monitor.lastCheckedAt).toLocaleString()
                            : 'Never'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/monitors/${monitor.id}`}
                            className="text-accent-2 text-xs font-medium hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {monitors.length > 10 && (
              <div className="px-5 py-3 border-t border-line-soft text-center">
                <Link href="/monitors" className="text-accent-2 text-[13px] font-medium hover:underline">
                  View all {monitors.length} monitors →
                </Link>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Recent activity</h3>
            </div>

            {!stats?.recentDiffs || stats.recentDiffs.length === 0 ? (
              <div className="text-center py-12 px-6 text-ink-4 text-[14px]">
                No changes detected yet. Activity will appear here once monitors detect diffs.
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {stats.recentDiffs.map((diff) => (
                  <Link
                    key={diff.id}
                    href={`/monitors/${diff.monitorId}/diffs/${diff.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-soft/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13.5px]">Change detected</div>
                      <div className="text-xs text-ink-4 truncate">{diff.changeSummary}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-ink-3">
                        {new Date(diff.detectedAt).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-ink-4 font-mono mt-0.5">
                        {Number(diff.changePercentage).toFixed(1)}% diff
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
