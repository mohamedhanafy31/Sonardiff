'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Plus, Search, Play, Trash2, Settings2, Activity, Loader2, CheckCircle, AlertCircle, X, Eye, Folder, Pause, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
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

type FilterType = 'all' | 'active' | 'paused';

interface MonitorGroup {
  id: string;
  name: string;
  baseUrl: string;
  memberCount: number;
  activeCount: number;
  createdAt: string;
}

export default function MonitorsPage() {
  const searchParams = useSearchParams();
  const [monitors, setMonitors] = useState<any[]>([]);
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [renamingGroup, setRenamingGroup] = useState<{ id: string; name: string } | null>(null);
  const itemsPerPage = 10;
  const { user } = useAuthStore();

  useEffect(() => {
    if (searchParams?.get('created') === '1') {
      showToast('success', 'Monitor created successfully!');
      window.history.replaceState({}, '', '/monitors');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchMonitors = async () => {
    try {
      const [m, g] = await Promise.all([
        api.get('/monitors'),
        api.get('/monitor-groups'),
      ]);
      setMonitors(m.data.monitors);
      setGroups(g.data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchMonitors();
  }, [user]);

  const togglePauseGroup = async (groupId: string, isActive: boolean) => {
    try {
      const { data } = await api.post(`/monitor-groups/${groupId}/pause`, { isActive });
      setMonitors(monitors.map(m => m.groupId === groupId ? { ...m, isActive } : m));
      setGroups(groups.map(g => g.id === groupId ? { ...g, activeCount: isActive ? g.memberCount : 0 } : g));
      showToast('success', `${data.updated} monitor${data.updated !== 1 ? 's' : ''} ${isActive ? 'resumed' : 'paused'}.`);
    } catch (e: any) {
      showToast('error', e.response?.data?.error || 'Failed to update group');
    }
  };

  const renameGroup = async (groupId: string, newName: string) => {
    try {
      await api.patch(`/monitor-groups/${groupId}`, { name: newName });
      setGroups(groups.map(g => g.id === groupId ? { ...g, name: newName } : g));
      setRenamingGroup(null);
      showToast('success', 'Group renamed.');
    } catch (e: any) {
      showToast('error', e.response?.data?.error || 'Failed to rename group');
    }
  };

  const deleteGroup = async (groupId: string) => {
    setIsDeleting(true);
    try {
      const { data } = await api.delete(`/monitor-groups/${groupId}`);
      setGroups(groups.filter(g => g.id !== groupId));
      setMonitors(monitors.filter(m => m.groupId !== groupId));
      showToast('success', `Group and ${data.deletedMonitors} monitor${data.deletedMonitors !== 1 ? 's' : ''} deleted.`);
    } catch (e: any) {
      showToast('error', e.response?.data?.error || 'Failed to delete group');
    } finally {
      setIsDeleting(false);
      setDeleteGroupId(null);
    }
  };

  const toggleGroupCollapsed = (id: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedGroups(next);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setMonitors(monitors.map(m => m.id === id ? { ...m, isActive: !currentStatus } : m));
      await api.patch(`/monitors/${id}`, { isActive: !currentStatus });
    } catch {
      fetchMonitors();
    }
  };

  const deleteMonitor = async (id: string) => {
    setIsDeleting(true);
    try {
      setMonitors(monitors.filter(m => m.id !== id));
      await api.delete(`/monitors/${id}`);
      showToast('success', 'Monitor deleted successfully.');
    } catch {
      fetchMonitors();
      showToast('error', 'Failed to delete monitor.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const filteredMonitors = monitors
    .filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.url.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(m => {
      if (filter === 'active') return m.isActive;
      if (filter === 'paused') return !m.isActive;
      return true;
    });

  const totalPages = Math.ceil(filteredMonitors.length / itemsPerPage);
  const paginatedMonitors = filteredMonitors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
  ];

  const runManualCheck = async (id: string) => {
    try {
      const { data } = await api.post(`/monitors/${id}/check`);
      showToast('success', data.message || 'Check enqueued successfully!');
      if (user) {
        useAuthStore.getState().setUser({
          ...user,
          manualChecksUsedThisPeriod: data.manualChecksUsedThisPeriod || (user.manualChecksUsedThisPeriod + 1)
        });
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to enqueue manual check');
    }
  };

  return (
    <div>
      {/* Delete monitor confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-white/[0.08] rounded-[16px] p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[15px] mb-2 text-foreground">Delete monitor?</h3>
            <p className="text-ink-4 text-[13px] mb-5 leading-relaxed">All diff history will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMonitor(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 h-9 bg-red hover:bg-red/90 text-white text-[13px] font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full pointer-events-auto">
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-[10px] shadow-xl text-[13px] border",
            toast.type === 'success'
              ? 'bg-green-bg border-green/25 text-green-ink'
              : 'bg-red-bg border-red/25 text-red-ink'
          )}>
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete group confirmation */}
      {deleteGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card border border-white/[0.08] rounded-[16px] p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[15px] mb-2 text-foreground">Delete group and all monitors?</h3>
            <p className="text-ink-4 text-[13px] mb-5 leading-relaxed">
              This will permanently delete{' '}
              <strong className="text-foreground">{groups.find(g => g.id === deleteGroupId)?.memberCount ?? 0} monitors</strong>{' '}
              and all their diff history.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteGroup(deleteGroupId)}
                disabled={isDeleting}
                className="flex-1 h-9 bg-red hover:bg-red/90 text-white text-[13px] font-semibold rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete group'}
              </button>
              <button onClick={() => setDeleteGroupId(null)} className="flex-1 btn ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="sd-header flex justify-between items-end flex-wrap gap-5 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">Monitors</h1>
          <p className="text-ink-4 text-[13px] mt-0.5">Track changes across your watched URLs.</p>
        </div>
        <Link href="/monitors/new" className="btn accent sm">
          <Plus className="w-3.5 h-3.5" />
          New monitor
        </Link>
      </div>

      {/* Groups */}
      {!loading && groups.length > 0 && (
        <div className="mb-5 space-y-1.5">
          <h2 className="text-[10.5px] uppercase tracking-[0.1em] text-ink-5 font-semibold mb-2 px-1">
            Groups
          </h2>
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            const groupMonitors = monitors.filter(m => m.groupId === group.id);
            const allActive = group.activeCount === group.memberCount && group.memberCount > 0;
            return (
              <div key={group.id} className="bg-bg-card border border-line rounded-[10px] overflow-hidden">
                <div className="px-4 py-2.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(group.id)}
                    className="text-ink-5 hover:text-ink-3 transition-colors"
                  >
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <Folder className="w-3.5 h-3.5 text-accent/70" />
                  {renamingGroup?.id === group.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={renamingGroup.name}
                      onChange={(e) => setRenamingGroup({ id: group.id, name: e.target.value })}
                      onBlur={() => renameGroup(group.id, renamingGroup.name.trim() || group.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameGroup(group.id, renamingGroup.name.trim() || group.name);
                        if (e.key === 'Escape') setRenamingGroup(null);
                      }}
                      className="h-6 px-2 border border-accent/40 rounded bg-bg-card text-[13px] font-medium text-foreground focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRenamingGroup({ id: group.id, name: group.name })}
                      className="text-[13px] font-medium text-foreground hover:text-accent transition-colors flex items-center gap-1.5 group"
                    >
                      {group.name}
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  <span className="pill text-[10.5px]">{group.memberCount} monitor{group.memberCount !== 1 ? 's' : ''}</span>
                  {group.activeCount > 0 && group.activeCount < group.memberCount && (
                    <span className="text-[11px] text-ink-5">({group.activeCount} active)</span>
                  )}
                  <span className="text-[11px] text-ink-5 font-mono truncate flex-1">{group.baseUrl}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePauseGroup(group.id, !allActive)}
                      className="p-1.5 text-ink-4 hover:text-foreground hover:bg-white/[0.05] rounded transition-colors"
                    >
                      {allActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteGroupId(group.id)}
                      className="p-1.5 text-ink-4 hover:text-red rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {!collapsed && groupMonitors.length > 0 && (
                  <div className="border-t border-white/[0.04] divide-y divide-white/[0.03]">
                    {groupMonitors.map((m) => (
                      <Link
                        key={m.id}
                        href={`/monitors/${m.id}`}
                        className="flex items-center gap-3 px-5 py-2 hover:bg-white/[0.025] transition-colors"
                      >
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          m.isActive ? 'bg-green sd-dot-live' : 'bg-ink-5'
                        )} />
                        <span className="text-[12.5px] text-foreground truncate flex-1">{m.name}</span>
                        <span className="text-[11px] text-ink-5 font-mono truncate max-w-[260px]">{m.url}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Monitor list */}
      <div className="bg-bg-card border border-line rounded-[12px] overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-5" />
            <input
              type="text"
              placeholder="Search monitors..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full h-8 pl-8 pr-3 border border-white/[0.08] rounded-md bg-white/[0.04] text-[13px] text-foreground placeholder:text-ink-5 focus:outline-none focus:border-accent/40 focus:ring-[2px] focus:ring-accent/12 transition-all"
            />
          </div>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
                className={cn(
                  'filter-pill text-[12px] h-8',
                  filter === f.key && 'active'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        {!loading && paginatedMonitors.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04] bg-white/[0.015]">
            <span className="flex-1 text-[10.5px] uppercase tracking-[0.09em] text-ink-5 font-semibold">Name</span>
            <span className="text-[10.5px] uppercase tracking-[0.09em] text-ink-5 font-semibold w-20 shrink-0 hidden md:block">Status</span>
            <span className="text-[10.5px] uppercase tracking-[0.09em] text-ink-5 font-semibold w-14 shrink-0 hidden lg:block">Freq</span>
            <span className="text-[10.5px] uppercase tracking-[0.09em] text-ink-5 font-semibold w-20 shrink-0 hidden lg:block">Checked</span>
            <span className="text-[10.5px] uppercase tracking-[0.09em] text-ink-5 font-semibold w-28 shrink-0 text-right">Actions</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          </div>
        ) : paginatedMonitors.length === 0 ? (
          <div className="text-center py-20 px-6">
            {searchQuery || filter !== 'all' ? (
              <>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-4">
                  <Search className="w-5 h-5 text-ink-4" />
                </div>
                <h3 className="text-[15px] font-semibold mb-1.5 text-foreground">No results</h3>
                <p className="text-ink-4 text-[13px] max-w-xs mx-auto">Try a different search or filter.</p>
                <button
                  onClick={() => { setSearchQuery(''); setFilter('all'); }}
                  className="btn ghost sm mt-4"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/[0.08] border border-accent/[0.14] mb-5">
                  <Activity className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-[16px] font-semibold mb-2 text-foreground">No monitors yet</h3>
                <p className="text-ink-4 text-[13px] max-w-sm mx-auto mb-5 leading-relaxed">Add your first monitor to start tracking website changes.</p>
                <Link href="/monitors/new" className="btn accent sm">
                  <Plus className="w-3.5 h-3.5" />
                  Add monitor
                </Link>
              </>
            )}
          </div>
        ) : (
          <div>
            {paginatedMonitors.map((monitor, i) => (
              <div
                key={monitor.id}
                className="sd-sweep flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors group"
                style={{ '--i': i } as React.CSSProperties}
              >
                {/* Status dot */}
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  monitor.isActive ? 'bg-green sd-dot-live' : 'bg-ink-5'
                )} />

                {/* Name + URL */}
                <div className="flex-1 min-w-0">
                  <Link href={`/monitors/${monitor.id}`} className="group/link block">
                    <div className="text-[13.5px] font-medium text-foreground group-hover/link:text-accent transition-colors leading-tight truncate">
                      {monitor.name}
                    </div>
                    <div className="text-[11.5px] text-ink-5 font-mono truncate mt-0.5">{monitor.url}</div>
                  </Link>
                </div>

                {/* Status pill */}
                <button
                  onClick={() => toggleStatus(monitor.id, monitor.isActive)}
                  className={cn('pill text-[11px] shrink-0 hidden md:inline-flex', monitor.isActive ? 'live' : 'paused')}
                >
                  <span className="dot" />
                  {monitor.isActive ? 'Active' : 'Paused'}
                </button>

                {/* Frequency */}
                <span className="text-[11.5px] text-ink-5 font-mono shrink-0 w-14 hidden lg:block">
                  {monitor.checkIntervalMinutes >= 60
                    ? `${monitor.checkIntervalMinutes / 60}h`
                    : `${monitor.checkIntervalMinutes}m`}
                </span>

                {/* Last checked */}
                <span
                  className="text-[11.5px] text-ink-5 font-mono shrink-0 w-20 hidden lg:block"
                  title={monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleString() : 'Never'}
                >
                  {relativeTime(monitor.lastCheckedAt)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0 w-28 justify-end">
                  <button
                    onClick={() => runManualCheck(monitor.id)}
                    disabled={user?.plan !== 'pro' || (user?.manualChecksUsedThisPeriod ?? 0) >= 50}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      user?.plan === 'pro' && (user?.manualChecksUsedThisPeriod ?? 0) < 50
                        ? "text-accent hover:bg-accent/[0.1]"
                        : "text-ink-5 opacity-30 cursor-not-allowed"
                    )}
                    title={user?.plan !== 'pro' ? 'Pro plan only' : (user?.manualChecksUsedThisPeriod ?? 0) >= 50 ? 'Limit reached' : 'Run check now'}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <Link
                    href={`/monitors/${monitor.id}`}
                    className="p-1.5 text-ink-4 hover:text-accent hover:bg-accent/[0.08] rounded transition-colors"
                    title="View diffs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/monitors/${monitor.id}/edit`}
                    className="p-1.5 text-ink-4 hover:text-foreground hover:bg-white/[0.06] rounded transition-colors"
                    title="Edit"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => setDeleteConfirmId(monitor.id)}
                    className="p-1.5 text-ink-4 hover:text-red hover:bg-red-bg rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredMonitors.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[11.5px] text-ink-5 font-mono">
              {totalPages > 1
                ? `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredMonitors.length)} of ${filteredMonitors.length}`
                : `${filteredMonitors.length} monitor${filteredMonitors.length !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="btn ghost sm disabled:opacity-30 h-7 text-[12px]"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="btn ghost sm disabled:opacity-30 h-7 text-[12px]"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
