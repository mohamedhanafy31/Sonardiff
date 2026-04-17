import { Clock, BellOff, ShieldCheck } from 'lucide-react';

const problems = [
  {
    icon: Clock,
    iconColor: 'text-gray-400',
    iconBg: 'bg-gray-50',
    title: 'No time for manual tracking',
    text: "You don't have hours to waste checking competitor websites every day.",
    highlight: false,
  },
  {
    icon: BellOff,
    iconColor: 'text-gray-400',
    iconBg: 'bg-gray-50',
    title: 'Tired of alert noise',
    text: 'Basic tools flood your inbox with useless layout and CSS updates.',
    highlight: false,
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    title: 'The SonarDiff Edge',
    text: 'We filter the noise and only alert you when it impacts your revenue.',
    highlight: true,
  },
];

export default function ProblemSection() {
  return (
    <section className="bg-[#fafafa] border-t border-gray-100 py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] tracking-tight">
            Stop finding out too late.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`rounded-xl p-7 border transition-all duration-200 ${
                  item.highlight
                    ? 'border-green-200 bg-white shadow-md shadow-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-5 ${item.iconBg}`}
                >
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <h3
                  className={`text-base font-semibold mb-2 ${
                    item.highlight ? 'text-green-700' : 'text-[#1a1a1a]'
                  }`}
                >
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
