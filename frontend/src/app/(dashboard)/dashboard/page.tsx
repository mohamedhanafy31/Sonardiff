'use client';

import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DashboardStats {
  activeMonitors: number;
  checksToday: number;
  changesDetected: number;
  recentDiffs: any[];
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
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

  return (
    <div>
      {/* Header */}
      <div className="sd-header flex justify-between items-end flex-wrap gap-5 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-ink-4 text-[13px] mt-0.5">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Your monitoring summary.'}
          </p>
        </div>
        <Link href="/monitors/new" className="btn accent sm">
          <Plus className="w-3.5 h-3.5" />
          New monitor
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
      ) : (
        <>
          {/* Status strip — not a card grid */}
          <div className="sd-sweep flex flex-wrap items-center gap-px mb-8 rounded-[10px] overflow-hidden border border-white/[0.06] bg-bg-card">
            {[
              { value: stats?.activeMonitors ?? 0, label: 'active monitors' },
              { value: stats?.checksToday ?? 0, label: 'checks today' },
              { value: stats?.changesDetected ?? 0, label: 'changes detected' },
              { value: `${Math.round(quotaPercent)}%`, label: 'quota used' },
            ].map((item, i) => (
              <div
                key={item.label}
                className={cn(
                  'flex-1 min-w-[120px] px-6 py-5',
                  i > 0 && 'border-l border-white/[0.06]'
                )}
              >
                <div className="text-[28px] font-semibold font-display text-foreground leading-none">
                  {item.value}
                </div>
                <div className="text-[12px] text-ink-5 mt-1.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Monitors list */}
          <div className="sd-sweep bg-bg-card border border-line rounded-[12px] overflow-hidden mb-5" style={{ '--i': 1 } as React.CSSProperties}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <h3 className="text-[13.5px] font-semibold text-foreground">Monitors</h3>
              <Link href="/monitors" className="text-[12px] text-accent hover:text-accent-2 transition-colors flex items-center gap-1">
                View all
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {monitors.length === 0 ? (
              <div className="text-center py-14 px-6">
                <h3 className="text-[15px] font-semibold mb-1.5 text-foreground">No monitors yet</h3>
                <p className="text-ink-4 text-[13px] mb-5 max-w-sm mx-auto">
                  Create your first monitor to start tracking website changes.
                </p>
                <Link href="/monitors/new" className="btn accent sm">
                  <Plus className="w-3.5 h-3.5" />
                  Create monitor
                </Link>
              </div>
            ) : (
              <div>
                {monitors.slice(0, 8).map((monitor) => (
                  <Link
                    key={monitor.id}
                    href={`/monitors/${monitor.id}`}
                    className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors group"
                  >
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      monitor.isActive ? 'bg-green sd-dot-live' : 'bg-ink-5'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground group-hover:text-accent transition-colors truncate">
                        {monitor.name}
                      </div>
                      <div className="text-[11px] text-ink-5 font-mono truncate mt-0.5">{monitor.url}</div>
                    </div>
                    <span className="text-[11.5px] text-ink-5 font-mono shrink-0 hidden sm:block">
                      {relativeTime(monitor.lastCheckedAt)}
                    </span>
                  </Link>
                ))}
                {monitors.length > 8 && (
                  <div className="px-5 py-3 border-t border-white/[0.04]">
                    <Link href="/monitors" className="text-[12px] text-accent hover:text-accent-2 transition-colors">
                      +{monitors.length - 8} more monitors
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="sd-sweep bg-bg-card border border-line rounded-[12px] overflow-hidden" style={{ '--i': 2 } as React.CSSProperties}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <h3 className="text-[13.5px] font-semibold text-foreground">Recent changes</h3>
              {stats?.recentDiffs && stats.recentDiffs.length > 0 && (
                <Link href="/alerts" className="text-[12px] text-accent hover:text-accent-2 transition-colors flex items-center gap-1">
                  All alerts
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {!stats?.recentDiffs || stats.recentDiffs.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8 text-ink-5 text-[13px]">
                <Activity className="w-4 h-4 shrink-0" />
                No changes detected yet. Activity appears here when monitors find diffs.
              </div>
            ) : (
              <div>
                {stats.recentDiffs.map((diff) => (
                  <Link
                    key={diff.id}
                    href={`/monitors/${diff.monitorId}/diffs/${diff.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-md bg-accent/[0.1] flex items-center justify-center shrink-0">
                      <Activity className="w-3 h-3 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground group-hover:text-accent transition-colors truncate">
                        Change detected
                      </div>
                      <div className="text-[11.5px] text-ink-5 truncate mt-0.5">{diff.changeSummary}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] text-ink-4 font-mono">
                        {Number(diff.changePercentage).toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-ink-5 mt-0.5">
                        {relativeTime(diff.detectedAt)}
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
