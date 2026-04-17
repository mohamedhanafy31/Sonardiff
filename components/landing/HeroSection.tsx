'use client';

import { useForm, ValidationError } from '@formspree/react';
import { CircleCheck as CheckCircle, Zap } from 'lucide-react';

export default function HeroSection() {
  const [state, handleSubmit] = useForm('mjgjyzdo');

  return (
    <section
      id="hero"
      className="min-h-screen flex items-center justify-center bg-white pt-16"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-medium tracking-wide mb-8">
          <Zap className="w-3 h-3" />
          Launching soon for SaaS Founders
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1a1a1a] leading-tight tracking-tight mb-6">
          Never lose deals because your{' '}
          <span className="relative">
            <span className="relative z-10 text-green-600">competitor</span>
            <span className="absolute bottom-1 left-0 right-0 h-2 bg-green-100 -z-0 rounded" />
          </span>{' '}
          changed pricing.
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
          Intelligent, noise-free monitoring. Get instant alerts when competitors
          update pricing, launch new plans, or change positioning &mdash; without
          the enterprise price tag.
        </p>

        {state.succeeded ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-semibold">You&apos;re on the list!</span>
            </div>
            <p className="text-gray-500 text-sm">
              We&apos;ll reach out with your early adopter discount before launch.
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
            >
              <input
                type="email"
                name="email"
                placeholder="Work Email Address"
                required
                className="flex-1 px-4 py-3 text-sm rounded-lg border border-gray-200 bg-gray-50 text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
              <ValidationError field="email" prefix="Email" errors={state.errors} className="text-red-500 text-xs" />
              <button
                type="submit"
                disabled={state.submitting}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md"
              >
                {state.submitting ? 'Submitting...' : 'Get Early Access'}
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-400">
              Zero setup required. Secure your early adopter regional discount.
            </p>
          </>
        )}

        <div className="mt-16 grid grid-cols-3 gap-6 max-w-xl mx-auto border-t border-gray-100 pt-10">
          {[
            { value: '3x', label: 'Faster reaction time' },
            { value: '0', label: 'Alert noise' },
            { value: '100%', label: 'Signal accuracy' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-green-600">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
