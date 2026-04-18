import { Clock, Bell, CheckCircle2, ChevronRight, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] font-sans selection:bg-green-200">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <BarChart3 className="text-green-600" size={28} />
          SonarDiff
        </div>
        <a href="#waitlist" className="text-sm font-medium hover:text-green-600 transition-colors">
          Join Waitlist
        </a>
      </nav>

      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <span className="inline-block py-1 px-3 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold mb-6 tracking-wide uppercase">
          Launching soon for SaaS Founders
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Never lose deals because your competitor changed pricing.
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          Intelligent, noise-free monitoring. Get instant alerts when competitors update pricing, launch new plans, or change positioning — without the enterprise price tag.
        </p>

        <div id="waitlist" className="max-w-md mx-auto">
          <form action="https://formspree.io/f/mjgjyzdo" method="POST" className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              name="email"
              placeholder="Work Email Address"
              required
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow text-[#1a1a1a]"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              Get Early Access
              <ChevronRight size={18} />
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-3 font-medium">Zero setup required. Secure your early adopter discount.</p>
        </div>
      </section>

      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">Stop finding out too late.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
                <Clock size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">No time for manual tracking</h3>
              <p className="text-gray-500 text-sm leading-relaxed">You don't have hours to waste checking competitor websites every day.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
                <Bell size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Tired of alert noise</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Basic tools flood your inbox with useless layout updates.</p>
            </div>
            <div className="p-6 rounded-2xl bg-green-50 border border-green-100 shadow-sm relative overflow-hidden">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-green-900">The SonarDiff Edge</h3>
              <p className="text-green-800 text-sm leading-relaxed">We filter the noise and only alert you when it impacts your revenue.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">Noise-free monitoring in 3 steps</h2>
          <div className="space-y-4">
            <div className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center shrink-0">1</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Add a Competitor</h3>
                <p className="text-gray-500 text-sm">Just enter their domain. No technical configuration needed.</p>
              </div>
            </div>
            <div className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center shrink-0">2</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Smart Discovery</h3>
                <p className="text-gray-500 text-sm">Our engine automatically finds their most critical pages.</p>
              </div>
            </div>
            <div className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center shrink-0">3</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Actionable Alerts</h3>
                <p className="text-gray-500 text-sm">Get instant pings only when meaningful changes happen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Simple pricing. Massive ROI.</h2>
          <p className="text-gray-500 mb-12">Lock in these prices by joining the waitlist today.</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
            <div className="p-8 rounded-3xl bg-white border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="text-4xl font-extrabold mb-6">$19<span className="text-lg text-gray-400 font-medium">/mo</span></div>
              <ul className="space-y-3 mb-8 text-gray-600 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Track 3 competitors</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Instant pricing alerts</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Weekly digest</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-3xl bg-white border-2 border-green-500 relative shadow-md">
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Growth</h3>
              <div className="text-4xl font-extrabold mb-6">$39<span className="text-lg text-gray-400 font-medium">/mo</span></div>
              <ul className="space-y-3 mb-8 text-gray-600 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Track 10 competitors</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Full timeline dashboard</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> All alerts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 bg-white text-center border-t border-gray-100">
        <p className="text-gray-400 text-sm font-medium">© 2026 SonarDiff. All rights reserved.</p>
      </footer>
    </div>
  );
}
