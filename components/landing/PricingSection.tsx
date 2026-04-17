'use client';

import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$19',
    period: '/mo',
    features: [
      'Track 3 competitors',
      'Instant pricing alerts',
      'Weekly digest',
    ],
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$39',
    period: '/mo',
    badge: 'Most Popular',
    features: [
      'Track 10 competitors',
      'Full timeline dashboard',
      'All alerts included',
    ],
    highlighted: true,
  },
];

export default function PricingSection() {
  const scrollToHero = () => {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-[#fafafa] border-t border-gray-100 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] tracking-tight">
            Simple pricing. Massive ROI.
          </h2>
        </div>
        <p className="text-center text-gray-500 text-base mb-14">
          Lock in these prices by joining the waitlist today.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 border transition-all duration-200 ${
                plan.highlighted
                  ? 'border-green-500 bg-white shadow-lg shadow-green-50/60'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                  {plan.badge}
                </span>
              )}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-500 mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-green-600' : 'text-[#1a1a1a]'}`}>
                    {plan.price}
                  </span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={scrollToHero}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  plan.highlighted
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-[#1a1a1a]'
                }`}
              >
                Join Waitlist
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={scrollToHero}
            className="text-sm font-semibold text-green-600 hover:text-green-700 underline underline-offset-4 transition-colors"
          >
            Secure Your Discount Now
          </button>
        </div>
      </div>
    </section>
  );
}
