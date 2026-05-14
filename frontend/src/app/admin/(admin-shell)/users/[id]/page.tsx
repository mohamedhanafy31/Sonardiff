'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { cn } from '@/lib/utils';

type UserDetail = {
  user: { id: string; email: string; name: string; plan: 'free' | 'pro'; planLimit: number; checksUsedThisPeriod: number; manualChecksUsedThisPeriod: number; periodResetAt: string; suspended: boolean; createdAt: string };
  monitors: { id: string; name: string; url: string; status: string; fetcherTier: number | null; lastCheckedAt: string | null; isActive: boolean; diffCount: number }[];
  alerts: { id: string; status: string; sentAt: string | null; error: string | null; createdAt: string; monitorName: string }[];
};

type ModalState = { type: string } | null;

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [customLimit, setCustomLimit] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setData(await adminApi.get<UserDetail>(`/users/${id}`)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const doAction = async (action: string, body?: unknown) => {
    setActionLoading(true);
    setError('');
    try {
      if (action === 'delete') {
        await adminApi.delete(`/users/${id}`);
        router.push('/admin/users');
        return;
      }
      if (action === 'reset-quota') {
        await adminApi.post(`/users/${id}/reset-quota`);
      } else {
        await adminApi.patch(`/users/${id}`, body);
      }
      setModal(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;
  if (!data) return <div className="text-ink-4">User not found.</div>;

  const { user, monitors, alerts } = data;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const tierIcon = (t: number | null) => t === 3 ? '🛡' : t === 2 ? '🌐' : '⚡';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users" className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display text-[24px] font-semibold tracking-tight">{user.name}</h1>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/20 rounded-lg px-4 py-3 text-red text-[13px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: user info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-bg-card border border-line rounded-[14px] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center font-semibold text-accent-2 text-[16px]">{initials}</div>
              <div>
                <div className="font-semibold text-foreground text-[15px]">{user.name}</div>
                <div className="text-ink-4 text-[13px]">{user.email}</div>
                <div className="text-ink-5 text-[12px] font-mono mt-0.5">{user.id}</div>
              </div>
              <span className={cn('ml-auto px-2.5 py-1 rounded-full text-[12px] font-medium', user.plan === 'pro' ? 'bg-accent/15 text-accent-2' : 'bg-bg-muted text-ink-3')}>
                {user.plan}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div><span className="text-ink-4">Quota used:</span> <span className="text-foreground font-medium">{user.checksUsedThisPeriod} / {user.planLimit}</span></div>
              <div><span className="text-ink-4">Manual checks:</span> <span className="text-foreground font-medium">{user.manualChecksUsedThisPeriod} / 50</span></div>
              <div><span className="text-ink-4">Period resets:</span> <span className="text-foreground font-medium">{new Date(user.periodResetAt).toLocaleDateString()}</span></div>
              <div><span className="text-ink-4">Joined:</span> <span className="text-foreground font-medium">{new Date(user.createdAt).toLocaleDateString()}</span></div>
              <div><span className="text-ink-4">Suspended:</span> <span className={cn('font-medium', user.suspended ? 'text-red' : 'text-green')}>{user.suspended ? 'Yes' : 'No'}</span></div>
            </div>
          </div>

          {/* Monitor sub-table */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="font-semibold text-[14px]">Monitors ({monitors.length})</h3>
            </div>
            <table className="w-full text-[12.5px]">
              <thead><tr className="bg-bg-soft border-b border-line">
                {['Name', 'Status', 'Tier', 'Last check', 'Diffs'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {monitors.map(m => (
                  <tr key={m.id} className="border-b border-line/40 hover:bg-bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="text-foreground font-medium truncate max-w-[180px]">{m.name}</div>
                      <div className="text-ink-5 text-[11px] truncate max-w-[180px]">{m.url}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium', m.status === 'active' ? 'bg-green/15 text-green' : m.status === 'unreachable' ? 'bg-red/15 text-red' : 'bg-bg-muted text-ink-4')}>{m.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">{tierIcon(m.fetcherTier)}</td>
                    <td className="px-4 py-2.5 text-ink-4">{m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5 text-ink-3">{m.diffCount}</td>
                  </tr>
                ))}
                {!monitors.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-5">No monitors</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Alert history */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="font-semibold text-[14px]">Recent Alerts</h3>
            </div>
            <table className="w-full text-[12.5px]">
              <thead><tr className="bg-bg-soft border-b border-line">
                {['Monitor', 'Status', 'Sent at', 'Error'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-b border-line/40 hover:bg-bg-muted/20">
                    <td className="px-4 py-2.5 text-foreground">{a.monitorName}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[11px] font-medium', a.status === 'sent' ? 'bg-green/15 text-green' : a.status === 'failed' ? 'bg-red/15 text-red' : 'bg-bg-muted text-ink-4')}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-4">{a.sentAt ? new Date(a.sentAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2.5 text-red font-mono text-[11px] max-w-[160px] truncate">{a.error ?? '—'}</td>
                  </tr>
                ))}
                {!alerts.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-5">No alerts</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: action panel */}
        <div className="space-y-3">
          <div className="bg-bg-card border border-line rounded-[14px] p-5">
            <h3 className="font-semibold text-[14px] mb-4">Actions</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => setModal({ type: 'upgrade' })}
                className="w-full px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-2 text-[13px] font-medium hover:bg-accent/15 transition-colors text-left">
                Upgrade to Pro
              </button>
              <button onClick={() => setModal({ type: 'downgrade' })}
                className="w-full px-4 py-2.5 rounded-lg border border-line text-ink-3 text-[13px] font-medium hover:bg-bg-muted transition-colors text-left">
                Downgrade to Free
              </button>
              <button onClick={() => setModal({ type: 'reset-quota' })}
                className="w-full px-4 py-2.5 rounded-lg border border-line text-ink-3 text-[13px] font-medium hover:bg-bg-muted transition-colors text-left">
                Reset Quota Now
              </button>
              <button onClick={() => setModal({ type: 'custom-limit' })}
                className="w-full px-4 py-2.5 rounded-lg border border-line text-ink-3 text-[13px] font-medium hover:bg-bg-muted transition-colors text-left">
                Set Custom Plan Limit
              </button>
              <button onClick={() => setModal({ type: user.suspended ? 'unsuspend' : 'suspend' })}
                className="w-full px-4 py-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-[13px] font-medium hover:bg-yellow-500/15 transition-colors text-left">
                {user.suspended ? 'Unsuspend Account' : 'Suspend Account'}
              </button>
              <button onClick={() => setModal({ type: 'delete' })}
                className="w-full px-4 py-2.5 rounded-lg border border-red/30 bg-red/10 text-red text-[13px] font-medium hover:bg-red/15 transition-colors text-left">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        open={modal?.type === 'upgrade'}
        title="Upgrade to Pro"
        description="This will set the user's plan to Pro and update their monthly check limit to 36,000."
        confirmLabel="Upgrade to Pro"
        confirmVariant="primary"
        loading={actionLoading}
        onConfirm={() => doAction('patch', { plan: 'pro' })}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal?.type === 'downgrade'}
        title="Downgrade to Free"
        description="This will pause all monitors with sub-hourly intervals and clear CSS selectors. The user will be limited to 150 checks/month."
        confirmLabel="Downgrade to Free"
        loading={actionLoading}
        onConfirm={() => doAction('patch', { plan: 'free' })}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal?.type === 'reset-quota'}
        title="Reset Quota"
        description="This will set checksUsedThisPeriod and manualChecksUsedThisPeriod to 0 immediately."
        confirmLabel="Reset Quota"
        loading={actionLoading}
        onConfirm={() => doAction('reset-quota')}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal?.type === 'custom-limit'}
        title="Set Custom Plan Limit"
        description="Override the monthly check limit for this user specifically."
        confirmLabel="Set Limit"
        confirmVariant="primary"
        loading={actionLoading}
        onConfirm={() => { const n = parseInt(customLimit); if (n > 0) doAction('patch', { planLimit: n }); }}
        onCancel={() => setModal(null)}
      >
        <input
          type="number"
          value={customLimit}
          onChange={e => setCustomLimit(e.target.value)}
          placeholder="e.g. 500"
          className="w-full px-3 py-2 rounded-lg bg-bg-soft border border-line text-sm text-foreground focus:outline-none focus:border-accent/40"
        />
      </ConfirmModal>
      <ConfirmModal
        open={modal?.type === 'suspend'}
        title="Suspend Account"
        description="This will immediately block the user from all API endpoints and disable their monitors."
        confirmLabel="Suspend"
        loading={actionLoading}
        onConfirm={() => doAction('patch', { suspended: true })}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal?.type === 'unsuspend'}
        title="Unsuspend Account"
        description="This will restore the user's access to the platform."
        confirmLabel="Unsuspend"
        confirmVariant="primary"
        loading={actionLoading}
        onConfirm={() => doAction('patch', { suspended: false })}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal?.type === 'delete'}
        title="Delete Account"
        description="This permanently deletes the user and all their data (monitors, snapshots, diffs, alerts). This cannot be undone."
        confirmLabel="Delete Account"
        requireTyping={user.email}
        loading={actionLoading}
        onConfirm={() => doAction('delete')}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
