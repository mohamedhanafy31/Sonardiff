'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { ConfirmModal } from '@/components/admin/ConfirmModal';

type StorageStats = {
  totalFiles: number;
  totalBytes: number;
  totalSnapshots: number;
  expiredSnapshots: number;
  activeSnapshots: number;
  orphanedFileCount: number;
  orphanedBytes: number;
  oldestSnapshot: string | null;
  nextGcRun: string;
  perUser: { email: string; snapshotCount: number }[];
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminStoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'gc' | 'purge' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try { setStats(await adminApi.get<StorageStats>('/storage')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doGc = async () => {
    setActionLoading(true);
    try {
      const res = await adminApi.post<{ ok: boolean; jobId: string }>('/storage/gc');
      setMsg(`GC job queued (ID: ${res.jobId})`);
      setModal(null);
    } finally { setActionLoading(false); }
  };

  const doPurge = async () => {
    setActionLoading(true);
    try {
      const res = await adminApi.post<{ ok: boolean; deleted: number; bytesFreed: number }>('/storage/purge-orphans');
      setMsg(`Purged ${res.deleted} orphaned files (${formatBytes(res.bytesFreed)} freed)`);
      setModal(null);
      await load();
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;
  if (!stats) return <div className="text-ink-4">Failed to load storage stats.</div>;

  const donutData = [
    { name: 'Active', value: stats.activeSnapshots },
    { name: 'Expired', value: stats.expiredSnapshots },
  ];
  const COLORS = ['#06B6D4', '#EF4444'];

  const statCards = [
    { label: 'Total Snapshot Files', value: stats.totalFiles.toLocaleString() },
    { label: 'Total Disk Used', value: formatBytes(stats.totalBytes) },
    { label: 'Orphaned Files', value: `${stats.orphanedFileCount} (${formatBytes(stats.orphanedBytes)})` },
    { label: 'Oldest Snapshot', value: stats.oldestSnapshot ? new Date(stats.oldestSnapshot).toLocaleDateString() : '—' },
    { label: 'Next GC Run', value: stats.nextGcRun },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Storage</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">Snapshot disk usage and maintenance controls</p>
        </div>
        <div className="flex gap-3">
          {msg && <span className="text-[12px] text-green self-center">{msg}</span>}
          <button onClick={() => setModal('purge')} disabled={stats.orphanedFileCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-line text-ink-3 text-[13px] hover:bg-bg-muted transition-colors disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" />
            Purge Orphans ({stats.orphanedFileCount})
          </button>
          <button onClick={() => setModal('gc')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-2 text-[13px] font-medium hover:bg-accent/15 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Run GC Now
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="bg-bg-card border border-line rounded-[12px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-ink-5 mb-1.5">{c.label}</div>
            <div className="font-semibold text-[15px] text-foreground">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Donut + top users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card border border-line rounded-[14px] p-6">
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-4">Expired vs. Active Snapshots</h3>
          {stats.totalSnapshots > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-ink-5 text-[13px]">No snapshots yet</div>
          )}
        </div>

        <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h3 className="font-semibold text-[14px]">Top Users by Storage</h3>
          </div>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-bg-soft border-b border-line">
              <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">User</th>
              <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">Snapshots</th>
            </tr></thead>
            <tbody>
              {stats.perUser.slice(0, 15).map((u, i) => (
                <tr key={i} className="border-b border-line/40 hover:bg-bg-muted/20">
                  <td className="px-4 py-2.5 text-ink-3">{u.email}</td>
                  <td className="px-4 py-2.5 text-foreground font-medium">{u.snapshotCount}</td>
                </tr>
              ))}
              {!stats.perUser.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-ink-5">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={modal === 'gc'}
        title="Run Garbage Collection"
        description="Enqueues a gc-maintenance job immediately. It will delete expired snapshots and their files. You can track progress in the Queues page."
        confirmLabel="Run GC"
        confirmVariant="primary"
        loading={actionLoading}
        onConfirm={doGc}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal === 'purge'}
        title="Purge Orphaned Files"
        description={`Delete ${stats.orphanedFileCount} files on disk that have no matching database snapshot row (${formatBytes(stats.orphanedBytes)} total). This cannot be undone.`}
        confirmLabel="Purge Files"
        loading={actionLoading}
        onConfirm={doPurge}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
