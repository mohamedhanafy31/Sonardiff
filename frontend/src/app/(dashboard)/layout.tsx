'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Loader2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSearch } from '@/components/dashboard/GlobalSearch';
import { Logo } from '@/components/Logo';

const monitorNavItems = [
  {
    id: 'dashboard',
    label: 'Monitors',
    href: '/monitors',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <rect x="2" y="2" width="5" height="6" rx="1" />
        <rect x="9" y="2" width="5" height="4" rx="1" />
        <rect x="2" y="10" width="5" height="4" rx="1" />
        <rect x="9" y="8" width="5" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    label: 'Alerts',
    href: '/alerts',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <path d="M3 6a5 5 0 1 1 10 0v3l1.5 2.5h-13L3 9V6z" />
        <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'Snapshot history',
    href: '/history',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <path d="M3 8h10M3 4h10M3 12h10" />
      </svg>
    ),
  },
  {
    id: 'schedules',
    label: 'Schedules',
    href: '/schedules',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 1.5" />
      </svg>
    ),
  },
  {
    id: 'dom-picker',
    label: 'DOM Picker',
    href: '/dom-picker/preview',
    pro: true,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <path d="M3 3h10v10H3z" />
        <path d="M8 6v4M6 8h4" />
      </svg>
    ),
  },
];

const settingsNavItems = [
  {
    id: 'team',
    label: 'Team',
    href: '/team',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <circle cx="8" cy="6" r="2.5" />
        <path d="M3 14a5 5 0 0 1 10 0" />
      </svg>
    ),
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/billing',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <rect x="2" y="4" width="12" height="9" rx="1" />
        <path d="M2 7h12" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, logout, user } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [maintenanceBanner, setMaintenanceBanner] = useState<{ mode: boolean; message: string } | null>(null);

  useEffect(() => {
    checkAuth();
    fetch('/api/admin/config/public')
      .then(r => r.json())
      .then((d: { maintenanceMode?: boolean; maintenanceMessage?: string }) => {
        if (d.maintenanceMode) setMaintenanceBanner({ mode: true, message: d.maintenanceMessage ?? '' });
      })
      .catch(() => {});
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/monitors') return pathname === '/monitors' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const quotaUsed = user?.checksUsedThisPeriod ?? 0;
  const quotaLimit = user?.planLimit ?? 500;
  const quotaPercent = Math.min((quotaUsed / quotaLimit) * 100, 100);

  const manualQuotaUsed = user?.manualChecksUsedThisPeriod ?? 0;
  const manualQuotaLimit = 50;
  const manualQuotaPercent = Math.min((manualQuotaUsed / manualQuotaLimit) * 100, 100);

  const daysLeft = user?.periodResetAt
    ? Math.max(0, Math.ceil((new Date(user.periodResetAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="min-h-screen bg-background text-foreground flex relative flex-col">
      {maintenanceBanner?.mode && (
        <div className="bg-amber/[0.12] border-b border-amber/30 px-6 py-2.5 text-[13px] text-amber font-medium text-center shrink-0">
          Maintenance in progress — some features are temporarily unavailable.
          {maintenanceBanner.message && ` ${maintenanceBanner.message}`}
        </div>
      )}
      <div className="flex flex-1 min-h-0 relative">
        <GlobalSearch />

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-[248px] bg-sd-chrome border-r border-white/[0.06] flex flex-col transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 shrink-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Brand */}
          <div className="px-5 pt-6 pb-4 shrink-0">
            <Logo className="h-6" />
          </div>

          {/* Workspace */}
          <div className="flex items-center gap-2.5 px-3 py-2 mx-2 mb-3 rounded-lg hover:bg-white/[0.04] transition-colors cursor-default shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-cyan-300 text-[#042F36] font-bold text-[12px] flex items-center justify-center shrink-0">
              {userInitials[0] || 'N'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-dark-ink-2 truncate leading-tight" title={user?.name || ''}>
                {user?.name || 'Workspace'}
              </div>
              <div className="text-[11px] text-dark-ink-3 capitalize">{user?.plan} plan</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-1 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
            {monitorNavItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors shrink-0",
                  isActive(item.href)
                    ? "bg-accent/[0.15] text-accent [&_svg]:text-accent"
                    : "text-dark-ink [&_svg]:text-dark-ink-3 hover:bg-white/[0.04] hover:text-dark-ink-2"
                )}
              >
                {item.icon}
                {item.label}
                {item.pro && (
                  <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.06em] text-accent/60 border border-accent/20 rounded-full px-1.5 py-0.5">
                    Pro
                  </span>
                )}
              </Link>
            ))}

            <div className="text-[10px] uppercase tracking-[0.1em] text-dark-ink-3 font-semibold px-3 pt-5 pb-1.5 shrink-0">
              Settings
            </div>
            {settingsNavItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors shrink-0",
                  isActive(item.href)
                    ? "bg-accent/[0.15] text-accent [&_svg]:text-accent"
                    : "text-dark-ink [&_svg]:text-dark-ink-3 hover:bg-white/[0.04] hover:text-dark-ink-2"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            <div className="mt-auto pt-3 pb-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-dark-ink-3 hover:bg-white/[0.04] hover:text-red transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
                  <path d="M6 2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M11 11l3-3-3-3M14 8H6" />
                </svg>
                Sign out
              </button>
            </div>
          </nav>

          {/* Quota */}
          <div className="px-3 pb-5 pt-3 shrink-0 border-t border-white/[0.06] flex flex-col gap-2.5">
            <div className="rounded-[8px] p-3 bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] uppercase tracking-[0.08em] text-dark-ink-3 font-semibold">Quota</span>
                {daysLeft > 0 && (
                  <span className="text-[10px] text-dark-ink-3">Resets in {daysLeft}d</span>
                )}
              </div>
              <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    quotaPercent >= 90 ? "bg-red" : quotaPercent >= 70 ? "bg-amber" : "bg-accent"
                  )}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="font-mono text-[11px] text-dark-ink-3 flex justify-between">
                <span><span className="text-dark-ink-2 font-medium">{quotaUsed.toLocaleString()}</span> used</span>
                <span>{quotaLimit.toLocaleString()}</span>
              </div>
            </div>

            <div className="rounded-[8px] p-3 bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] uppercase tracking-[0.08em] text-dark-ink-3 font-semibold">Manual checks</span>
                {user?.plan !== 'pro' && (
                  <span className="text-[9.5px] text-accent/60 border border-accent/20 rounded-full px-1.5 py-0.5">Pro</span>
                )}
              </div>
              <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden mb-2">
                <div
                  className="h-full bg-accent-2 rounded-full transition-all duration-500"
                  style={{ width: user?.plan === 'pro' ? `${manualQuotaPercent}%` : '0%' }}
                />
              </div>
              <div className="font-mono text-[11px] text-dark-ink-3 flex justify-between">
                <span>
                  <span className="text-dark-ink-2 font-medium">
                    {user?.plan === 'pro' ? manualQuotaUsed : '0'}
                  </span> used
                </span>
                <span>{manualQuotaLimit}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Mobile header */}
          <header className="h-13 flex items-center justify-between px-4 border-b border-white/[0.06] bg-sd-chrome z-30 sticky top-0 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-dark-ink-3 hover:text-dark-ink"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Logo className="h-6" />
            <div className="w-9" />
          </header>

          <div className="flex-1 overflow-y-auto py-8 px-5 md:px-10">
            <div className="max-w-[1160px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
