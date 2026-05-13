'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Overview',
    href: '/admin/overview',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><circle cx="6" cy="5.5" r="2.5" /><path d="M1 14a5 5 0 0 1 10 0" /><circle cx="13" cy="5.5" r="2" /><path d="M13 8.5a3.5 3.5 0 0 1 2.5 3.5" /></svg>,
  },
  {
    label: 'Monitors',
    href: '/admin/monitors',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M5 14h6M8 11v3" /></svg>,
  },
  {
    label: 'Queues',
    href: '/admin/queues',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" /></svg>,
  },
  {
    label: 'Alerts',
    href: '/admin/alerts',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><path d="M3 6a5 5 0 1 1 10 0v3l1.5 2.5h-13L3 9V6z" /><path d="M6.5 13a1.5 1.5 0 0 0 3 0" /></svg>,
  },
  {
    label: 'Storage',
    href: '/admin/storage',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><ellipse cx="8" cy="4" rx="5" ry="2" /><path d="M3 4v4c0 1.1 2.2 2 5 2s5-.9 5-2V4" /><path d="M3 8v4c0 1.1 2.2 2 5 2s5-.9 5-2V8" /></svg>,
  },
  {
    label: 'Revenue',
    href: '/admin/revenue',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><path d="M2 12l3-4 3 2 3-5 3 3" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 14h12" /></svg>,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" /></svg>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    // Verify admin session
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(r => { if (!r.ok) router.replace('/admin/login'); })
      .catch(() => router.replace('/admin/login'))
      .finally(() => setChecking(false));

    // Check maintenance mode
    fetch('/api/admin/config/public')
      .then(r => r.json())
      .then((d: { maintenanceMode?: boolean }) => setMaintenance(d.maintenanceMode ?? false))
      .catch(() => {});
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/admin/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-soft">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-bg-soft text-foreground flex">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 bg-bg-card border-r border-line flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-line/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-red/20 border border-red/30 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-red" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z" />
                <path d="M8 5v4M8 11v.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-mono text-[14px] font-semibold tracking-tight">
              <span className="text-foreground">Admin</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-accent/8 text-accent-2 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.1)]'
                  : 'text-ink-3 hover:bg-bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          <div className="mt-auto pt-4 border-t border-line/50 flex flex-col gap-0.5">
            <Link
              href="/monitors"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-ink-4 hover:bg-bg-muted hover:text-foreground transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
                <path d="M10 8H2M5 5l-3 3 3 3" strokeLinecap="round" />
                <path d="M8 3h5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8" />
              </svg>
              User App
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-ink-4 hover:bg-red/10 hover:text-red transition-colors w-full"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
                <path d="M6 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M11 11l3-3-3-3M14 8H6" />
              </svg>
              Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Maintenance banner */}
        {maintenance && (
          <div className="bg-red/15 border-b border-red/30 px-6 py-2 text-[13px] text-red font-medium text-center">
            Maintenance mode is active — registration and manual checks are disabled.
          </div>
        )}

        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-6 bg-bg-card border-b border-[rgba(239,68,68,0.3)] shrink-0 sticky top-0 z-30">
          <span className="font-mono text-[13px] text-ink-4">
            SonarDiff <span className="text-foreground font-semibold">Admin</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-5">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={() => { setLastRefresh(new Date()); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-ink-4 text-[12.5px] hover:bg-bg-muted hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1280px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
