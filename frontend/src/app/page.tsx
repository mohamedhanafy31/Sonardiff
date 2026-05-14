'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

const examples = [
  {
    type: 'Pricing',
    addr: 'competitor.com/pricing',
    title: 'Pro plan',
    oldVal: '$49',
    newVal: '$39',
    detail: '10 seats',
    oldDetail: '5 seats',
  },
  {
    type: 'Inventory',
    addr: 'store.com/rtx-5090',
    title: 'RTX 5090 Founders Edition',
    oldVal: 'Out of stock',
    newVal: 'In stock',
    detail: 'Limit 1 per customer',
    oldDetail: 'Notify when available',
  },
  {
    type: 'Features',
    addr: 'saas.io/roadmap',
    title: 'Upcoming features',
    oldVal: 'Q4 2025',
    newVal: 'Live now',
    detail: 'SSO & Audit logs',
    oldDetail: 'Waitlist only',
  },
];

function MovingExamples() {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % examples.length);
        setAnimating(false);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const ex = examples[idx];

  return (
    <div className="mt-14 max-w-[480px] mx-auto">
      <div className={cn(
        'frame transition-all duration-400',
        animating ? 'opacity-0 scale-[0.97]' : 'opacity-100 scale-100'
      )}>
        <div className="frame-bar">
          <div className="dots"><span /><span /><span /></div>
          <div className="addr">{ex.addr}</div>
          <span className="pill live text-[11px]"><span className="dot" />Monitored</span>
        </div>
        <div className="p-6 text-left">
          <div className="text-[11px] uppercase tracking-[0.12em] text-accent font-semibold mb-3">{ex.type}</div>
          <div className="font-display text-[21px] font-semibold tracking-tight text-foreground mb-2">{ex.title}</div>
          <div className="text-[19px] font-display font-semibold tracking-tight">
            <span className="diff-del">{ex.oldVal}</span>{' '}
            <span className="diff-add">{ex.newVal}</span>
          </div>
          <div className="text-[13px] text-ink-3 mt-1.5">
            <span className="diff-del">{ex.oldDetail}</span>{' '}
            <span className="diff-add">{ex.detail}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    num: '01',
    title: 'Headless browser rendering',
    desc: 'Every page is rendered in a real Chromium instance. JavaScript, SPAs, dynamic content — all captured faithfully, not guessed.',
  },
  {
    num: '02',
    title: 'Quota math you can verify',
    desc: 'Before you save a monitor, we show exactly how many checks it will burn per month. No overages, no surprises.',
  },
  {
    num: '03',
    title: 'Visual element targeting',
    desc: 'Point and click to select the exact section of a page to watch. Only track the pricing table, not the cookie banner.',
  },
  {
    num: '04',
    title: 'Exclusion rules',
    desc: 'Filter out noise with keyword and regex exclusion rules. Ignore timestamps, session tokens, and ad rotations.',
  },
];

const steps = [
  { num: '01', title: 'Paste a URL', desc: 'Enter any page — we render it in a headless browser.' },
  { num: '02', title: 'Pick what to watch', desc: 'Select a CSS element or let us track the full page.' },
  { num: '03', title: 'Set your cadence', desc: 'Choose how often to check. We show the quota impact in real time.' },
  { num: '04', title: 'Get alerted', desc: 'Email or webhook — with the exact diff attached.' },
  { num: '05', title: 'Review diffs', desc: 'See red/green text diffs and before/after snapshots.' },
];

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    features: ['500 checks/mo', '5 monitors', 'Email alerts', 'Full diff history'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    features: ['10k checks/mo', '50 monitors', 'Hourly checks', 'DOM element picker'],
    highlight: true,
  },
  {
    name: 'Business',
    price: '$129',
    period: '/mo',
    features: ['100k checks/mo', 'Unlimited monitors', 'Priority scraping', 'Slack + webhooks'],
    highlight: false,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    const sweepTargets = document.querySelectorAll('[data-sweep]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.setProperty('--i', String(idx));
            entry.target.classList.add('sd-sweep');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    sweepTargets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-background/90 backdrop-blur-[16px] border-b border-white/[0.06]">
        <div className="max-w-[1160px] mx-auto px-7 flex items-center gap-6 h-15">
          <Link href="/" className="shrink-0">
            <Logo className="h-6" />
          </Link>
          <div className="hidden md:flex items-center gap-0.5 ml-2">
            <Link href="#features" className="px-3 py-2 rounded-md text-[13.5px] font-medium text-ink-4 hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="px-3 py-2 rounded-md text-[13.5px] font-medium text-ink-4 hover:text-foreground transition-colors">How it works</Link>
            <Link href="#pricing" className="px-3 py-2 rounded-md text-[13.5px] font-medium text-ink-4 hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn ghost sm">Sign in</Link>
            <Link href="/register" className="btn accent sm">Start free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(900px 500px at 50% -60px, rgba(6,182,212,0.14), transparent 65%)' }}
        />
        <div className="max-w-[1160px] mx-auto px-7 text-center relative z-10">
          <div className="eyebrow text-cyan-300 justify-center mb-6 sd-header">Website change monitoring</div>
          <h1 className="font-display text-[clamp(38px,5.5vw,68px)] font-semibold tracking-tight leading-[1.02] max-w-[780px] mx-auto mb-5">
            Know when a competitor changes before your boss asks.
          </h1>
          <p className="text-ink-3 text-[18px] leading-relaxed max-w-[580px] mx-auto mb-8">
            SonarDiff watches any webpage on a schedule you set, diffs the content, and alerts you instantly — with the math to prove what changed.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/register" className="btn accent lg">Start free trial</Link>
            <Link href="#how-it-works" className="btn ghost lg">See how it works</Link>
          </div>
          <MovingExamples />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-white/[0.06]">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="max-w-[640px] mx-auto mb-16" data-sweep>
            <div className="eyebrow mb-4">What we monitor</div>
            <h2 className="font-display text-[clamp(28px,3.5vw,42px)] font-semibold tracking-tight">
              Deterministic monitoring, not AI guessing
            </h2>
            <p className="text-ink-3 text-[16px] leading-relaxed mt-4">
              Every check is a real browser render. Every diff is text you can read. Every quota number is a formula you can verify.
            </p>
          </div>

          <div className="space-y-0 border border-white/[0.06] rounded-[14px] overflow-hidden">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  'flex items-start gap-8 px-7 py-7',
                  i > 0 && 'border-t border-white/[0.06]'
                )}
                data-sweep
                style={{ '--i': String(i) } as React.CSSProperties}
              >
                <div className="text-[13px] font-mono text-accent/50 pt-0.5 shrink-0 w-8">{f.num}</div>
                <div>
                  <h3 className="font-display text-[17px] font-semibold tracking-tight text-foreground mb-1.5">{f.title}</h3>
                  <p className="text-[14px] text-ink-3 leading-relaxed max-w-[540px]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 border-t border-white/[0.06]">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="max-w-[640px] mx-auto mb-14" data-sweep>
            <div className="eyebrow mb-4">Process</div>
            <h2 className="font-display text-[clamp(28px,3.5vw,42px)] font-semibold tracking-tight">
              Five steps to your first alert
            </h2>
          </div>

          <div className="max-w-[580px] mx-auto">
            {steps.map((s, i) => (
              <div
                key={s.num}
                className="flex gap-6 items-start pb-7"
                data-sweep
                style={{ '--i': String(i) } as React.CSSProperties}
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-full border border-white/[0.12] text-accent font-mono text-[12.5px] font-semibold flex items-center justify-center bg-accent/[0.06]">
                    {s.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 mt-2 bg-white/[0.06] min-h-[24px]" />
                  )}
                </div>
                <div className="pt-1.5">
                  <h3 className="font-display text-[16px] font-semibold tracking-tight mb-1 text-foreground">{s.title}</h3>
                  <p className="text-[13.5px] text-ink-3 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-white/[0.06]">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="max-w-[640px] mx-auto mb-14" data-sweep>
            <div className="eyebrow mb-4">Pricing</div>
            <h2 className="font-display text-[clamp(28px,3.5vw,42px)] font-semibold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-ink-3 text-[16px] leading-relaxed mt-4">
              Every plan includes the full feature set. Pay for checks, not features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[860px] mx-auto">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  'flex flex-col rounded-[14px] p-6 border',
                  plan.highlight
                    ? 'border-accent/[0.5] bg-accent/[0.04] shadow-[0_0_0_1px_rgba(6,182,212,0.2),0_0_40px_rgba(6,182,212,0.08)] -translate-y-1.5'
                    : 'border-white/[0.08] bg-white/[0.025]'
                )}
                data-sweep
                style={{ '--i': String(i) } as React.CSSProperties}
              >
                <div className="text-[11.5px] font-semibold text-ink-4 uppercase tracking-[0.1em] mb-3">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-[34px] font-semibold tracking-tight text-foreground">{plan.price}</span>
                  <span className="text-ink-5 text-[13px]">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="text-[13px] text-ink-3 flex items-center gap-2">
                      <span className="text-green-ink text-[11px]">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={cn('btn w-full', plan.highlight ? 'accent' : 'ghost')}
                >
                  {plan.price === '$0' ? 'Get started' : 'Start trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/[0.06]" data-sweep>
        <div className="max-w-[1160px] mx-auto px-7 text-center">
          <h2 className="font-display text-[clamp(26px,3.5vw,38px)] font-semibold tracking-tight text-foreground mb-4">
            Start monitoring in under three minutes
          </h2>
          <p className="text-ink-4 text-[16px] max-w-[440px] mx-auto mb-8">
            14-day Pro trial. No credit card. Cancel anytime.
          </p>
          <Link href="/register" className="btn accent lg">Create free account</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-[1160px] mx-auto px-7 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <Logo className="h-5" />
          </Link>
          <div className="text-[12px] text-ink-5">&copy; 2026 SonarDiff Labs, Inc.</div>
          <div className="flex gap-5 text-[12px] text-ink-5">
            <span className="hover:text-ink-3 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-ink-3 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-ink-3 cursor-pointer transition-colors">Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
