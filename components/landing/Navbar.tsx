'use client';

import Image from 'next/image';

export default function Navbar() {
  const scrollToHero = () => {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Image
              src="/1776380006610-removebg-preview-Picsart-AiImageEnhancer.png"
              alt="SonarDiff"
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <button
            onClick={scrollToHero}
            className="text-sm font-medium px-4 py-2 rounded-md border border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-all duration-200"
          >
            Join Waitlist
          </button>
        </div>
      </div>
    </nav>
  );
}
