'use client';

import Link from 'next/link';
import { Home, Search } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-soft flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center mb-4">
          <Link href="/">
            <Logo className="h-10" />
          </Link>
        </div>
        <div className="relative">
          <div className="text-[12rem] font-bold text-ink-5/30 leading-none select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-5 bg-accent/10 rounded-3xl border border-accent/20">
              <Search className="w-12 h-12 text-accent" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Page Not Found</h1>
          <p className="text-ink-3">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        </div>

        <Link
          href="/dashboard"
          className="btn accent lg inline-flex items-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
