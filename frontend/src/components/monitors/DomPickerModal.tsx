'use client';

import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import { api } from '@/lib/api';
import {
  Loader2, X, AlertCircle, Check,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Target, RotateCcw, RefreshCw,
} from 'lucide-react';

interface DomPickerModalProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selector: string) => void;
}

interface Box { x: number; y: number; width: number; height: number }
interface ElementInfo { selector: string; tag: string; box: Box }
interface ResolvedInfo extends ElementInfo {
  matchCount: number;
  ancestors: Array<ElementInfo & { matchCount: number }>;
  children: Array<ElementInfo & { matchCount: number }>;
  prevSibling: (ElementInfo & { matchCount: number }) | null;
  nextSibling: (ElementInfo & { matchCount: number }) | null;
}

export function DomPickerModal({ url, isOpen, onClose, onSelect }: DomPickerModalProps) {
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [elements, setElements] = useState<ElementInfo[]>([]);

  // refreshKey: bumping it forces the screenshot useEffect to re-run
  const [refreshKey, setRefreshKey] = useState(0);

  // Hover state — purely client-side hit-testing against `elements`
  const [hovered, setHovered] = useState<ElementInfo | null>(null);
  // Selected/confirmed state — populated after a click resolves
  const [picked, setPicked] = useState<ResolvedInfo | null>(null);
  // Click marker (image-relative coords)
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset all state when (re)opening or when URL changes
  useEffect(() => {
    if (!isOpen) return;
    setHovered(null);
    setPicked(null);
    setMarker(null);
    setError(null);
  }, [isOpen]);

  // Free the cached browser on the backend when the modal closes
  useEffect(() => {
    return () => {
      if (url) api.post('/dom-picker/close-session', { url }).catch(() => {});
    };
  }, [url]);

  // Fetch the screenshot (and element bounding boxes for hover hit-testing)
  // Re-runs on URL change or when user clicks Refresh (refreshKey bump)
  useEffect(() => {
    let isMounted = true;
    const doFetch = async () => {
      if (!isOpen || !url) return;
      setLoading(true);
      setError(null);
      setScreenshot(null);
      setElements([]);
      try {
        const { data } = await api.post('/dom-picker/screenshot', { url });
        if (isMounted) {
          setScreenshot(data.screenshot);
          setDimensions(data.dimensions);
          setElements(data.elements || []);
        }
      } catch (err: any) {
        if (isMounted) setError(err.response?.data?.error || 'Failed to capture screenshot');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    doFetch();
    return () => { isMounted = false; };
  }, [isOpen, url, refreshKey]);

  // Refresh: close stale session then bump key to re-trigger screenshot fetch
  const handleRefresh = async () => {
    if (loading) return;
    setPicked(null);
    setMarker(null);
    setHovered(null);
    setError(null);
    await api.post('/dom-picker/close-session', { url }).catch(() => {});
    setRefreshKey(k => k + 1);
  };

  // Convert mouse coords (relative to displayed image) → native page coords
  const toNative = useCallback((clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img || !dimensions) return null;
    const rect = img.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const sx = dimensions.width / rect.width;
    const sy = dimensions.height / rect.height;
    return { x: cx * sx, y: cy * sy, scale: { sx, sy }, rect };
  }, [dimensions]);

  // Find the smallest element whose bounding box contains the cursor
  const hitTest = useCallback((nx: number, ny: number): ElementInfo | null => {
    let best: ElementInfo | null = null;
    let bestArea = Infinity;
    for (const el of elements) {
      const { x, y, width, height } = el.box;
      if (nx >= x && nx <= x + width && ny >= y && ny <= y + height) {
        const area = width * height;
        if (area < bestArea) { best = el; bestArea = area; }
      }
    }
    return best;
  }, [elements]);

  const handleMouseMove = (e: ReactMouseEvent<HTMLImageElement>) => {
    if (picked || resolving) return;
    const nat = toNative(e.clientX, e.clientY);
    if (!nat) return;
    setHovered(hitTest(nat.x, nat.y));
  };

  const handleMouseLeave = () => { if (!picked) setHovered(null); };

  // Clear stale hover highlight when user scrolls (mouse hasn't moved but image shifted)
  const handleScroll = () => { if (!picked) setHovered(null); };

  const handleImageClick = async (e: ReactMouseEvent<HTMLImageElement>) => {
    if (resolving || picked) return;
    const nat = toNative(e.clientX, e.clientY);
    if (!nat) return;
    const xPct = ((e.clientX - nat.rect.left) / nat.rect.width) * 100;
    const yPct = ((e.clientY - nat.rect.top) / nat.rect.height) * 100;
    setMarker({ x: xPct, y: yPct });
    setResolving(true);
    setError(null);
    try {
      const { data } = await api.post('/dom-picker/resolve', { url, x: nat.x, y: nat.y });
      setPicked(data);
      setHovered(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve selector at that location.');
    } finally {
      setResolving(false);
    }
  };

  const inspectSelector = async (selector: string) => {
    setResolving(true);
    setError(null);
    try {
      const { data } = await api.post('/dom-picker/inspect-selector', { url, selector });
      setPicked(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to navigate to that element.');
    } finally {
      setResolving(false);
    }
  };

  const apply = () => {
    if (!picked) return;
    onSelect(picked.selector);
    onClose();
  };

  const pickAgain = () => {
    setPicked(null);
    setMarker(null);
    setError(null);
  };

  // Box overlay — converts native coords → CSS percentage relative to displayed image
  const overlayStyle = (box: Box | undefined): React.CSSProperties | undefined => {
    if (!box || !dimensions) return undefined;
    return {
      left: `${(box.x / dimensions.width) * 100}%`,
      top: `${(box.y / dimensions.height) * 100}%`,
      width: `${(box.width / dimensions.width) * 100}%`,
      height: `${(box.height / dimensions.height) * 100}%`,
    };
  };

  // Bug 5: label positioning — render below the element when it's near the top
  // edge (top% < 2%) to avoid negative top values that clip above the image.
  const labelStyle = (box: Box | undefined): React.CSSProperties | undefined => {
    if (!box || !dimensions) return undefined;
    const topPct = (box.y / dimensions.height) * 100;
    const heightPct = (box.height / dimensions.height) * 100;
    if (topPct < 2) {
      // Render label below the element
      return {
        left: `${(box.x / dimensions.width) * 100}%`,
        top: `${topPct + heightPct + 0.2}%`,
      };
    }
    // Default: render 18px above the element
    return {
      left: `${(box.x / dimensions.width) * 100}%`,
      top: `calc(${topPct}% - 18px)`,
    };
  };

  if (!isOpen) return null;

  const overlayBox   = picked?.box || hovered?.box;
  const overlayLabel = picked?.selector || hovered?.selector || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[90vh] bg-[#0a0f1c] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Visual Element Picker</h2>
            <p className="text-sm text-slate-400">
              {picked
                ? 'Review the selected element below, then Apply or pick a different one.'
                : 'Hover to highlight, click to select.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh screenshot button — visible once screenshot has loaded */}
            {screenshot && !loading && (
              <button
                type="button"
                onClick={handleRefresh}
                title="Refresh screenshot (force re-capture)"
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close picker"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content — scrollable, onScroll clears stale hover (Bug 3) */}
        <div className="flex-1 overflow-y-auto bg-slate-950/50" onScroll={handleScroll}>
          {error && (
            <div className="sticky top-3 z-30 mx-auto max-w-md mt-3 bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)} className="hover:text-red-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center text-cyan-500 gap-4 mt-20">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-sm text-slate-400 animate-pulse">Launching browser &amp; capturing page…</p>
            </div>
          ) : screenshot ? (
            <div className="p-4 flex justify-center">
              <div className={`relative w-fit max-w-full ${picked ? 'cursor-default' : resolving ? 'cursor-wait' : 'cursor-crosshair'}`}>
                <img
                  ref={imageRef}
                  src={screenshot}
                  alt="Website screenshot"
                  className="max-w-full h-auto border border-white/10 rounded-lg shadow-2xl block"
                  onClick={handleImageClick}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Overlay: hovered or picked element box */}
                {overlayBox && (
                  <>
                    <div
                      className={`absolute pointer-events-none border-2 rounded-sm transition-all duration-75 ${
                        picked ? 'border-cyan-400 bg-cyan-400/10' : 'border-yellow-400 bg-yellow-400/10'
                      }`}
                      style={overlayStyle(overlayBox)}
                    />
                    {/* Bug 5: use labelStyle() instead of bare calc(top - 18px) */}
                    {overlayLabel && (
                      <div
                        className={`absolute pointer-events-none px-2 py-0.5 rounded font-mono text-[10px] font-medium shadow-lg whitespace-nowrap max-w-[300px] truncate ${
                          picked ? 'bg-cyan-400 text-slate-900' : 'bg-yellow-400 text-slate-900'
                        }`}
                        style={labelStyle(overlayBox)}
                      >
                        {overlayLabel}
                      </div>
                    )}
                  </>
                )}

                {/* Click marker */}
                {marker && (
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow" />
                  </div>
                )}

                {/* Resolving spinner */}
                {resolving && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                    <div className="bg-slate-900/90 backdrop-blur px-4 py-3 rounded-xl border border-white/10 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                      <span className="text-white text-sm font-medium">Resolving…</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-500">No screenshot available.</div>
          )}
        </div>

        {/* Bottom action bar — appears once an element is picked */}
        {picked && !loading && (
          <div className="border-t border-white/10 bg-slate-900/70 backdrop-blur shrink-0">
            <div className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Selected element</div>
                <div className="font-mono text-[13px] text-cyan-300 truncate">{picked.selector}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  &lt;{picked.tag}&gt; ·{' '}
                  <span className={picked.matchCount === 1 ? 'text-emerald-400' : 'text-amber-400'}>
                    matches {picked.matchCount} {picked.matchCount === 1 ? 'element' : 'elements'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Parent / child / sibling navigation */}
                <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-white/10">
                  <button
                    type="button"
                    onClick={() => picked.prevSibling && inspectSelector(picked.prevSibling.selector)}
                    disabled={!picked.prevSibling || resolving}
                    className="px-2.5 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous sibling"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-white/10" />
                  <button
                    type="button"
                    onClick={() => picked.ancestors[0] && inspectSelector(picked.ancestors[0].selector)}
                    disabled={!picked.ancestors[0] || resolving}
                    className="px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    title="Select the parent element"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    Wider
                  </button>
                  <div className="w-px h-5 bg-white/10" />
                  <button
                    type="button"
                    onClick={() => picked.children[0] && inspectSelector(picked.children[0].selector)}
                    disabled={!picked.children[0] || resolving}
                    className="px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    title="Select the first child element"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Narrower
                  </button>
                  <div className="w-px h-5 bg-white/10" />
                  <button
                    type="button"
                    onClick={() => picked.nextSibling && inspectSelector(picked.nextSibling.selector)}
                    disabled={!picked.nextSibling || resolving}
                    className="px-2.5 py-2 text-[12px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next sibling"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={pickAgain}
                  className="px-3 py-2 text-[12px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Pick again
                </button>

                <button
                  type="button"
                  onClick={apply}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-[13px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow"
                >
                  <Check className="w-4 h-4" />
                  Apply selector
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom hint — when nothing picked yet */}
        {!picked && !loading && screenshot && (
          <div className="border-t border-white/10 bg-slate-900/50 shrink-0 px-5 py-3 flex items-center gap-2 text-slate-400 text-[12.5px]">
            <Target className="w-4 h-4" />
            <span>Hover any region to preview its selector. Click to select.</span>
            {hovered && (
              <span className="ml-auto font-mono text-[11px] text-yellow-300 truncate max-w-[400px]">
                {hovered.selector}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
