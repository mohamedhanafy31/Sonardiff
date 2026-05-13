'use client';

import { useAuthStore } from '@/lib/store';
import Link from 'next/link';

export default function BillingPage() {
  const { user } = useAuthStore();

  const quotaUsed = user?.checksUsedThisPeriod ?? 0;
  const quotaLimit = user?.planLimit ?? 500;
  const quotaPercent = Math.min((quotaUsed / quotaLimit) * 100, 100);
  const dailyAvg = quotaUsed > 0 ? Math.round(quotaUsed / 12) : 0; // approximate
  const projected = Math.round(dailyAvg * 30);

  const daysLeft = user?.periodResetAt
    ? Math.max(0, Math.ceil((new Date(user.periodResetAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const nextInvoice = user?.periodResetAt
    ? new Date(user.periodResetAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'N/A';

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Billing</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">Transparent quotas, no surprise overages.</div>
        </div>
        <div className="flex gap-2">
          <Link href="/settings" className="btn ghost sm">Compare plans</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Plan card */}
          <div className="bg-bg-card border border-line rounded-[14px] p-5">
            <div className="flex gap-5 items-center">
              <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-accent to-cyan-700 text-white font-display text-2xl font-semibold flex items-center justify-center shrink-0">
                {user?.plan === 'pro' ? 'P' : 'F'}
              </div>
              <div className="flex-1">
                <div className="font-display text-[22px] font-semibold tracking-tight capitalize">{user?.plan} plan</div>
                <div className="text-[13px] text-ink-3 font-mono mt-0.5">
                  <span className="font-medium text-foreground">{user?.plan === 'pro' ? '$29' : '$0'}</span> / month
                  · {quotaLimit.toLocaleString()} checks
                </div>
                {user?.periodResetAt && (
                  <div className="text-[12.5px] text-ink-4 mt-1">
                    Next invoice <strong className="text-foreground">{nextInvoice}</strong>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn ghost sm">Change plan</button>
              </div>
            </div>
          </div>

          {/* Usage */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Usage · this billing cycle</h3>
              <span className="text-xs text-ink-4 font-mono">{daysLeft} days left</span>
            </div>

            {/* Usage bar */}
            <div className="px-5 py-5">
              <div className="h-3 rounded-full bg-bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-cyan-300 rounded-full transition-all duration-500"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-t border-line">
              <div className="px-5 py-4 border-r border-line">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Used</div>
                <div className="font-display text-[26px] font-semibold tracking-tight mt-1 leading-none">{quotaUsed.toLocaleString()}</div>
                <div className="text-xs text-ink-4 mt-1">of {quotaLimit.toLocaleString()} checks</div>
              </div>
              <div className="px-5 py-4 border-r border-line">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Projected</div>
                <div className="font-display text-[26px] font-semibold tracking-tight mt-1 leading-none">{projected.toLocaleString()}</div>
                <div className={`text-xs mt-1 ${projected <= quotaLimit ? 'text-green-ink' : 'text-red-ink'}`}>
                  {projected <= quotaLimit ? '✓ within cap' : '⚠ may exceed cap'}
                </div>
              </div>
              <div className="px-5 py-4 border-r border-line">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Daily average</div>
                <div className="font-display text-[26px] font-semibold tracking-tight mt-1 leading-none">{dailyAvg}</div>
                <div className="text-xs text-ink-4 mt-1">last 7 days</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Overage charges</div>
                <div className="font-display text-[26px] font-semibold tracking-tight mt-1 leading-none">$0.00</div>
                <div className="text-xs text-ink-4 mt-1">we&apos;d email you first</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Overage policy */}
          <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Overage policy</h3>
            </div>
            <div className="p-5 text-[13px] text-ink-3 leading-relaxed space-y-2.5">
              <p><strong className="text-foreground">Soft cap.</strong> If you hit your limit before cycle-end, we email you and pause the lowest-priority monitor.</p>
              <p><strong className="text-foreground">No silent charges.</strong> We never auto-upgrade your plan.</p>
              <p className="text-green-ink text-[12.5px]">✓ No overage charges this year.</p>
            </div>
          </div>

          {/* Upsell */}
          {user?.plan === 'free' && (
            <div className="bg-gradient-to-br from-dark-bg to-[#13212B] text-white rounded-[14px] p-6">
              <h4 className="font-display text-[18px] font-semibold tracking-tight mb-1.5">Upgrade to Pro</h4>
              <p className="text-[13px] text-dark-ink-3 leading-relaxed mb-4">
                Get 10,000 checks/month, hourly monitoring, element targeting, and exclusion rules for $29/mo.
              </p>
              <button className="btn accent">See Pro →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
