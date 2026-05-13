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

  // Show success toast when redirected from wizard with ?created=1
  useEffect(() => {
    if (searchParams?.get('created') === '1') {
      showToast('success', 'Monitor created successfully!');
      // Clean the query param from the URL without reloading
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

  // ── Group actions ──
  const togglePauseGroup = async (groupId: string, isActive: boolean) => {
    try {
      const { data } = await api.post(`/monitor-groups/${groupId}/pause`, { isActive });
      // Optimistic UI
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
      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-bg-card border border-line rounded-[16px] p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[16px] mb-2">Delete monitor?</h3>
            <p className="text-ink-3 text-[13.5px] mb-5">All diff history will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMonitor(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 h-10 bg-red hover:bg-red/90 text-white text-[13.5px] font-semibold rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete monitor'}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 btn ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification — fixed floating */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full pointer-events-auto">
          <div className={`flex items-center gap-3 px-4 py-3.5 rounded-[12px] shadow-xl text-sm border backdrop-blur-sm ${
            toast.type === 'success'
              ? 'bg-green-bg border-green/25 text-green-ink'
              : 'bg-red-bg border-red/25 text-red-ink'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete-group confirmation */}
      {deleteGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-bg-card border border-line rounded-[16px] p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-[16px] mb-2">Delete group and all its monitors?</h3>
            <p className="text-ink-3 text-[13.5px] mb-5">
              This will permanently delete{' '}
              <strong>{groups.find(g => g.id === deleteGroupId)?.memberCount ?? 0} monitors</strong>{' '}
              and all their diff history. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteGroup(deleteGroupId)}
                disabled={isDeleting}
                className="flex-1 h-10 bg-red hover:bg-red/90 text-white text-[13.5px] font-semibold rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete group'}
              </button>
              <button onClick={() => setDeleteGroupId(null)} className="flex-1 btn ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page head */}
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Monitors</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">Manage your tracked websites and configuration.</div>
        </div>
        <Link href="/monitors/new" className="btn accent">
          <Plus className="w-4 h-4" />
          Add monitor
        </Link>
      </div>

      {/* Groups section */}
      {!loading && groups.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-[12px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-2">
            Groups ({groups.length})
          </h2>
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.id);
            const groupMonitors = monitors.filter(m => m.groupId === group.id);
            const allActive = group.activeCount === group.memberCount && group.memberCount > 0;
            return (
              <div key={group.id} className="bg-bg-card border border-line rounded-[12px] overflow-hidden">
                <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(group.id)}
                    className="text-ink-4 hover:text-ink-2 transition-colors"
                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                  >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <Folder className="w-4 h-4 text-accent-2" />
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
                      className="h-7 px-2 border border-accent rounded-md bg-bg-card text-[13.5px] font-medium text-foreground focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRenamingGroup({ id: group.id, name: group.name })}
                      className="text-[13.5px] font-medium text-foreground hover:text-accent-2 transition-colors flex items-center gap-1.5 group"
                      title="Rename"
                    >
                      {group.name}
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  <span className="pill text-[11px]">
                    {group.memberCount} monitor{group.memberCount !== 1 ? 's' : ''}
                  </span>
                  {group.activeCount > 0 && group.activeCount < group.memberCount && (
                    <span className="text-[11px] text-ink-4">
                      ({group.activeCount} active)
                    </span>
                  )}
                  <span className="text-[11.5px] text-ink-4 font-mono truncate flex-1">{group.baseUrl}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePauseGroup(group.id, !allActive)}
                      className="p-1.5 text-ink-4 hover:text-foreground hover:bg-bg-soft rounded-md transition-colors"
                      title={allActive ? 'Pause all in group' : 'Resume all in group'}
                    >
                      {allActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteGroupId(group.id)}
                      className="p-1.5 text-ink-4 hover:text-red hover:bg-red-bg rounded-md transition-colors"
                      title="Delete group + all monitors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {!collapsed && groupMonitors.length > 0 && (
                  <div className="border-t border-line-soft bg-bg-soft/30 divide-y divide-line-soft">
                    {groupMonitors.map((m) => (
                      <Link
                        key={m.id}
                        href={`/monitors/${m.id}`}
                        className="flex items-center gap-3 px-5 py-2 hover:bg-bg-soft/60 transition-colors"
                      >
                        <span className={cn('pill text-[10px]', m.isActive ? 'live' : 'paused')}>
                          <span className="dot" />
                          {m.isActive ? 'Active' : 'Paused'}
                        </span>
                        <span className="text-[12.5px] text-foreground truncate flex-1">{m.name}</span>
                        <span className="text-[11px] text-ink-4 font-mono truncate max-w-[280px]">{m.url}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-line flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
            <input
              type="text"
              placeholder="Search monitors..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 pl-9 pr-3 border border-line rounded-lg bg-bg-card text-[13.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
            />
          </div>
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
                className={cn('filter-pill', filter === f.key && 'active')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : paginatedMonitors.length === 0 ? (
          <div className="text-center py-20 px-6">
            {searchQuery || filter !== 'all' ? (
              <>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bg-muted border border-line mb-4">
                  <Search className="w-6 h-6 text-ink-4" />
                </div>
                <h3 className="text-[16px] font-semibold mb-2">No results found</h3>
                <p className="text-ink-3 text-[14px] max-w-xs mx-auto">Try adjusting your search or filters.</p>
                <button
                  onClick={() => { setSearchQuery(''); setFilter('all'); }}
                  className="btn ghost sm mt-4"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/8 border border-accent/15 mb-5">
                  <Activity className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-[17px] font-semibold mb-2">No monitors yet</h3>
                <p className="text-ink-3 text-[14px] max-w-sm mx-auto mb-5">Add your first monitor to start tracking website changes automatically.</p>
                <Link href="/monitors/new" className="btn accent">
                  <Plus className="w-4 h-4" />
                  Add your first monitor
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="bg-bg-soft text-ink-4 text-[11.5px] uppercase tracking-[0.08em] font-semibold">
                  <th className="px-5 py-2.5">Name / URL</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Frequency</th>
                  <th className="px-5 py-2.5">Last checked</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMonitors.map((monitor) => (
                  <tr key={monitor.id} className="border-t border-line-soft hover:bg-bg-soft/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/monitors/${monitor.id}`} className="group">
                        <div className="font-medium text-foreground group-hover:text-accent-2 transition-colors">{monitor.name}</div>
                        <div className="text-xs text-ink-4 font-mono truncate max-w-[280px] mt-0.5">{monitor.url}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleStatus(monitor.id, monitor.isActive)}
                        className={cn('pill text-[11px]', monitor.isActive ? 'live' : 'paused')}
                      >
                        <span className="dot" />
                        {monitor.isActive ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-ink-3 font-mono text-xs">
                      {monitor.checkIntervalMinutes >= 60
                        ? `Every ${monitor.checkIntervalMinutes / 60}h`
                        : `Every ${monitor.checkIntervalMinutes}m`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="text-ink-4 text-xs font-mono cursor-default"
                        title={monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleString() : 'Never checked'}
                      >
                        {relativeTime(monitor.lastCheckedAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => runManualCheck(monitor.id)}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            user?.plan === 'pro' && (user?.manualChecksUsedThisPeriod ?? 0) < 50
                              ? "text-accent-2 hover:bg-accent/8"
                              : "text-ink-5 cursor-not-allowed opacity-40"
                          )}
                          title={user?.plan !== 'pro' ? 'Pro plan only' : (user?.manualChecksUsedThisPeriod ?? 0) >= 50 ? 'Monthly manual check limit reached' : 'Check now'}
                          disabled={user?.plan !== 'pro' || (user?.manualChecksUsedThisPeriod ?? 0) >= 50}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <Link
                          href={`/monitors/${monitor.id}`}
                          className="p-1.5 text-ink-4 hover:text-accent hover:bg-accent/8 rounded-md transition-colors"
                          title="View diffs"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/monitors/${monitor.id}/edit`}
                          className="p-1.5 text-ink-4 hover:text-foreground hover:bg-bg-soft rounded-md transition-colors"
                          title="Edit"
                        >
                          <Settings2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirmId(monitor.id)}
                          className="p-1.5 text-ink-4 hover:text-red hover:bg-red-bg rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredMonitors.length > 0 && (
          <div className="px-5 py-3 border-t border-line flex items-center justify-between">
            <p className="text-xs text-ink-4">
              {totalPages > 1
                ? `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredMonitors.length)} of ${filteredMonitors.length}`
                : `${filteredMonitors.length} monitor${filteredMonitors.length !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="btn ghost sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="btn ghost sm disabled:opacity-40"
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
