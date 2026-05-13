'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Loader2, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffEntry {
  diffId: string;
  monitorId: string;
  monitorName: string;
  changeSummary: string;
  changePercentage: string;
  detectedAt: string;
}

interface SnapshotEntry {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  httpStatus: number | null;
  error: string | null;
  contentHash: string | null;
  capturedAt: string;
}

type Tab = 'changes' | 'all';

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('changes');
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);

  // Fetch diffs (Changes tab)
  useEffect(() => {
    if (!user) return;
    const fetchDiffs = async () => {
      try {
        const { data: monitorsData } = await api.get('/monitors');
        const monitors = monitorsData.monitors || [];
        const allEntries: DiffEntry[] = [];
        await Promise.all(
          monitors.map(async (m: any) => {
            try {
              const { data } = await api.get(`/monitors/${m.id}/diffs`);
              (data.diffs || []).forEach((d: any) => {
                allEntries.push({
                  diffId: d.id,
                  monitorId: m.id,
                  monitorName: m.name,
                  changeSummary: d.changeSummary,
                  changePercentage: d.changePercentage,
                  detectedAt: d.detectedAt,
                });
              });
            } catch { /* skip */ }
          })
        );
        allEntries.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
        setDiffs(allEntries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingChanges(false);
      }
    };
    fetchDiffs();
  }, [user]);

  // Fetch all snapshots (All checks tab)
  useEffect(() => {
    if (!user) return;
    const fetchSnapshots = async () => {
      try {
        const { data } = await api.get('/monitors/snapshots/all?limit=200');
        setSnapshots(data.snapshots || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAll(false);
      }
    };
    fetchSnapshots();
  }, [user]);

  const groupByDate = <T extends { date: string }>(items: T[]) =>
    items.reduce<Record<string, T[]>>((acc, entry) => {
      const dateKey = new Date(entry.date).toLocaleDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    }, {});

  const groupedDiffs = groupByDate(diffs.map(d => ({ ...d, date: d.detectedAt })));
  const groupedSnapshots = groupByDate(snapshots.map(s => ({ ...s, date: s.capturedAt })));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'changes', label: 'Changes detected', count: diffs.length },
    { key: 'all', label: 'All checks', count: snapshots.length },
  ];

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">History</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">
            {tab === 'changes'
              ? 'Timeline of all detected changes across monitors.'
              : 'Every check your monitors have performed, including unchanged runs.'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[13.5px] font-medium border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-accent text-foreground"
                : "border-transparent text-ink-4 hover:text-ink-2"
            )}
          >
            {t.label}
            <span className={cn(
              "ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold",
              tab === t.key ? "bg-accent/15 text-accent-2" : "bg-bg-muted text-ink-4"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'changes' && (
        loadingChanges ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : diffs.length === 0 ? (
          <div className="bg-bg-card border border-line rounded-[14px] text-center py-20 px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/8 border border-accent/15 mb-5">
              <Clock className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-[17px] font-semibold mb-2">No changes detected yet</h3>
            <p className="text-ink-3 text-[14px] max-w-sm mx-auto">
              Your monitors are running — changes will appear here when content shifts. Check the <strong className="text-foreground">All checks</strong> tab to see every run.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedDiffs).map(([date, items]) => (
              <div key={date}>
                <div className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">{date}</div>
                <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden divide-y divide-line-soft">
                  {items.map((entry) => (
                    <Link
                      key={`${entry.monitorId}-${entry.diffId}`}
                      href={`/monitors/${entry.monitorId}/diffs/${entry.diffId}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-soft/50 transition-colors group"
                    >
                      <div className="text-xs text-ink-4 font-mono w-16 shrink-0">
                        {new Date(entry.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13.5px] group-hover:text-accent-2 transition-colors">{entry.monitorName}</span>
                          <span className={cn(
                            "pill text-[11px]",
                            Number(entry.changePercentage) > 5 ? "warn" : "live"
                          )}>
                            <span className="dot" />
                            {Number(entry.changePercentage).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-ink-4 mt-0.5 truncate">{entry.changeSummary}</div>
                      </div>
                      <span className="text-accent-2 text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        View →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'all' && (
        loadingAll ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="bg-bg-card border border-line rounded-[14px] text-center py-20 px-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/8 border border-accent/15 mb-5">
              <Clock className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-[17px] font-semibold mb-2">No checks have run yet</h3>
            <p className="text-ink-3 text-[14px] max-w-sm mx-auto mb-5">
              Add a monitor and the first check will run automatically. You can also trigger one with <strong className="text-foreground">Run check now</strong> on any monitor.
            </p>
            <Link href="/monitors/new" className="btn accent inline-flex">
              <Plus className="w-4 h-4" />
              Add a monitor
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSnapshots).map(([date, items]) => (
              <div key={date}>
                <div className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">{date}</div>
                <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden divide-y divide-line-soft">
                  {items.map((s) => {
                    const isError = !!s.error;
                    const isOk = !isError && (!s.httpStatus || s.httpStatus < 400);
                    return (
                      <Link
                        key={s.id}
                        href={`/monitors/${s.monitorId}`}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-soft/50 transition-colors group"
                      >
                        <div className="text-xs text-ink-4 font-mono w-16 shrink-0">
                          {new Date(s.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[13.5px] group-hover:text-accent-2 transition-colors">{s.monitorName}</span>
                            {isError ? (
                              <span className="pill text-[11px] warn">
                                <AlertCircle className="w-3 h-3" /> Error
                              </span>
                            ) : isOk ? (
                              <span className="pill text-[11px] live">
                                <CheckCircle className="w-3 h-3" /> {s.httpStatus || 'OK'}
                              </span>
                            ) : (
                              <span className="pill text-[11px] warn">
                                <span className="dot" /> {s.httpStatus}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-4 mt-0.5 truncate font-mono">
                            {isError
                              ? (s.error || '').split('\n')[0].slice(0, 120)
                              : s.monitorUrl}
                          </div>
                        </div>
                        <span className="text-accent-2 text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Open →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
