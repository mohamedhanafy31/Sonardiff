import { Clock, Bell, CheckCircle2, ChevronRight, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] font-sans selection:bg-green-200">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <BarChart3 className="text-green-600" size={28} />
          SonarDiff
        </div>
        <a href="#waitlist" className="text-sm font-medium hover:text-green-600 transition-colors">
          Join Waitlist
        </a>
      </nav>

      {/* Hero Section */}
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

        {/* Waitlist Form (Mete Formspree) */}
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
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace
