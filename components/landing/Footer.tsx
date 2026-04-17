import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Image
          src="/1776380006610-removebg-preview-Picsart-AiImageEnhancer.png"
          alt="SonarDiff"
          width={120}
          height={36}
          className="h-8 w-auto object-contain opacity-70"
        />
        <p className="text-sm text-gray-400">
          &copy; 2026 SonarDiff. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
