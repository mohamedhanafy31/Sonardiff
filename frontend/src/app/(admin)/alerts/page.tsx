'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

type AdminAlert = { id: string; status: string; channel: string; sentAt: string | null; error: string | null; createdAt: string; diffId: string; userEmail: string; monitorName: string };
type AlertsResp = { alerts: AdminAlert[]; total: number; page: number; pages: number };

const STATUS_OPTS = ['all', 'sent', 'failed', 'pending'] as const;

export default function AdminAlertsPage() {
  const [data, setData] = useState<AlertsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestMsg, setDigestMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status !== 'all') params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      setData(await adminApi.get<AlertsResp>(`/alerts?${params}`));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, status, from, to]);

  const retry = async (id: string) => {
    setRetrying(id);
    try { await adminApi.post(`/alerts/${id}/retry`); await load(); }
    finally { setRetrying(null); }
  };

  const sendDigest = async () => {
    setDigestLoading(true);
    setDigestMsg('');
    try {
      const res = await adminApi.post<{ ok: boolean; to: string }>('/alerts/digest');
      setDigestMsg(`Digest sent to ${res.to}`);
    } catch (e: unknown) {
      setDigestMsg(e instanceof Error ? e.message : 'Failed');
    } finally { setDigestLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Alert Delivery Log</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">{data?.total ?? '—'} total alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {digestMsg && <span className="text-[12px] text-green">{digestMsg}</span>}
          <button onClick={sendDigest} disabled={digestLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-2 text-[13px] font-medium hover:bg-accent/15 transition-colors disabled:opacity-50">
            {digestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Resend Digest
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-bg-card border border-line rounded-lg p-0.5">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors',
                status === s ? 'bg-accent/15 text-accent-2' : 'text-ink-4 hover:text-foreground')}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-bg-card border border-line rounded-lg px-3 py-1.5 text-[13px] text-foreground focus:outline-none" />
          <span className="text-ink-4 text-sm">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-bg-card border border-line rounded-lg px-3 py-1.5 text-[13px] text-foreground focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
      ) : (
        <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-line bg-bg-soft">
              {['User', 'Monitor', 'Status', 'Channel', 'Sent At', 'Error', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data?.alerts.map(a => (
                <tr key={a.id} className="border-b border-line/50 hover:bg-bg-muted/20">
                  <td className="px-4 py-3 text-ink-3 text-[12px]">{a.userEmail}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{a.monitorName}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', a.status === 'sent' ? 'bg-green/15 text-green' : a.status === 'failed' ? 'bg-red/15 text-red' : 'bg-bg-muted text-ink-4')}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-4 text-[12px]">{a.channel}</td>
                  <td className="px-4 py-3 text-ink-4 text-[12px]">{a.sentAt ? new Date(a.sentAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-red font-mono text-[11.5px] max-w-[160px] truncate">{a.error ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.status === 'failed' && (
                      <button onClick={() => retry(a.id)} disabled={retrying === a.id}
                        className="p-1.5 rounded-lg border border-line text-ink-3 hover:bg-bg-muted hover:text-foreground disabled:opacity-50">
                        {retrying === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.alerts.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-4">No alerts found</td></tr>}
            </tbody>
          </table>
          {data && data.pages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-line bg-bg-soft">
              <span className="text-[12px] text-ink-4">Page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-line text-ink-4 hover:bg-bg-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="p-1.5 rounded-lg border border-line text-ink-4 hover:bg-bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
