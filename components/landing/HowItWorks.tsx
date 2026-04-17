import { Globe, SearchCode, Bell } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Globe,
    title: 'Add a Competitor',
    description:
      'Just enter their domain. No technical configuration needed.',
  },
  {
    number: '02',
    icon: SearchCode,
    title: 'Smart Discovery',
    description:
      'Our engine automatically finds their most critical pages — Pricing, Careers, Blog.',
  },
  {
    number: '03',
    icon: Bell,
    title: 'Actionable Alerts',
    description:
      'Get instant pings and weekly digests only when meaningful changes happen.',
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-24 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] tracking-tight">
            Noise-free monitoring in 3 steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex flex-col items-center text-center px-4 py-8">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] right-0 h-px border-t border-dashed border-gray-200 z-0" />
                )}
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mb-6 shadow-sm">
                  <Icon className="w-7 h-7 text-green-600" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#1a1a1a] mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
