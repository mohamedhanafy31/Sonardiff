'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Loader2, Clock, Plus } from 'lucide-react';

export default function SchedulesPage() {
  const { user } = useAuthStore();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data } = await api.get('/monitors');
        setMonitors(data.monitors || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const formatInterval = (min: number) => {
    if (min >= 1440) return `${min / 1440}d`;
    if (min >= 60) return `${min / 60}h`;
    return `${min}m`;
  };

  // Group by frequency
  const freqGroups = monitors.reduce<Record<string, any[]>>((acc, m) => {
    const key = formatInterval(m.checkIntervalMinutes);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const totalChecksPerDay = monitors.reduce((sum, m) => sum + (1440 / m.checkIntervalMinutes), 0);

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Schedules</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">Monitor check frequencies and timing overview.</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : monitors.length === 0 ? (
        <div className="bg-bg-card border border-line rounded-[14px] text-center py-20 px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/8 border border-accent/15 mb-5">
            <Clock className="w-7 h-7 text-accent" />
          </div>
          <h3 className="text-[17px] font-semibold mb-2">No schedules yet</h3>
          <p className="text-ink-3 text-[14px] max-w-sm mx-auto mb-5">
            Create your first monitor to see check schedules and frequency stats here.
          </p>
          <Link href="/monitors/new" className="btn accent inline-flex">
            <Plus className="w-4 h-4" />
            Add a monitor
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-bg-card border border-line rounded-[14px] p-5">
              <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Total monitors</div>
              <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none">{monitors.length}</div>
            </div>
            <div className="bg-bg-card border border-line rounded-[14px] p-5">
              <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Checks / day</div>
              <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none">{Math.round(totalChecksPerDay)}</div>
            </div>
            <div className="bg-bg-card border border-line rounded-[14px] p-5">
              <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Active</div>
              <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none text-green-ink">{monitors.filter(m => m.isActive).length}</div>
            </div>
            <div className="bg-bg-card border border-line rounded-[14px] p-5">
              <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Paused</div>
              <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none text-ink-4">{monitors.filter(m => !m.isActive).length}</div>
            </div>
          </div>

          {/* Frequency distribution */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Frequency distribution</h3>
            </div>
            <div className="divide-y divide-line-soft">
              {Object.entries(freqGroups)
                .sort(([, a], [, b]) => b.length - a.length)
                .map(([freq, group]) => (
                  <div key={freq} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="w-16 text-[13px] font-mono font-medium text-accent-2">
                      Every {freq}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent to-cyan-300 rounded-full"
                          style={{ width: `${(group.length / monitors.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[13px] text-ink-3 font-mono w-24 text-right">
                      {group.length} monitor{group.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Monitor list */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">All schedules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="bg-bg-soft text-ink-4 text-[11.5px] uppercase tracking-[0.08em] font-semibold">
                    <th className="px-5 py-2.5">Monitor</th>
                    <th className="px-5 py-2.5">Frequency</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5">Last checked</th>
                    <th className="px-5 py-2.5">Checks / month</th>
                  </tr>
                </thead>
                <tbody>
                  {monitors.map((m) => (
                    <tr key={m.id} className="border-t border-line-soft hover:bg-bg-soft/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/monitors/${m.id}`} className="font-medium hover:text-accent-2 transition-colors">
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-3">
                        Every {formatInterval(m.checkIntervalMinutes)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`pill text-[11px] ${m.isActive ? 'live' : 'paused'}`}>
                          <span className="dot" />
                          {m.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-4 text-xs font-mono">
                        {m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-3">
                        {Math.floor((30 * 24 * 60) / m.checkIntervalMinutes).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
