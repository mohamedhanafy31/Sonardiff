'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Loader2, Search, Plus, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscoveredUrl {
  url: string;
  path: string;
  title?: string;
  lastmod?: string;
  source: 'sitemap' | 'html' | 'playwright';
}

interface DiscoveryResult {
  baseUrl: string;
  hostname: string;
  urls: DiscoveredUrl[];
  sitemapFound: boolean;
  fallbackUsed: 'none' | 'html' | 'playwright';
  totalDiscovered: number;
}

interface Props {
  url: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Live-updated quota counter: (selectedCount) → JSX shown above the list */
  quotaSummary?: React.ReactNode;
}

type PollState =
  | { kind: 'idle' }
  | { kind: 'pending'; message: string }
  | { kind: 'done'; result: DiscoveryResult }
  | { kind: 'failed'; error: string };

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;

export function DiscoveryStep({ url, selected, onChange, quotaSummary }: Props) {
  const [state, setState] = useState<PollState>({ kind: 'idle' });
  const [filter, setFilter] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualUrls, setManualUrls] = useState<DiscoveredUrl[]>([]);
  const [collapsedPrefixes, setCollapsedPrefixes] = useState<Set<string>>(new Set());
  const lastUrlRef = useRef<string | null>(null);

  // Trigger discovery when url changes
  useEffect(() => {
    if (!url || url === lastUrlRef.current) return;
    lastUrlRef.current = url;
    void runDiscovery(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const runDiscovery = async (target: string) => {
    setState({ kind: 'pending', message: 'Starting discovery…' });
    setManualUrls([]);
    onChange(new Set());
    let jobId: string | null = null;
    try {
      const { data } = await api.post('/monitors/discover', { url: target });
      jobId = data.jobId;
    } catch (e: any) {
      setState({ kind: 'failed', error: e.response?.data?.error || 'Failed to start discovery' });
      return;
    }

    const start = Date.now();
    while (Date.now() - start < POLL_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const { data } = await api.get(`/monitors/discover/${jobId}`);
        if (data.status === 'done') {
          setState({ kind: 'done', result: data.result });
          // Pre-select the base URL by default
          const base = data.result.urls.find((u: DiscoveredUrl) => u.path === '/' || u.url === data.result.baseUrl);
          onChange(new Set(base ? [base.url] : []));
          return;
        }
        if (data.status === 'failed') {
          setState({ kind: 'failed', error: data.error || 'Discovery failed' });
          return;
        }
        setState({ kind: 'pending', message: data.progress?.message || 'Working…' });
      } catch (e: any) {
        setState({ kind: 'failed', error: e.response?.data?.error || 'Lost connection to server' });
        return;
      }
    }
    setState({ kind: 'failed', error: 'Discovery timed out after 90 seconds' });
  };

  const allUrls = useMemo(() => {
    const seen = new Set<string>();
    const merged: DiscoveredUrl[] = [];
    if (state.kind === 'done') {
      for (const u of state.result.urls) { if (!seen.has(u.url)) { merged.push(u); seen.add(u.url); } }
    }
    for (const u of manualUrls) { if (!seen.has(u.url)) { merged.push(u); seen.add(u.url); } }
    return merged;
  }, [state, manualUrls]);

  // Group by top-level path prefix
  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = f
      ? allUrls.filter(u => u.path.toLowerCase().includes(f) || (u.title || '').toLowerCase().includes(f))
      : allUrls;
    const out = new Map<string, DiscoveredUrl[]>();
    for (const u of filtered) {
      const seg = u.path === '/' ? '/' : '/' + (u.path.split('/').filter(Boolean)[0] || '');
      if (!out.has(seg)) out.set(seg, []);
      out.get(seg)!.push(u);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allUrls, filter]);

  const toggle = (url: string) => {
    const next = new Set(selected);
    if (next.has(url)) next.delete(url); else next.add(url);
    onChange(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    for (const [, items] of grouped) for (const u of items) next.add(u.url);
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  const togglePrefix = (prefix: string) => {
    const next = new Set(collapsedPrefixes);
    if (next.has(prefix)) next.delete(prefix); else next.add(prefix);
    setCollapsedPrefixes(next);
  };

  const togglePrefixSelection = (items: DiscoveredUrl[]) => {
    const allSelected = items.every(u => selected.has(u.url));
    const next = new Set(selected);
    if (allSelected) {
      for (const u of items) next.delete(u.url);
    } else {
      for (const u of items) next.add(u.url);
    }
    onChange(next);
  };

  const addManualUrl = () => {
    setManualError(null);
    const raw = manualUrl.trim();
    if (!raw) return;
    let normalized: string;
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      normalized = u.toString();
    } catch {
      setManualError('Not a valid URL');
      return;
    }
    if (allUrls.some(u => u.url === normalized)) {
      setManualError('Already in the list');
      return;
    }
    let path = '/';
    try { path = new URL(normalized).pathname || '/'; } catch {}
    const entry: DiscoveredUrl = { url: normalized, path, source: 'html', title: 'Manually added' };
    setManualUrls(prev => [...prev, entry]);
    onChange(new Set([...selected, normalized]));
    setManualUrl('');
  };

  if (state.kind === 'idle' || state.kind === 'pending') {
    return (
      <div className="bg-bg-card border border-line rounded-[14px] p-10 flex flex-col items-center justify-center min-h-[320px]">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
        <h3 className="text-[15px] font-semibold mb-1.5">Discovering pages…</h3>
        <p className="text-ink-3 text-[13px] mb-1">{state.kind === 'pending' ? state.message : 'Starting…'}</p>
        <p className="text-ink-4 text-[12px]">This usually takes 5–30 seconds.</p>
      </div>
    );
  }

  if (state.kind === 'failed') {
    return (
      <div className="bg-bg-card border border-line rounded-[14px] p-8 flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-12 h-12 rounded-full bg-red-bg flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-red" />
        </div>
        <h3 className="text-[15px] font-semibold mb-1.5">Discovery failed</h3>
        <p className="text-ink-3 text-[13px] mb-4 text-center max-w-md">{state.error}</p>
        <button
          type="button"
          onClick={() => runDiscovery(url)}
          className="btn ghost sm flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
        <p className="text-ink-4 text-[12px] mt-4">You can also add URLs manually below.</p>
        <ManualUrlInput
          value={manualUrl}
          onChange={setManualUrl}
          onAdd={addManualUrl}
          error={manualError}
        />
      </div>
    );
  }

  // state.kind === 'done'
  const r = state.result;
  return (
    <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold flex items-center gap-2">
            Found {r.urls.length} page{r.urls.length !== 1 ? 's' : ''} on {r.hostname}
          </h3>
          <p className="text-[12px] text-ink-4 mt-0.5">
            {r.sitemapFound
              ? 'From sitemap.'
              : r.fallbackUsed === 'html'
                ? 'No sitemap — read links from homepage HTML.'
                : r.fallbackUsed === 'playwright'
                  ? 'No sitemap — rendered the page in a browser to find links.'
                  : 'Limited results — try adding URLs manually.'}
            {r.totalDiscovered > r.urls.length && ` (${r.totalDiscovered} total, capped at ${r.urls.length})`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => runDiscovery(url)}
          className="btn ghost sm flex items-center gap-1.5 text-[12px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-scan
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 bg-bg-soft border-b border-line flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4" />
          <input
            type="text"
            placeholder="Filter by path or title…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full h-8 pl-8 pr-3 border border-line rounded-md bg-bg-card text-[12.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[2px] focus:ring-accent/20 transition-all"
          />
        </div>
        <div className="text-[12px] text-ink-4">
          <span className="text-foreground font-medium">{selected.size}</span> selected
        </div>
        <button type="button" onClick={selectAllVisible} className="text-accent-2 text-[12px] font-medium hover:underline">
          Select all visible
        </button>
        {selected.size > 0 && (
          <button type="button" onClick={clearAll} className="text-ink-4 text-[12px] hover:text-ink-2">
            Clear
          </button>
        )}
      </div>

      {/* Quota summary */}
      {quotaSummary && (
        <div className="px-5 py-3 border-b border-line bg-accent/4">
          {quotaSummary}
        </div>
      )}

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="text-center py-12 text-ink-4 text-[13px]">No pages match your filter.</div>
        ) : (
          grouped.map(([prefix, items]) => {
            const collapsed = collapsedPrefixes.has(prefix);
            const allSelected = items.every(u => selected.has(u.url));
            const someSelected = items.some(u => selected.has(u.url));
            return (
              <div key={prefix} className="border-b border-line-soft last:border-b-0">
                <div className="flex items-center gap-2 px-5 py-2 bg-bg-soft/50 sticky top-0 z-[1]">
                  <button
                    type="button"
                    onClick={() => togglePrefix(prefix)}
                    className="text-ink-4 hover:text-ink-2 transition-colors"
                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                  >
                    <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', !collapsed && 'rotate-90')} />
                  </button>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={() => togglePrefixSelection(items)}
                    className="w-3.5 h-3.5 accent-accent rounded"
                    aria-label={`Toggle all ${prefix}`}
                  />
                  <code className="text-[12px] font-mono text-ink-2 font-semibold">{prefix}</code>
                  <span className="text-[11px] text-ink-4">
                    {items.length} page{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {!collapsed && items.map((u) => (
                  <label
                    key={u.url}
                    className="flex items-start gap-3 px-5 py-2.5 hover:bg-bg-soft/40 cursor-pointer border-t border-line-soft transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.url)}
                      onChange={() => toggle(u.url)}
                      className="w-3.5 h-3.5 mt-0.5 accent-accent rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate flex items-center gap-2">
                        {u.title || u.path}
                        {u.source === 'html' && u.title === 'Manually added' && (
                          <span className="pill text-[10px] bg-accent/15 text-accent-2 border-accent/30">Manual</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-4 font-mono truncate">{u.url}</div>
                    </div>
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Manual URL input */}
      <div className="px-5 py-3 border-t border-line bg-bg-soft">
        <ManualUrlInput
          value={manualUrl}
          onChange={setManualUrl}
          onAdd={addManualUrl}
          error={manualError}
        />
      </div>
    </div>
  );
}

function ManualUrlInput({
  value, onChange, onAdd, error,
}: { value: string; onChange: (v: string) => void; onAdd: () => void; error: string | null }) {
  return (
    <div>
      <label className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-4 mb-1.5 block">
        Add a URL manually
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
          placeholder="https://acme.com/some/page"
          className="flex-1 h-9 px-3 border border-line rounded-md bg-bg-card text-[12.5px] font-mono text-foreground focus:outline-none focus:border-accent focus:ring-[2px] focus:ring-accent/20 transition-all"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!value.trim()}
          className="btn ghost sm text-[12px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      {error && <p className="text-red-ink text-[11.5px] mt-1.5">{error}</p>}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
