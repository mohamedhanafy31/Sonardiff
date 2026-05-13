'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? 'Incorrect username or password');
        return;
      }

      router.replace('/admin/overview');
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red/20 border border-red/30 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-red" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z" />
                <path d="M8 5v4M8 11v.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-mono text-[15px] font-semibold tracking-tight text-foreground">
              SonarDiff <span className="text-ink-4">Admin</span>
            </span>
          </div>
          <h1 className="font-display text-[24px] font-semibold text-foreground">Admin access</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">Internal operator interface</p>
        </div>

        <div className="bg-bg-card border border-line rounded-[16px] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-ink-3 mb-1.5">Admin username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Value of ADMIN_USERNAME"
                required
                autoFocus
                autoComplete="username"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-soft border border-line text-[13.5px] text-foreground placeholder:text-ink-5 focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-ink-3 mb-1.5">Admin password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-bg-soft border border-line text-[13.5px] text-foreground placeholder:text-ink-5 focus:outline-none focus:border-accent/40 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-3"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red text-[13px] bg-red/10 border border-red/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-2.5 rounded-lg bg-accent text-bg font-semibold text-[14px] hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in as admin
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-ink-5 mt-6">
          This is a restricted operator interface. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
