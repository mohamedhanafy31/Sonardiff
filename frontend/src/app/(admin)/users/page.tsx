'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro';
  planLimit: number;
  checksUsedThisPeriod: number;
  periodResetAt: string;
  suspended: boolean;
  createdAt: string;
  monitorCount: number;
  activeMonitorCount: number;
};

type UsersResponse = { users: AdminUser[]; total: number; page: number; pages: number };

const TABS = ['all', 'free', 'pro', 'quota'] as const;
type Tab = typeof TABS[number];

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (tab !== 'all') params.set('plan', tab);
      if (search) params.set('search', search);
      setData(await adminApi.get<UsersResponse>(`/users?${params}`));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, tab, search]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Users</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">{data?.total ?? '—'} total users</p>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-5" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-card border border-line text-[13.5px] text-foreground placeholder:text-ink-5 focus:outline-none focus:border-accent/40"
          />
        </form>
        <div className="flex bg-bg-card border border-line rounded-lg p-0.5">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors',
                tab === t ? 'bg-accent/15 text-accent-2' : 'text-ink-4 hover:text-foreground')}>
              {t === 'quota' ? 'Quota Exceeded' : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
      ) : (
        <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-bg-soft">
                {['Name / Email', 'Plan', 'Monitors', 'Checks Used', 'Resets', 'Joined', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.users.map(u => {
                const quotaPct = Math.min((u.checksUsedThisPeriod / u.planLimit) * 100, 100);
                const daysLeft = Math.max(0, Math.ceil((new Date(u.periodResetAt).getTime() - Date.now()) / 86400000));
                return (
                  <tr key={u.id} className="border-b border-line/50 hover:bg-bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name}</div>
                      <div className="text-ink-4 text-[12px]">{u.email}</div>
                      {u.suspended && <span className="text-[10px] bg-red/15 text-red px-1.5 py-0.5 rounded-full">suspended</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-[11.5px] font-medium', u.plan === 'pro' ? 'bg-accent/15 text-accent-2' : 'bg-bg-muted text-ink-3')}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-3">{u.activeMonitorCount} / {u.monitorCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-line overflow-hidden">
                          <div className={cn('h-full rounded-full', quotaPct >= 90 ? 'bg-red' : 'bg-accent')} style={{ width: `${quotaPct}%` }} />
                        </div>
                        <span className="text-[12px] text-ink-4">{u.checksUsedThisPeriod} / {u.planLimit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-4 text-[12px]">in {daysLeft}d</td>
                    <td className="px-4 py-3 text-ink-4 text-[12px]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="px-3 py-1 rounded-lg border border-line text-[12px] text-ink-3 hover:bg-bg-muted hover:text-foreground transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {data?.users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-4">No users found</td></tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-line bg-bg-soft">
              <span className="text-[12px] text-ink-4">Page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-line text-ink-4 hover:bg-bg-muted disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                  className="p-1.5 rounded-lg border border-line text-ink-4 hover:bg-bg-muted disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
