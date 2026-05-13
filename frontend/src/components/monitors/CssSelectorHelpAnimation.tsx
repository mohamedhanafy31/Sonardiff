'use client';

import { useState, useEffect } from 'react';
import { Play, RotateCcw, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Self-contained animated SVG demonstrating the 4-step "find a CSS selector"
 * workflow: hover element → right-click → Inspect → copy selector.
 *
 * No GIF/video assets — everything is inline SVG + CSS keyframes. Starts paused;
 * the user clicks "Play" to run the animation once. The SVG is keyed on a counter
 * so each click of Play/Replay remounts it and the keyframes restart from t=0.
 */
export function CssSelectorHelpAnimation() {
  const [playKey, setPlayKey] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const isPlaying = playKey > 0;

  // Handle ESC to close maximized view
  useEffect(() => {
    if (!isMaximized) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMaximized(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMaximized]);

  const renderAnimation = (isLarge = false) => (
    <div className={cn(
      "relative bg-bg-soft overflow-hidden",
      isLarge ? "w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl" : "rounded-[10px] border border-line"
    )}>
      <div className="relative" style={{ aspectRatio: '16 / 9' }}>
        {!isPlaying && (
          <button
            type="button"
            onClick={() => setPlayKey(k => k + 1)}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/40 hover:bg-black/30 transition-colors text-white group"
            aria-label="Play tutorial animation"
          >
            <div className={cn(
              "rounded-full bg-accent flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg",
              isLarge ? "w-16 h-16" : "w-12 h-12"
            )}>
              <Play className={cn("fill-white text-white", isLarge ? "w-7 h-7 ml-1" : "w-5 h-5 ml-0.5")} />
            </div>
            <div className={cn("font-medium", isLarge ? "text-[14px]" : "text-[12px]")}>Play tutorial</div>
          </button>
        )}

        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {isPlaying && (
            <button
              type="button"
              onClick={() => setPlayKey(k => k + 1)}
              className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors flex items-center gap-1 text-[11px] font-medium px-2"
              aria-label="Replay animation"
            >
              <RotateCcw className="w-3 h-3" />
              Replay
            </button>
          )}
          {!isLarge && (
            <button
              type="button"
              onClick={() => setIsMaximized(true)}
              className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors flex items-center gap-1 text-[11px] font-medium px-2"
              aria-label="Maximize animation"
            >
              <Maximize2 className="w-3 h-3" />
              Full screen
            </button>
          )}
          {isLarge && (
            <button
              type="button"
              onClick={() => setIsMaximized(false)}
              className="p-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white transition-colors flex items-center gap-1 text-[11px] font-medium px-2"
              aria-label="Close maximization"
            >
              <X className="w-3 h-3" />
              Close
            </button>
          )}
        </div>

        <svg
          key={playKey}
          viewBox="0 0 480 270"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <style>{`
              .demo-frame { fill: #ffffff; stroke: #d4dae4; stroke-width: 1; }
              .demo-titlebar { fill: #f1f5f9; }
              .demo-dot { fill: #cbd5e1; }
              .demo-url { fill: #64748b; font-family: ui-monospace, monospace; font-size: 7px; }
              .demo-h1 { fill: #0f172a; font-family: ui-sans-serif, system-ui; font-size: 14px; font-weight: 700; }
              .demo-text { fill: #475569; font-family: ui-sans-serif, system-ui; font-size: 9px; }
              .demo-card { fill: #ffffff; stroke: #d4dae4; stroke-width: 1; rx: 4; }
              .demo-card-title { fill: #0f172a; font-family: ui-sans-serif, system-ui; font-size: 10px; font-weight: 600; }
              .demo-price { fill: #0ea5e9; font-family: ui-sans-serif, system-ui; font-size: 16px; font-weight: 700; }
              .demo-cursor { fill: #ffffff; stroke: #0f172a; stroke-width: 1.2; }

              /* Cursor: moves into element → right-clicks → moves to devtools tree → right-clicks → done */
              .cursor {
                animation: cursor-path 9s linear forwards;
              }
              @keyframes cursor-path {
                0%   { transform: translate(420px, 240px); }
                10%  { transform: translate(420px, 240px); }
                25%  { transform: translate(280px, 110px); }
                28%  { transform: translate(280px, 110px); }
                40%  { transform: translate(280px, 110px); }
                55%  { transform: translate(120px, 195px); }
                70%  { transform: translate(120px, 195px); }
                100% { transform: translate(120px, 195px); }
              }

              /* Highlight on the price element when cursor reaches it */
              .target-highlight { opacity: 0; animation: target-show 9s linear forwards; }
              @keyframes target-show {
                0%, 24% { opacity: 0; }
                25%, 75% { opacity: 1; }
                100% { opacity: 1; }
              }

              /* Right-click context menu: shows after cursor lands on price */
              .ctx-menu { opacity: 0; transform: translate(280px, 110px) scale(0.95); transform-origin: 0 0; animation: ctx-show 9s ease-out forwards; }
              @keyframes ctx-show {
                0%, 27%   { opacity: 0; transform: translate(280px, 110px) scale(0.9); }
                30%, 38%  { opacity: 1; transform: translate(280px, 110px) scale(1); }
                39%, 100% { opacity: 0; transform: translate(280px, 110px) scale(1); }
              }
              .ctx-inspect-hl { opacity: 0; animation: inspect-hl 9s linear forwards; }
              @keyframes inspect-hl {
                0%, 32%   { opacity: 0; }
                33%, 38%  { opacity: 1; }
                39%, 100% { opacity: 0; }
              }

              /* DevTools panel slides in from the right */
              .devtools { opacity: 0; transform: translate(490px, 0); animation: devtools-in 9s ease-out forwards; }
              @keyframes devtools-in {
                0%, 38%   { opacity: 0; transform: translate(490px, 0); }
                42%, 100% { opacity: 1; transform: translate(0, 0); }
              }

              /* Highlighted line in the DevTools tree */
              .tree-highlight { opacity: 0; animation: tree-hl 9s linear forwards; }
              @keyframes tree-hl {
                0%, 44%   { opacity: 0; }
                48%, 100% { opacity: 1; }
              }

              /* Second context menu over the DevTools line */
              .ctx-menu-2 { opacity: 0; transform: translate(120px, 195px) scale(0.95); transform-origin: 0 0; animation: ctx2-show 9s ease-out forwards; }
              @keyframes ctx2-show {
                0%, 70%   { opacity: 0; transform: translate(120px, 195px) scale(0.9); }
                74%, 86%  { opacity: 1; transform: translate(120px, 195px) scale(1); }
                88%, 100% { opacity: 0; transform: translate(120px, 195px) scale(1); }
              }
              .ctx2-copy-hl { opacity: 0; animation: copy-hl 9s linear forwards; }
              @keyframes copy-hl {
                0%, 78%   { opacity: 0; }
                80%, 86%  { opacity: 1; }
                88%, 100% { opacity: 0; }
              }

              /* Final "Copied!" toast */
              .toast { opacity: 0; transform: translate(280px, 230px); animation: toast-in 9s ease-out forwards; }
              @keyframes toast-in {
                0%, 86%   { opacity: 0; transform: translate(280px, 235px); }
                90%, 100% { opacity: 1; transform: translate(280px, 230px); }
              }
            `}</style>

            {/* arrow cursor icon as a reusable shape */}
            <symbol id="cursor-icon" viewBox="0 0 16 16">
              <path d="M2 1 L14 8 L9 9 L12 14 L10 15 L7 10 L2 14 Z"
                    className="demo-cursor" strokeLinejoin="round" />
            </symbol>
          </defs>

          {/* Browser window */}
          <rect x="10" y="10" width="460" height="250" rx="6" className="demo-frame" />
          <rect x="10" y="10" width="460" height="22" rx="6" className="demo-titlebar" />
          <circle cx="22" cy="21" r="3" className="demo-dot" />
          <circle cx="32" cy="21" r="3" className="demo-dot" />
          <circle cx="42" cy="21" r="3" className="demo-dot" />
          <rect x="55" y="15" width="350" height="13" rx="3" fill="#ffffff" stroke="#e2e8f0" />
          <text x="62" y="24" className="demo-url">https://competitor.com/pricing</text>

          {/* Page content */}
          <text x="30" y="58" className="demo-h1">Pricing</text>
          <text x="30" y="75" className="demo-text">Choose the plan that fits.</text>

          {/* Pricing card */}
          <rect x="30" y="90" width="180" height="90" rx="6" className="demo-card" />
          <text x="44" y="108" className="demo-card-title">Pro plan</text>
          <text x="44" y="135" className="demo-price">$99/mo</text>
          <text x="44" y="155" className="demo-text">Includes everything in Free</text>
          <text x="44" y="168" className="demo-text">plus alerts &amp; team seats.</text>

          {/* Highlight on $99/mo */}
          <rect x="42" y="120" width="80" height="22" rx="3"
                fill="none" stroke="#0ea5e9" strokeWidth="1.5"
                strokeDasharray="3 2"
                className="target-highlight" />

          {/* DevTools panel (slides in from right) */}
          <g className="devtools">
            <rect x="225" y="90" width="240" height="160" rx="4" fill="#1e293b" />
            <rect x="225" y="90" width="240" height="14" rx="4" fill="#0f172a" />
            <text x="232" y="100" fontFamily="ui-monospace, monospace" fontSize="6" fill="#cbd5e1">
              Elements   Console   Network
            </text>
            {/* Tree lines */}
            <text x="232" y="118" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"<body>"}</text>
            <text x="240" y="128" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"<div class=\"page\">"}</text>
            <text x="248" y="138" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"<div class=\"plans\">"}</text>
            <text x="256" y="148" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"<div class=\"card pro\">"}</text>
            <text x="264" y="158" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"<h3>Pro plan</h3>"}</text>
            {/* highlighted line */}
            <rect x="225" y="161" width="240" height="11" className="tree-highlight" fill="#3b82f6" opacity="0.25" />
            <text x="264" y="170" fontFamily="ui-monospace, monospace" fontSize="6" fill="#fbbf24">
              {"<span id=\"price\">$99/mo</span>"}
            </text>
            <text x="256" y="180" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"</div>"}</text>
            <text x="248" y="190" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"</div>"}</text>
            <text x="240" y="200" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"</div>"}</text>
            <text x="232" y="210" fontFamily="ui-monospace, monospace" fontSize="6" fill="#94a3b8">{"</body>"}</text>
          </g>

          {/* Right-click context menu #1 (over the price) */}
          <g className="ctx-menu">
            <rect x="0" y="0" width="80" height="56" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" filter="url(#shadow)" />
            <text x="6" y="11" fontSize="6" fill="#475569" fontFamily="ui-sans-serif, system-ui">Copy</text>
            <text x="6" y="22" fontSize="6" fill="#475569" fontFamily="ui-sans-serif, system-ui">Paste</text>
            <line x1="4" y1="27" x2="76" y2="27" stroke="#e2e8f0" strokeWidth="0.5" />
            <rect x="2" y="30" width="76" height="11" rx="2" className="ctx-inspect-hl" fill="#0ea5e9" />
            <text x="6" y="38" fontSize="6.5" fontWeight="600" fill="#0f172a"
                  fontFamily="ui-sans-serif, system-ui">Inspect</text>
            <text x="6" y="49" fontSize="6" fill="#475569" fontFamily="ui-sans-serif, system-ui">View source</text>
          </g>

          {/* Right-click context menu #2 (over the DevTools tree line) */}
          <g className="ctx-menu-2">
            <rect x="0" y="0" width="92" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
            <text x="6" y="11" fontSize="6" fill="#475569" fontFamily="ui-sans-serif, system-ui">Edit as HTML</text>
            <line x1="4" y1="14" x2="88" y2="14" stroke="#e2e8f0" strokeWidth="0.5" />
            <rect x="2" y="17" width="88" height="11" rx="2" className="ctx2-copy-hl" fill="#0ea5e9" />
            <text x="6" y="25" fontSize="6.5" fontWeight="600" fill="#0f172a"
                  fontFamily="ui-sans-serif, system-ui">Copy → Copy selector</text>
            <text x="6" y="35" fontSize="6" fill="#475569" fontFamily="ui-sans-serif, system-ui">Delete element</text>
          </g>

          {/* Final toast */}
          <g className="toast">
            <rect x="0" y="0" width="160" height="22" rx="11" fill="#0ea5e9" />
            <text x="10" y="14" fontSize="8" fill="#ffffff" fontFamily="ui-monospace, monospace" fontWeight="600">
              ✓ Copied: #price
            </text>
          </g>

          {/* Cursor (floats above everything) */}
          <g className="cursor">
            <use href="#cursor-icon" width="16" height="16" />
          </g>

          {/* Soft shadow for menus */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.15" />
          </filter>
        </svg>
      </div>
      {isLarge && (
        <div className="p-6 bg-bg-card border-t border-white/10 text-center">
          <p className="text-slate-400 text-sm">
            This animation demonstrates how to manually extract a CSS selector using your browser&apos;s DevTools.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderAnimation(false)}

      <div className="px-3 py-2.5 text-[11.5px] text-ink-3 leading-relaxed border-t border-line">
        <strong className="text-foreground">In short:</strong> right-click the element you want →
        click <em>Inspect</em> → in DevTools, right-click the highlighted line →
        <em> Copy → Copy selector</em> → paste it here.
      </div>

      {/* Maximized Modal */}
      {isMaximized && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-5xl animate-in zoom-in-95 duration-200">
            {renderAnimation(true)}
          </div>
        </div>
      )}
    </div>
  );
}

