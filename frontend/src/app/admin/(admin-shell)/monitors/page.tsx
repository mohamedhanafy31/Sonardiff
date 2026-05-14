'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, ChevronLeft, ChevronRight, Pause, Play, Trash2, ExternalLink } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { ConfirmModal } from '@/components/admin/ConfirmModal';
import { cn } from '@/lib/utils';

type AdminMonitor = {
  id: string; name: string; url: string; status: string; isActive: boolean;
  fetcherTier: number | null; checkIntervalMinutes: number; lastCheckedAt: string | null;
  userId: string; userEmail: string; userPlan: string; diffCount: number;
};
type MonitorsResp = { monitors: AdminMonitor[]; total: number; page: number; pages: number };

const STATUS_OPTS = ['', 'active', 'paused', 'unreachable'];
const TIER_OPTS = ['', '1', '2', '3'];
const PLAN_OPTS = ['', 'free', 'pro'];

const tierIcon = (t: number | null) => t === 3 ? '🛡 Stealth' : t === 2 ? '🌐 Browser' : '⚡ HTTP';

export default function AdminMonitorsPage() {
  const [data, setData] = useState<MonitorsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ type: string; id?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      if (tier) params.set('tier', tier);
      if (plan) params.set('plan', plan);
      if (search) params.set('search', search);
      setData(await adminApi.get<MonitorsResp>(`/monitors?${params}`));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status, tier, plan, search]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput); setPage(1); };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (!data) return;
    setSelected(selected.size === data.monitors.length ? new Set() : new Set(data.monitors.map(m => m.id)));
  };

  const doAction = async (type: string, id?: string) => {
    setActionLoading(true);
    try {
      if (id) {
        if (type === 'pause') await adminApi.patch(`/monitors/${id}`, { isActive: false, status: 'paused' });
        else if (type === 'resume') await adminApi.patch(`/monitors/${id}`, { isActive: true, status: 'active' });
        else if (type === 'delete') await adminApi.delete(`/monitors/${id}`);
      } else {
        const ids = Array.from(selected);
        await adminApi.post('/monitors/bulk', { ids, action: type === 'bulk-delete' ? 'delete' : type === 'bulk-pause' ? 'pause' : 'resume' });
        setSelected(new Set());
      }
      setModal(null);
      await load();
    } finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Monitors</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">{data?.total ?? '—'} total monitors across all users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-5" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search URL or name…"
            className="pl-9 pr-3 py-2 rounded-lg bg-bg-card border border-line text-[13px] text-foreground placeholder:text-ink-5 focus:outline-none focus:border-accent/40 w-56" />
        </form>
        {[
          { label: 'Status', value: status, opts: STATUS_OPTS, onChange: (v: string) => { setStatus(v); setPage(1); } },
          { label: 'Tier', value: tier, opts: TIER_OPTS, onChange: (v: string) => { setTier(v); setPage(1); } },
          { label: 'Plan', value: plan, opts: PLAN_OPTS, onChange: (v: string) => { setPlan(v); setPage(1); } },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.onChange(e.target.value)}
            className="bg-bg-card border border-line rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none capitalize">
            <option value="">All {f.label}s</option>
            {f.opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-[10px]">
          <span className="text-[13px] text-accent-2 font-medium">{selected.size} selected</span>
          <button onClick={() => setModal({ type: 'bulk-pause' })} className="px-3 py-1 rounded-lg border border-line text-[12.5px] text-ink-3 hover:bg-bg-muted flex items-center gap-1.5"><Pause className="w-3 h-3" /> Pause</button>
          <button onClick={() => setModal({ type: 'bulk-resume' })} className="px-3 py-1 rounded-lg border border-line text-[12.5px] text-ink-3 hover:bg-bg-muted flex items-center gap-1.5"><Play className="w-3 h-3" /> Resume</button>
          <button onClick={() => setModal({ type: 'bulk-delete' })} className="px-3 py-1 rounded-lg border border-red/20 bg-red/10 text-red text-[12.5px] hover:bg-red/15 flex items-center gap-1.5"><Trash2 className="w-3 h-3" /> Delete</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
      ) : (
        <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-line bg-bg-soft">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={!!data && selected.size === data.monitors.length && data.monitors.length > 0}
                  onChange={toggleAll} className="rounded border-line" />
              </th>
              {['Name / URL', 'Owner', 'Status', 'Tier', 'Interval', 'Last Check', 'Diffs', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data?.monitors.map(m => (
                <tr key={m.id} className="border-b border-line/50 hover:bg-bg-muted/20">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded border-line" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground truncate max-w-[150px]">{m.name}</span>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-ink-5 hover:text-ink-3">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-ink-5 text-[11.5px] truncate max-w-[200px]">{m.url}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-3 text-[12.5px]">
                    <div>{m.userEmail}</div>
                    <span className={cn('text-[10.5px] px-1.5 py-0.5 rounded-full', m.userPlan === 'pro' ? 'bg-accent/15 text-accent-2' : 'bg-bg-muted text-ink-4')}>{m.userPlan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', m.status === 'active' ? 'bg-green/15 text-green' : m.status === 'unreachable' ? 'bg-red/15 text-red' : 'bg-bg-muted text-ink-4')}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-4">{tierIcon(m.fetcherTier)}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-4">{m.checkIntervalMinutes >= 1440 ? 'Daily' : `${m.checkIntervalMinutes}m`}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-4">{m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-ink-3">{m.diffCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ type: m.isActive ? 'pause' : 'resume', id: m.id })}
                        className="p-1.5 rounded-lg border border-line text-ink-4 hover:bg-bg-muted">
                        {m.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setModal({ type: 'delete', id: m.id })}
                        className="p-1.5 rounded-lg border border-red/20 text-red hover:bg-red/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.monitors.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-4">No monitors found</td></tr>}
            </tbody>
          </table>
          {data && data.pages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-line bg-bg-soft">
              <span className="text-[12px] text-ink-4">Page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-line text-ink-4 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="p-1.5 rounded-lg border border-line text-ink-4 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!modal && ['pause', 'resume', 'delete', 'bulk-pause', 'bulk-resume', 'bulk-delete'].includes(modal.type)}
        title={modal?.type === 'delete' || modal?.type === 'bulk-delete' ? 'Delete Monitor(s)' : modal?.type?.includes('pause') ? 'Pause Monitor(s)' : 'Resume Monitor(s)'}
        description={modal?.type === 'delete' ? 'Permanently delete this monitor and all its snapshots, diffs, and alerts.' : modal?.type === 'bulk-delete' ? `Permanently delete ${selected.size} monitors.` : `${modal?.type?.includes('pause') ? 'Pause' : 'Resume'} ${modal?.id ? 'this monitor' : `${selected.size} monitors`}.`}
        confirmLabel={modal?.type?.includes('delete') ? 'Delete' : modal?.type?.includes('pause') ? 'Pause' : 'Resume'}
        confirmVariant={modal?.type?.includes('delete') ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={() => doAction(modal!.type, modal?.id)}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
