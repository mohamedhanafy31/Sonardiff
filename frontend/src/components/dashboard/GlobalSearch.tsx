'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Search, Loader2, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    const searchMonitors = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get('/monitors');
        const filtered = data.monitors.filter((m: any) => 
          m.name.toLowerCase().includes(query.toLowerCase()) || 
          m.url.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchMonitors, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm">
      <div 
        className="fixed inset-0" 
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-xl bg-bg-card border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-line flex items-center gap-3">
          <Search className="w-5 h-5 text-ink-4" />
          <input 
            autoFocus
            type="text"
            placeholder="Search monitors (Cmd+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-foreground focus:outline-none placeholder:text-ink-4"
          />
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
          <div className="text-[10px] font-bold text-ink-4 bg-bg-muted px-1.5 py-0.5 rounded border border-line">ESC</div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length < 2 ? (
            <div className="p-8 text-center text-ink-4 text-sm">
              Type at least 2 characters to search...
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-ink-4 text-sm">
              No monitors found matching "{query}"
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((monitor) => (
                <button
                  key={monitor.id}
                  onClick={() => {
                    router.push(`/monitors/${monitor.id}`);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-soft text-left transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-bg-muted group-hover:bg-accent/10 group-hover:text-accent-2 transition-colors">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{monitor.name}</p>
                    <p className="text-xs text-ink-4 truncate">{monitor.url}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 bg-bg-soft border-t border-line flex items-center justify-between text-[10px] text-ink-4 font-medium">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="bg-bg-muted px-1 rounded border border-line">↑↓</span> to navigate</span>
            <span className="flex items-center gap-1"><span className="bg-bg-muted px-1 rounded border border-line">↵</span> to select</span>
          </div>
          <span className="flex items-center gap-1">Search results are limited to monitors</span>
        </div>
      </div>
    </div>
  );
}
