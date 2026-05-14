'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Loader2, Bell, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertItem {
  diffId: string;
  monitorId: string;
  monitorName: string;
  changeSummary: string;
  changePercentage: string;
  detectedAt: string;
}

function relativeTime(dateStr: string): string {
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pctColor(pct: number): string {
  if (pct >= 20) return 'text-red-ink';
  if (pct >= 5) return 'text-amber';
  return 'text-green-ink';
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      try {
        const { data: monitorsData } = await api.get('/monitors');
        const monitors = monitorsData.monitors || [];

        const allAlerts: AlertItem[] = [];
        await Promise.all(
          monitors.map(async (m: any) => {
            try {
              const { data: diffsData } = await api.get(`/monitors/${m.id}/diffs`);
              (diffsData.diffs || []).forEach((d: any) => {
                allAlerts.push({
                  diffId: d.id,
                  monitorId: m.id,
                  monitorName: m.name,
                  changeSummary: d.changeSummary,
                  changePercentage: d.changePercentage,
                  detectedAt: d.detectedAt,
                });
              });
            } catch { /* skip failed fetches */ }
          })
        );
        allAlerts.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
        setAlerts(allAlerts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, [user]);

  return (
    <div>
      {/* Header */}
      <div className="sd-header flex justify-between items-end flex-wrap gap-5 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">Alerts</h1>
          <p className="text-ink-4 text-[13px] mt-0.5">Changes detected across your monitors.</p>
        </div>
        {!loading && alerts.length > 0 && (
          <span className="text-[12px] text-ink-5 font-mono bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 rounded-full">
            {alerts.length} {alerts.length === 1 ? 'change' : 'changes'}
          </span>
        )}
      </div>

      <div className="bg-bg-card border border-line rounded-[12px] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/[0.08] border border-accent/[0.14] mb-5">
              <Bell className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-[16px] font-semibold mb-2 text-foreground">No alerts yet</h3>
            <p className="text-ink-4 text-[13px] max-w-sm mx-auto leading-relaxed mb-5">
              Alerts appear when your monitors detect content changes. Make sure your monitors are active.
            </p>
            <Link href="/monitors" className="btn accent sm">
              View monitors
            </Link>
          </div>
        ) : (
          <div>
            {alerts.map((alert, i) => {
              const key = `${alert.monitorId}-${alert.diffId}`;
              const isExpanded = expandedId === key;
              const pct = Number(alert.changePercentage);

              return (
                <div
                  key={key}
                  className="sd-sweep border-b border-white/[0.04] last:border-0"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : key)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors text-left"
                  >
                    {/* Change dot */}
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      pct >= 20 ? 'bg-red' : pct >= 5 ? 'bg-amber' : 'bg-green'
                    )} />

                    {/* Monitor name */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-foreground truncate leading-tight">
                        {alert.monitorName}
                      </div>
                      <div className="text-[12px] text-ink-5 truncate mt-0.5 leading-tight">
                        {alert.changeSummary || 'Content changed'}
                      </div>
                    </div>

                    {/* Change % */}
                    <span className={cn(
                      'text-[12px] font-mono font-semibold shrink-0 hidden sm:block',
                      pctColor(pct)
                    )}>
                      +{pct.toFixed(1)}%
                    </span>

                    {/* Time */}
                    <span
                      className="text-[12px] text-ink-5 font-mono shrink-0 hidden md:block"
                      title={new Date(alert.detectedAt).toLocaleString()}
                    >
                      {relativeTime(alert.detectedAt)}
                    </span>

                    {/* Expand icon */}
                    <span className="text-ink-5 shrink-0">
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-3 border-t border-white/[0.04] bg-white/[0.015]">
                      <div className="flex flex-wrap gap-x-8 gap-y-2 mb-3 text-[12.5px]">
                        <div>
                          <span className="text-ink-5 mr-1.5">Monitor</span>
                          <span className="text-foreground font-medium">{alert.monitorName}</span>
                        </div>
                        <div>
                          <span className="text-ink-5 mr-1.5">Change</span>
                          <span className={cn('font-mono font-semibold', pctColor(pct))}>
                            {pct.toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-ink-5 mr-1.5">Detected</span>
                          <span className="text-ink-3">{formatDate(alert.detectedAt)}</span>
                        </div>
                      </div>
                      {alert.changeSummary && (
                        <p className="text-[12.5px] text-ink-3 leading-relaxed mb-3 max-w-xl">
                          {alert.changeSummary}
                        </p>
                      )}
                      <Link
                        href={`/monitors/${alert.monitorId}/diffs/${alert.diffId}`}
                        className="inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:text-accent-2 transition-colors font-medium"
                      >
                        View full diff
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
