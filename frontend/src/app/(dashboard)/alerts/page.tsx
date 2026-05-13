'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Loader2, Bell } from 'lucide-react';

interface AlertItem {
  diffId: string;
  monitorId: string;
  monitorName: string;
  changeSummary: string;
  changePercentage: string;
  detectedAt: string;
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Alerts</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">All detected changes across your monitors.</div>
        </div>
      </div>

      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Change log</h3>
          <span className="text-xs text-ink-4 font-mono bg-bg-soft px-2 py-0.5 rounded-full">
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/8 border border-accent/15 mb-5">
              <Bell className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-[17px] font-semibold mb-2">No alerts yet</h3>
            <p className="text-ink-3 text-[14px] max-w-sm mx-auto leading-relaxed">
              Alerts appear here when your monitors detect content changes. Make sure your monitors are active.
            </p>
            <Link href="/monitors" className="btn accent mt-6 inline-flex">
              View monitors →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {alerts.map((alert) => (
              <Link
                key={`${alert.monitorId}-${alert.diffId}`}
                href={`/monitors/${alert.monitorId}/diffs/${alert.diffId}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-bg-soft/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[13.5px] group-hover:text-accent-2 transition-colors">{alert.monitorName}</span>
                    <span className="pill text-[11px] warn">
                      <span className="dot" />
                      {Number(alert.changePercentage).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-ink-4 mt-0.5 truncate">{alert.changeSummary}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-ink-3">{new Date(alert.detectedAt).toLocaleDateString()}</div>
                  <div className="text-[11px] text-ink-4 font-mono">{new Date(alert.detectedAt).toLocaleTimeString()}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
