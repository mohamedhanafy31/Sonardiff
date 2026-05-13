'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const response = await api.post('/auth/login', data);
      localStorage.setItem('auth_token', response.data.token);
      setUser(response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        setError(
          'Cannot reach the API. Start the backend (cd artifacts/mvp/backend && pnpm run dev) on port 3001, or set BACKEND_URL if the API runs elsewhere.'
        );
        return;
      }
      const data = err.response?.data;
      const base = data?.error || err.message || 'Failed to login';
      const detail = data?.detail;
      setError(detail ? `${base} — ${detail}` : base);
    }
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] min-h-screen">
      {/* Left — dark panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-dark-bg text-dark-ink p-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(700px 300px at 80% 20%, rgba(6,182,212,0.22), transparent 60%), radial-gradient(500px 240px at 0% 100%, rgba(6,182,212,0.12), transparent 60%)'
        }} />
        <div className="relative z-10">
          <Link href="/">
            <Logo className="h-8" />
          </Link>
          <div className="mt-20 max-w-[520px]">
            <h1 className="text-[clamp(36px,4vw,52px)] text-white leading-[1.05]">
              Welcome back. <br />Everything you were watching, still watching.
            </h1>
            <p className="text-dark-ink-3 max-w-[480px] mt-4.5 text-[17px] leading-relaxed">
              SonarDiff is the only change monitor that does the math out loud and lets you decide what&apos;s noise.
            </p>
          </div>
        </div>
        <div className="relative z-10 bg-white/4 border border-dark-line rounded-[14px] p-5 max-w-[460px]">
          <blockquote className="text-[15px] leading-relaxed text-dark-ink-2 m-0">
            &ldquo;We replaced two competitor tools with SonarDiff in a week. The quota math alone saved us from a $2k surprise.&rdquo;
          </blockquote>
          <div className="flex items-center gap-2.5 mt-3.5 text-[13px] text-dark-ink-3">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-cyan-300 shrink-0" />
            <span><strong className="text-white">Lena Park</strong> &middot; Pricing analyst, Northwind</span>
          </div>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center p-8 lg:p-14">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/">
              <Logo className="h-8" />
            </Link>
          </div>

          <h2 className="font-display text-[32px] font-semibold tracking-tight mb-2 text-foreground">Sign in</h2>
          <p className="text-ink-3 text-[15px] mb-7">Welcome back to SonarDiff.</p>

          {/* SSO buttons (visual only) */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button type="button" className="h-[42px] flex items-center justify-center gap-2 border border-line rounded-[10px] bg-bg-card text-[13.5px] font-medium text-foreground hover:bg-bg-soft transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.13-.85 2.08-1.81 2.72v2.26h2.93c1.72-1.58 2.71-3.91 2.71-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.93-2.26c-.81.54-1.85.87-3.03.87-2.34 0-4.32-1.58-5.02-3.7H.96v2.32C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.98 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.29-1.71V4.97H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.03l3.02-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l3.02 2.32C4.68 5.17 6.66 3.58 9 3.58z"/></svg>
              Google
            </button>
            <button type="button" className="h-[42px] flex items-center justify-center gap-2 border border-line rounded-[10px] bg-bg-card text-[13.5px] font-medium text-foreground hover:bg-bg-soft transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 my-4.5 text-ink-4 text-xs uppercase tracking-[0.1em]">
            <div className="flex-1 h-px bg-line" />
            or with email
            <div className="flex-1 h-px bg-line" />
          </div>

          {error && (
            <div className="bg-red-bg border border-red/20 text-red-ink p-3 rounded-[10px] mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div className="grid gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-ink-2">Work email</label>
              <input
                {...register('email')}
                id="email"
                type="email"
                placeholder="you@company.com"
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
                placeholder="••••••••••"
                autoComplete="current-password"
                className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
              />
              {errors.password && <p className="text-red-ink text-xs mt-0.5">{errors.password.message}</p>}
            </div>

            <div className="flex justify-between items-center text-[13px] pt-1 pb-2">
              <label className="inline-flex gap-2 items-center text-ink-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent rounded" />
                Remember this device
              </label>
              <span className="text-accent-2 font-medium cursor-pointer hover:underline">Forgot password?</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn primary w-full h-[46px] text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in →'}
            </button>
          </form>

          <div className="text-center mt-5.5 text-[14px] text-ink-3">
            New to SonarDiff?{' '}
            <Link href="/register" className="text-accent-2 font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
