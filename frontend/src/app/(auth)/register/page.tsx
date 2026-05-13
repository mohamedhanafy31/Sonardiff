'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  plan: z.enum(['free', 'pro']),
});

type RegisterForm = z.infer<typeof registerSchema>;

const plans = [
  { value: 'free' as const, name: 'Starter', price: 'Free', quota: '500 checks/mo' },
  { value: 'pro' as const, name: 'Pro', price: '$29/mo', quota: '10k checks/mo' },
];

const perks = [
  'Full Pro features — 50 monitors, 10k checks, element targeting, regex rules.',
  'Day-15 reminder email, not a stealth charge.',
  'Cancel inside the app — no "schedule a call" gate.',
  'SOC 2 Type II · GDPR · EU & US data residency.',
];

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { plan: 'pro' },
  });

  const selectedPlan = watch('plan');
  const passwordValue = watch('password') || '';

  // Password strength meter
  const passwordScore = useMemo(() => {
    let score = 0;
    if (passwordValue.length >= 10) score++;
    if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score++;
    if (/\d/.test(passwordValue)) score++;
    if (/[^A-Za-z0-9]/.test(passwordValue)) score++;
    return score;
  }, [passwordValue]);

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      const response = await api.post('/auth/register', data);
      localStorage.setItem('auth_token', response.data.token);
      setUser(response.data.user);
      router.push('/monitors/new');
    } catch (err: any) {
      if (!err.response) {
        setError(
          'Cannot reach the API. Start the backend on port 3001, or set BACKEND_URL if the API runs elsewhere.'
        );
        return;
      }
      const data = err.response?.data;
      const base = data?.error || err.message || 'Failed to register';
      const detail = data?.detail;
      setError(detail ? `${base} — ${detail}` : base);
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] min-h-screen">
      {/* Left — dark panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-dark-bg text-dark-ink p-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(700px 300px at 20% 20%, rgba(6,182,212,0.22), transparent 60%), radial-gradient(500px 240px at 100% 100%, rgba(6,182,212,0.12), transparent 60%)'
        }} />
        <div className="relative z-10">
          <Link href="/">
            <Logo className="h-8" />
          </Link>
          <div className="mt-20 max-w-[520px]">
            <h1 className="text-[clamp(34px,4vw,48px)] text-white leading-[1.05] max-w-[460px]">
              Start your 14-day Pro trial. No card.
            </h1>
            <p className="text-dark-ink-3 max-w-[480px] mt-4.5 text-[16.5px] leading-relaxed">
              You&apos;ll have your first monitor running in under three minutes — and your quota dashboard will be honest with you from minute one.
            </p>
          </div>
        </div>
        <div className="relative z-10 grid gap-3 max-w-[460px]">
          {perks.map((perk) => (
            <div key={perk} className="flex gap-3 items-start text-[14.5px] text-dark-ink-2">
              <svg viewBox="0 0 20 20" fill="none" stroke="#67E8F9" strokeWidth="2" className="w-5 h-5 shrink-0 mt-0.5">
                <path d="M4 10.5l3.5 3.5L16 5.5" />
              </svg>
              {perk}
            </div>
          ))}
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center p-8 lg:p-14">
        <div className="w-full max-w-[460px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/">
              <Logo className="h-8" />
            </Link>
          </div>

          <h2 className="font-display text-[30px] font-semibold tracking-tight mb-2 text-foreground">Create your account</h2>
          <p className="text-ink-3 text-[15px] mb-7">14 days of Pro on us. We&apos;ll remind you before it ends.</p>

          {error && (
            <div className="bg-red-bg border border-red/20 text-red-ink p-3 rounded-[10px] mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            {/* Name field (full name) */}
            <div className="grid gap-1.5">
              <label htmlFor="name" className="text-[13px] font-medium text-ink-2">Full name</label>
              <input
                {...register('name')}
                id="name"
                type="text"
                placeholder="Sam Park"
                autoComplete="name"
                className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
              />
              {errors.name && <p className="text-red-ink text-xs mt-0.5">{errors.name.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-ink-2">Work email</label>
              <input
                {...register('email')}
                id="email"
                type="email"
                placeholder="sam@company.com"
                autoComplete="email"
                className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
              />
              {errors.email && <p className="text-red-ink text-xs mt-0.5">{errors.email.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-ink-2">Password</label>
              <PasswordInput
                {...register('password')}
                id="password"
                placeholder="At least 10 characters"
                autoComplete="new-password"
                className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
              />
              {/* Strength meter */}
              {passwordValue.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "flex-1 h-1 rounded-full transition-colors",
                        i < passwordScore
                          ? passwordScore <= 1 ? "bg-red" : passwordScore === 2 ? "bg-amber" : "bg-green"
                          : "bg-line"
                      )}
                    />
                  ))}
                </div>
              )}
              <div className="text-xs text-ink-4 mt-0.5">Use 10+ characters with a mix of letters, numbers, and symbols.</div>
              {errors.password && <p className="text-red-ink text-xs mt-0.5">{errors.password.message}</p>}
            </div>

            {/* Plan selector */}
            <div>
              <label className="text-[13px] font-medium text-ink-2">Pick a plan to trial</label>
              <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                {plans.map((plan) => (
                  <label
                    key={plan.value}
                    htmlFor={`plan-${plan.value}`}
                    className={cn(
                      "border rounded-[10px] p-3 cursor-pointer flex flex-col gap-1 transition-all",
                      selectedPlan === plan.value
                        ? "border-accent shadow-[0_0_0_3px_rgba(6,182,212,0.12)] bg-accent/4"
                        : "border-line bg-bg-card hover:border-ink-5"
                    )}
                  >
                    <input
                      type="radio"
                      id={`plan-${plan.value}`}
                      value={plan.value}
                      checked={selectedPlan === plan.value}
                      onChange={() => setValue('plan', plan.value)}
                      className="sr-only"
                    />
                    <span className="font-semibold text-[13.5px] text-foreground">{plan.name}</span>
                    <span className="font-mono text-xs text-ink-4">{plan.price}</span>
                    <span className="text-[11.5px] text-ink-5 mt-1">{plan.quota}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[12.5px] text-ink-4 leading-relaxed pt-1 pb-2">
              By creating an account, you agree to our{' '}
              <span className="text-accent-2 cursor-pointer">Terms</span> and{' '}
              <span className="text-accent-2 cursor-pointer">Privacy Policy</span>.
              We&apos;ll never sell your data or auto-charge you for overages.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn accent w-full h-12 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create account →'}
            </button>
          </form>

          <div className="text-center mt-5.5 text-[14px] text-ink-3">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-2 font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
