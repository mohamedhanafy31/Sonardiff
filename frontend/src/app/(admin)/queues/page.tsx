'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { cn } from '@/lib/utils';

type QueueStats = { name: string; waiting: number; active: number; delayed: number; completed: number; failed: number; isPaused: boolean };
type FailedJob = { id: string; name: string; attemptsMade: number; failedReason: string; finishedOn: number; data: unknown };

export default function AdminQueuesPage() {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [failed, setFailed] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState('');
  const [modal, setModal] = useState<{ type: string; queue?: string; jobId?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const [q, f] = await Promise.all([
        adminApi.get<QueueStats[]>('/queues'),
        adminApi.get<FailedJob[]>(`/queues/${selectedQueue || 'scrape-queue'}/failed`),
      ]);
      setQueues(q);
      setFailed(f);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedQueue]);

  const doAction = async () => {
    if (!modal) return;
    setActionLoading(true);
    try {
      if (modal.type === 'retry') await adminApi.post(`/queues/${modal.queue}/retry/${modal.jobId}`);
      else if (modal.type === 'discard') await adminApi.delete(`/queues/${modal.queue}/failed/${modal.jobId}`);
      else if (modal.type === 'pause') await adminApi.post(`/queues/${modal.queue}/pause`);
      else if (modal.type === 'resume') await adminApi.post(`/queues/${modal.queue}/resume`);
      else if (modal.type === 'drain') await adminApi.post(`/queues/${modal.queue}/drain`);
      setModal(null);
      await load();
    } finally { setActionLoading(false); }
  };

  const queueLabels: Record<string, string> = {
    'scrape-queue': 'Scrape',
    'alert-queue': 'Alert',
    'system-queue': 'System',
    'discovery-queue': 'Discovery',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Queue Health</h1>
        <p className="text-ink-4 text-[13.5px] mt-1">Auto-refreshes every 10 seconds</p>
      </div>

      {loading && queues.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
      ) : (
        <>
          {/* Queue cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {queues.map(q => (
              <div key={q.name} className="bg-bg-card border border-line rounded-[14px] p-5">
                {q.isPaused && (
                  <div className="mb-3 bg-red/10 border border-red/20 rounded-lg px-3 py-1.5 text-red text-[12px] font-medium text-center">Queue Paused</div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-semibold text-[14px] text-foreground">{queueLabels[q.name] ?? q.name}</div>
                    <div className="font-mono text-[11px] text-ink-5">{q.name}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12.5px] mb-4">
                  {[
                    { label: 'Waiting', value: q.waiting, color: q.waiting > 50 ? 'text-yellow-400' : 'text-ink-3' },
                    { label: 'Active', value: q.active, color: 'text-accent-2' },
                    { label: 'Delayed', value: q.delayed, color: 'text-ink-4' },
                    { label: 'Failed', value: q.failed, color: q.failed > 0 ? 'text-red' : 'text-ink-4' },
                  ].map(s => (
                    <div key={s.label} className="bg-bg-soft rounded-lg px-2.5 py-2">
                      <div className="text-ink-5 text-[10.5px] mb-0.5">{s.label}</div>
                      <div className={cn('font-semibold text-[15px]', s.color)}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ type: q.isPaused ? 'resume' : 'pause', queue: q.name })}
                    className={cn('flex-1 py-1.5 rounded-lg text-[12px] font-medium border transition-colors', q.isPaused ? 'border-green/30 bg-green/10 text-green hover:bg-green/15' : 'border-line text-ink-3 hover:bg-bg-muted')}
                  >
                    {q.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => setModal({ type: 'drain', queue: q.name })}
                    className="flex-1 py-1.5 rounded-lg border border-red/20 bg-red/10 text-red text-[12px] font-medium hover:bg-red/15 transition-colors"
                  >
                    Drain
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Failed jobs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[15px]">Failed Jobs</h3>
              <select
                value={selectedQueue}
                onChange={e => setSelectedQueue(e.target.value)}
                className="bg-bg-card border border-line rounded-lg px-3 py-1.5 text-[13px] text-foreground focus:outline-none"
              >
                {['scrape-queue', 'alert-queue', 'system-queue', 'discovery-queue'].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead><tr className="bg-bg-soft border-b border-line">
                  {['Job Name', 'Job ID', 'Attempt', 'Error', 'Failed At', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {failed.map(j => (
                    <tr key={j.id} className="border-b border-line/50 hover:bg-bg-muted/20">
                      <td className="px-4 py-3 text-foreground font-medium">{j.name}</td>
                      <td className="px-4 py-3 font-mono text-ink-4 text-[11.5px]">{String(j.id).slice(0, 12)}…</td>
                      <td className="px-4 py-3 text-ink-3">{j.attemptsMade}</td>
                      <td className="px-4 py-3 text-red text-[12px] font-mono max-w-[200px] truncate">{j.failedReason?.slice(0, 80) ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-4 text-[12px]">{j.finishedOn ? new Date(j.finishedOn).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setModal({ type: 'retry', queue: selectedQueue || 'scrape-queue', jobId: String(j.id) })}
                            className="p-1.5 rounded-lg border border-line text-ink-3 hover:bg-bg-muted hover:text-foreground">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setModal({ type: 'discard', queue: selectedQueue || 'scrape-queue', jobId: String(j.id) })}
                            className="p-1.5 rounded-lg border border-red/20 text-red hover:bg-red/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!failed.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-4">No failed jobs</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!modal && ['pause', 'resume', 'drain'].includes(modal.type)}
        title={modal?.type === 'drain' ? 'Drain Queue' : modal?.type === 'pause' ? 'Pause Queue' : 'Resume Queue'}
        description={modal?.type === 'drain' ? `Remove all waiting jobs from ${modal?.queue}. Active jobs will continue.` : `${modal?.type === 'pause' ? 'Pause' : 'Resume'} ${modal?.queue}.`}
        confirmLabel={modal?.type === 'drain' ? 'Drain' : modal?.type === 'pause' ? 'Pause' : 'Resume'}
        confirmVariant={modal?.type === 'drain' ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={doAction}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={!!modal && modal.type === 'retry'}
        title="Retry Job"
        description={`Re-queue job ${modal?.jobId?.slice(0, 12) ?? ''} for a fresh attempt.`}
        confirmLabel="Retry"
        confirmVariant="primary"
        loading={actionLoading}
        onConfirm={doAction}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={!!modal && modal.type === 'discard'}
        title="Discard Job"
        description="Remove this job from the failed set permanently."
        confirmLabel="Discard"
        loading={actionLoading}
        onConfirm={doAction}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
