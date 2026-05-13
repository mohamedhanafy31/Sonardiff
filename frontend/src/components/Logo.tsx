'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center shrink-0", className)}>
      <svg 
        viewBox={iconOnly ? "0 0 48 48" : "0 0 200 48"} 
        className={cn("h-full w-auto", iconOnly ? "aspect-square" : "aspect-[200/48]")}
        role="img" 
        aria-label="SonarDiff"
      >
        <defs>
          <style>
            {`
              .sd-pulse-outer {
                transform-box: fill-box;
                transform-origin: center;
                animation: sd-po 2.4s ease-out infinite;
              }
              .sd-pulse-inner {
                transform-box: fill-box;
                transform-origin: center;
                animation: sd-pi 2.4s ease-out infinite 0.65s;
              }
              @keyframes sd-po {
                0%   { transform: scale(1);    opacity: 1; }
                100% { transform: scale(1.45); opacity: 0; }
              }
              @keyframes sd-pi {
                0%   { transform: scale(1);    opacity: 0.65; }
                100% { transform: scale(1.22); opacity: 0; }
              }
            `}
          </style>
          <filter id="sd-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="sd-ring-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle cx="24" cy="24" r="16" fill="none" stroke="#06B6D4" strokeOpacity="0.2" strokeWidth="1"/>
        <circle className="sd-pulse-outer" cx="24" cy="24" r="16" fill="none" stroke="#06B6D4" strokeWidth="1.5" filter="url(#sd-ring-glow)"/>
        <circle className="sd-pulse-inner" cx="24" cy="24" r="16" fill="none" stroke="#06B6D4" strokeWidth="1"/>
        <circle cx="24" cy="24" r="4.5" fill="#06B6D4" filter="url(#sd-dot-glow)"/>

        {!iconOnly && (
          <text
            x="53"
            y="24"
            dominantBaseline="middle"
            fontFamily="inherit"
            fontWeight="800"
            fontSize="22"
            letterSpacing="-0.66"
            fill="currentColor"
            className="text-foreground"
          >
            Sonar<tspan fill="#06B6D4">Diff</tspan>
          </text>
        )}
      </svg>
    </div>
  );
}
