'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
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
    oldDetail: '5 seats'
  },
  {
    type: 'Inventory',
    addr: 'store.com/rtx-5090',
    title: 'RTX 5090 Founders Edition',
    oldVal: 'Out of stock',
    newVal: 'In stock',
    detail: 'Limit 1 per customer',
    oldDetail: 'Notify when available'
  },
  {
    type: 'Features',
    addr: 'saas.io/roadmap',
    title: 'Upcoming features',
    oldVal: 'Q4 2025',
    newVal: 'Live now',
    detail: 'SSO & Audit logs',
    oldDetail: 'Waitlist only'
  }
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
      }, 500);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const ex = examples[idx];

  return (
    <div className="mt-16 max-w-[500px] mx-auto animate-float">
      <div className={cn(
        "frame transition-all duration-500",
        animating ? "opacity-0 scale-95 blur-sm" : "opacity-100 scale-100 blur-0"
      )}>
        <div className="frame-bar">
          <div className="dots"><span /><span /><span /></div>
          <div className="addr">{ex.addr}</div>
          <span className="pill live text-[11px]"><span className="dot animate-pulse" />Monitored</span>
        </div>
        <div className="p-6 text-left">
          <div className="text-[12px] uppercase tracking-[0.1em] text-accent font-semibold mb-2">{ex.type}</div>
          <div className="font-display text-[22px] font-semibold tracking-tight text-foreground mb-1">{ex.title}</div>
          <div className="text-[20px] font-display font-semibold tracking-tight">
            <span className="diff-del">{ex.oldVal}</span>{' '}
            <span className="diff-add">{ex.newVal}</span>
          </div>
          <div className="text-[13px] text-ink-3 mt-2">
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
    title: 'Headless browser rendering',
    desc: 'We render every page in a real Chromium instance — JavaScript, SPAs, dynamic content all captured faithfully.',
  },
  {
    title: 'Quota math you can verify',
    desc: 'Before you save a monitor, we show exactly how many checks it will burn per month. No overages, no surprises.',
  },
  {
    title: 'Visual element targeting',
    desc: 'Point and click to select the exact section of a page to watch. Only track the pricing table, not the cookie banner.',
  },
  {
    title: 'Exclusion rules',
    desc: 'Filter out noise with keyword and regex exclusion rules. Ignore timestamps, session tokens, and ad rotations.',
  },
];

const steps = [
  { num: '01', title: 'Paste a URL', desc: 'Enter any page — we render it in a headless browser.' },
  { num: '02', title: 'Pick what to watch', desc: 'Select a CSS element or let us track the full page.' },
  { num: '03', title: 'Set your cadence', desc: 'Choose how often to check. We show the quota impact in real time.' },
  { num: '04', title: 'Get alerted', desc: 'Email, Slack, or webhook — with the exact diff attached.' },
  { num: '05', title: 'Review diffs', desc: 'See red/green text diffs and before/after screenshots.' },
];

const plans = [
  { name: 'Starter', price: '$0', period: '/mo', checks: '500 checks/mo', monitors: '5 monitors', highlight: false },
  { name: 'Pro', price: '$29', period: '/mo', checks: '10k checks/mo', monitors: '50 monitors', highlight: true },
  { name: 'Business', price: '$129', period: '/mo', checks: '100k checks/mo', monitors: 'Unlimited monitors', highlight: false },
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

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-[14px] bg-background/80 border-b border-line">
        <div className="max-w-[1200px] mx-auto px-7 flex items-center gap-7 h-16">
          <Link href="/" className="shrink-0">
            <Logo className="h-8" />
          </Link>
          <div className="hidden md:flex items-center gap-1 ml-2">
            <Link href="#features" className="px-3 py-2 rounded-md text-[14.5px] font-medium text-ink-3 hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="px-3 py-2 rounded-md text-[14.5px] font-medium text-ink-3 hover:text-foreground transition-colors">How it works</Link>
            <Link href="#pricing" className="px-3 py-2 rounded-md text-[14.5px] font-medium text-ink-3 hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login" className="btn ghost sm text-foreground border-line hover:bg-bg-muted">Sign in</Link>
            <Link href="/register" className="btn accent sm">Start free trial</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-background text-foreground pt-20 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(800px 400px at 50% 0%, rgba(6,182,212,0.18), transparent 60%)'
        }} />
        <div className="max-w-[1200px] mx-auto px-7 text-center relative z-10">
          <div className="eyebrow text-[#67E8F9] justify-center mb-6 animate-fade-in-up">Website change monitoring</div>
          <h1 className="font-display text-[clamp(40px,6vw,72px)] font-semibold tracking-tight text-foreground leading-[1.02] max-w-[800px] mx-auto mb-5 animate-fade-in-up [animation-delay:100ms]">
            Know when a competitor changes before your boss asks.
          </h1>
          <p className="text-ink-3 text-[19px] leading-relaxed max-w-[600px] mx-auto mb-8 animate-fade-in-up [animation-delay:200ms]">
            SonarDiff watches any webpage on a schedule you set, diffs the content, and alerts you instantly — with the math to prove what changed.
          </p>
          <div className="flex items-center justify-center gap-3 animate-fade-in-up [animation-delay:300ms]">
            <Link href="/register" className="btn accent lg">Start free trial →</Link>
            <Link href="#how-it-works" className="btn ghost lg text-foreground border-line hover:bg-bg-muted">See how it works</Link>
          </div>

          <MovingExamples />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-bg-card py-24 reveal">
        <div className="max-w-[1200px] mx-auto px-7">
          <div className="text-center max-w-[720px] mx-auto mb-14">
            <div className="eyebrow justify-center mb-4">Features</div>
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-semibold tracking-tight">
              Deterministic monitoring, not AI guessing
            </h2>
            <p className="lead mx-auto mt-4">
              Every check is a real browser render. Every diff is text you can read. Every quota number is a formula you can verify.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {features.map((f, i) => (
              <div key={f.title} className={cn(
                "card transition-all duration-500 hover:-translate-y-1 hover:shadow-md",
                "reveal"
              )} style={{ transitionDelay: `${i * 100}ms` }}>
                <h3 className="font-display text-[18px] font-semibold tracking-tight mb-2">{f.title}</h3>
                <p className="text-[14px] text-ink-3 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-bg-soft py-24">
        <div className="max-w-[1200px] mx-auto px-7">
          <div className="text-center max-w-[720px] mx-auto mb-14 reveal">
            <div className="eyebrow justify-center mb-4">How it works</div>
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-semibold tracking-tight">
              Five steps to your first alert
            </h2>
          </div>

          <div className="max-w-[640px] mx-auto space-y-8">
            {steps.map((s, i) => (
              <div key={s.num} className="flex gap-5 items-start reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="w-10 h-10 rounded-full bg-accent/10 text-accent-2 font-mono text-[13px] font-semibold flex items-center justify-center shrink-0 transition-transform hover:scale-110">
                  {s.num}
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-semibold tracking-tight mb-1">{s.title}</h3>
                  <p className="text-[14px] text-ink-3 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-bg-card py-24 reveal">
        <div className="max-w-[1200px] mx-auto px-7">
          <div className="text-center max-w-[720px] mx-auto mb-14">
            <div className="eyebrow justify-center mb-4">Pricing</div>
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-semibold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="lead mx-auto mt-4">
              Every plan includes the full feature set. Pay for checks, not features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px] mx-auto">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  "card flex flex-col transition-all duration-500 reveal",
                  plan.highlight ? 'border-accent shadow-[0_0_0_1px_rgba(6,182,212,0.35),0_0_32px_rgba(6,182,212,0.12)] -translate-y-2' : ''
                )}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-[13px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-display text-[36px] font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-ink-4 text-[14px]">{plan.period}</span>
                </div>
                <div className="space-y-2 mb-6 flex-1">
                  <div className="text-[13.5px] text-ink-3 flex items-center gap-2">
                    <span className="text-green-ink">✓</span> {plan.checks}
                  </div>
                  <div className="text-[13.5px] text-ink-3 flex items-center gap-2">
                    <span className="text-green-ink">✓</span> {plan.monitors}
                  </div>
                  <div className="text-[13.5px] text-ink-3 flex items-center gap-2">
                    <span className="text-green-ink">✓</span> All features included
                  </div>
                </div>
                <Link
                  href="/register"
                  className={`btn w-full ${plan.highlight ? 'accent' : 'ghost'}`}
                >
                  {plan.price === '$0' ? 'Get started' : 'Start trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-bg-soft text-foreground py-20 reveal">
        <div className="max-w-[1200px] mx-auto px-7 text-center">
          <h2 className="font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-tight text-foreground mb-4">
            Start monitoring in under three minutes
          </h2>
          <p className="text-ink-3 text-[17px] max-w-[500px] mx-auto mb-8">
            14-day Pro trial. No credit card. Cancel anytime.
          </p>
          <Link href="/register" className="btn accent lg transition-transform hover:scale-105 active:scale-95">Create free account →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-bg-soft py-10">
        <div className="max-w-[1200px] mx-auto px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="shrink-0">
              <Logo className="h-6" />
            </Link>
            <div className="text-[13px] text-ink-4">
              &copy; 2026 SonarDiff Labs, Inc.
            </div>
            <div className="flex gap-5 text-[13px] text-ink-4">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
