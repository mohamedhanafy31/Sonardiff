'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, Plus, Trash2, AlertCircle, MousePointerClick,
  HelpCircle, X, Sparkles, Globe, RefreshCw, CheckCircle, ChevronDown,
  Zap, Info, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { DomPickerModal } from '@/components/monitors/DomPickerModal';
import { CssSelectorHelpAnimation } from '@/components/monitors/CssSelectorHelpAnimation';
import { DiscoveryStep } from '@/components/monitors/DiscoveryStep';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────
const newMonitorSchema = z.object({
  name: z.string().optional(),
  url: z.string().url('Must be a valid URL (include https://)'),
  checkIntervalMinutes: z.number().min(1),
  cssSelector: z.string().optional(),
  threshold: z.number().min(0.01).max(1),
  exclusionRules: z.array(z.object({
    type: z.enum(['keyword', 'regex']),
    value: z.string().min(1, 'Value required'),
  })),
});

type NewMonitorForm = z.infer<typeof newMonitorSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'URL' },
  { num: 2, label: 'Pages' },
  { num: 3, label: 'Element' },
  { num: 4, label: 'Schedule' },
];

const FREQUENCIES = [
  { value: 60,    label: '1 hour',   pro: true  },
  { value: 360,   label: '6 hours',  pro: true  },
  { value: 720,   label: '12 hours', pro: false },
  { value: 1440,  label: '1 day',    pro: false },
  { value: 4320,  label: '3 days',   pro: false },
  { value: 10080, label: '7 days',   pro: false },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewMonitorPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isPro = user?.plan === 'pro';

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [proNag, setProNag] = useState(false);

  // Mode
  const [mode, setMode] = useState<'single' | 'discover'>('single');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');

  // Element picker state
  // pickerTargetUrl = which URL the DOM picker is currently pointed at
  const [pickerTargetUrl, setPickerTargetUrl] = useState<string>('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Screenshots per URL (keyed by url string)
  const [screenshots, setScreenshots] = useState<Record<string, { url: string | null; loading: boolean; error: string | null }>>({});

  // Which URL is previewed in step 3 left panel
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Advanced
  const [showAdvancedSelector, setShowAdvancedSelector] = useState(false);
  const [showSelectorHelp, setShowSelectorHelp] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Form
  const { register, handleSubmit, watch, setValue, control,
    formState: { errors, isSubmitting }, trigger } = useForm<NewMonitorForm>({
    resolver: zodResolver(newMonitorSchema),
    defaultValues: { checkIntervalMinutes: 1440, threshold: 0.1, exclusionRules: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'exclusionRules' });

  const watchUrl   = watch('url');
  const watchName  = watch('name');
  const interval   = watch('checkIntervalMinutes');
  const threshold  = watch('threshold');
  const cssSelector = watch('cssSelector');

  // Auto-name
  const autoName = useMemo(() => {
    if (!watchUrl) return '';
    try {
      const u = new URL(watchUrl);
      const host = u.hostname.replace('www.', '');
      const seg  = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop();
      return seg ? `${host}/${seg}` : host;
    } catch { return ''; }
  }, [watchUrl]);

  const displayName = watchName?.trim() || autoName || 'Untitled monitor';

  // Quota
  const monitorCount     = mode === 'discover' ? Math.max(selectedUrls.size, 1) : 1;
  const checksPerMonth   = interval > 0 ? Math.floor((30 * 24 * 60) / interval) * monitorCount : 0;
  const remainingChecks  = user ? user.planLimit - user.checksUsedThisPeriod : 0;
  const isOverQuota      = checksPerMonth > remainingChecks;

  // Reset discovery state whenever the base URL changes
  useEffect(() => {
    setSelectedUrls(new Set());
    setScreenshots({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchUrl]);

  // ── Step 3: load screenshots for element picking
  // Compute which URLs need a screenshot on step 3 entry (capped at 10 for session perf)
  const TAB_CAP = 10;
  const urlsForPicking = useMemo(() => {
    if (mode === 'single') return watchUrl ? [watchUrl] : [];
    return Array.from(selectedUrls).slice(0, TAB_CAP);
  }, [mode, watchUrl, selectedUrls]);
  const hiddenUrlCount = mode === 'discover' ? Math.max(0, selectedUrls.size - TAB_CAP) : 0;

  // When entering step 3 (and pro), kick off screenshot loads for all target URLs
  useEffect(() => {
    if (step !== 3 || !isPro) return;
    for (const u of urlsForPicking) {
      if (screenshots[u]) continue; // already loading/loaded
      setScreenshots(prev => ({ ...prev, [u]: { url: null, loading: true, error: null } }));
      api.post('/dom-picker/screenshot', { url: u })
        .then(({ data }) => setScreenshots(prev => ({ ...prev, [u]: { url: data.screenshot, loading: false, error: null } })))
        .catch((e) => setScreenshots(prev => ({
          ...prev,
          [u]: { url: null, loading: false, error: e.response?.data?.error || 'Preview unavailable' },
        })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isPro, urlsForPicking.join(',')]);

  // Set default preview URL when entering step 3
  useEffect(() => {
    if (step !== 3) return;
    const first = urlsForPicking[0] || '';
    if (!previewUrl || !urlsForPicking.includes(previewUrl)) setPreviewUrl(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goToStep2 = async () => {
    const valid = await trigger(['url'] as any);
    if (!valid) return;
    if (!watchName?.trim() && autoName) setValue('name', autoName);
    if (mode === 'discover' && !groupName && autoName) setGroupName(autoName);
    // Single mode has no page-selection step — jump straight to element picker
    setStep(mode === 'single' ? 3 : 2);
  };

  const goToStep3 = () => {
    if (mode === 'discover' && selectedUrls.size === 0) return;
    setStep(3);
  };

  const goToStep4 = () => setStep(4);

  // Open picker for a specific URL
  const openPicker = (url: string) => {
    setPickerTargetUrl(url);
    setIsPickerOpen(true);
  };

  // Retry screenshot for a specific URL
  const retryScreenshot = (url: string) => {
    setScreenshots(prev => ({ ...prev, [url]: { url: null, loading: true, error: null } }));
    api.post('/dom-picker/screenshot', { url })
      .then(({ data }) => setScreenshots(prev => ({ ...prev, [url]: { url: data.screenshot, loading: false, error: null } })))
      .catch((e) => setScreenshots(prev => ({
        ...prev,
        [url]: { url: null, loading: false, error: e.response?.data?.error || 'Preview unavailable' },
      })));
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (data: NewMonitorForm) => {
    if (isOverQuota) {
      setError('This would exceed your remaining quota. Lower the frequency or upgrade your plan.');
      return;
    }
    setError(null);
    const finalName = data.name?.trim() || autoName || 'Untitled monitor';
    try {
      if (mode === 'discover') {
        if (selectedUrls.size === 0) { setError('Pick at least one page to monitor.'); return; }
        await api.post('/monitors/bulk', {
          urls: Array.from(selectedUrls),
          shared: {
            checkIntervalMinutes: data.checkIntervalMinutes,
            threshold: data.threshold,
            cssSelector: data.cssSelector || undefined,
            exclusionRules: data.exclusionRules,
          },
          groupName: groupName.trim() || autoName || 'Monitored site',
          baseUrl: data.url,
        });
      } else {
        await api.post('/monitors', { ...data, name: finalName });
      }
      router.push('/monitors?created=1');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create monitor');
    }
  };

  const thresholdLabel = () => {
    if (threshold <= 0.05) return 'Very sensitive — tiny changes alert';
    if (threshold <= 0.15) return 'Balanced — moderate changes alert';
    if (threshold <= 0.4)  return 'Relaxed — significant changes alert';
    return 'High threshold — only major changes alert';
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-7">
        <Link href="/monitors" className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">New monitor</h1>
          <div className="text-ink-3 text-[14.5px] mt-0.5">
            {step === 1 && 'Choose what to monitor.'}
            {step === 2 && (mode === 'single' ? 'Confirm the page.' : 'Select pages to watch.')}
            {step === 3 && 'Choose which element to track.'}
            {step === 4 && 'Set frequency, sensitivity and review.'}
          </div>
        </div>
        {watchUrl && (
          <div className="ml-auto text-[12px] text-ink-4 font-mono truncate max-w-[220px] opacity-60 hidden sm:block">
            {(() => { try { return new URL(watchUrl).hostname; } catch { return ''; } })()}
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-7 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { if (s.num < step) setStep(s.num); }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap",
                step === s.num
                  ? "bg-accent/10 text-accent-2 border border-accent/30"
                  : step > s.num
                    ? "bg-green-bg text-green-ink border border-green/30 cursor-pointer hover:bg-green-bg/70"
                    : "bg-bg-muted text-ink-4 border border-line cursor-default"
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0",
                step === s.num ? "bg-accent text-[#042F36]" : step > s.num ? "bg-green text-white" : "bg-line text-ink-4"
              )}>
                {step > s.num ? '✓' : s.num}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-line shrink-0" />}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-bg border border-red/20 text-red-ink p-4 rounded-[12px] mb-6 text-sm flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-ink/60 hover:text-red-ink shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ════════════════════════════════════════
              LEFT PANEL — step content
          ════════════════════════════════════════ */}
          <div className={cn(
            "bg-bg-card border border-line rounded-[14px] overflow-hidden",
            step === 3 ? "flex flex-col" : "min-h-[340px]",
          )} style={step === 3 ? { height: 'calc(100vh - 260px)', minHeight: 560 } : undefined}>

            {/* ── STEP 1: URL + mode ── */}
            {step === 1 && (
              <div className="p-8">
                <h3 className="text-[16px] font-semibold mb-5">What do you want to monitor?</h3>

                {/* Mode cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    {
                      id: 'single' as const,
                      icon: <Globe className="w-4 h-4" />,
                      title: 'Single page',
                      desc: 'Track one specific URL for changes.',
                      pro: false,
                    },
                    {
                      id: 'discover' as const,
                      icon: <Sparkles className="w-4 h-4" />,
                      title: 'Entire site',
                      desc: 'Discover & pick multiple pages at once.',
                      pro: true,
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (m.pro && !isPro) { setProNag(true); return; }
                        setProNag(false);
                        setMode(m.id);
                      }}
                      className={cn(
                        "relative flex flex-col items-start gap-2.5 p-4 rounded-[12px] border text-left transition-all",
                        mode === m.id ? "border-accent bg-accent/8" : "border-line bg-bg-soft hover:border-ink-5"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        mode === m.id ? "bg-accent text-[#042F36]" : "bg-bg-muted text-ink-4"
                      )}>
                        {m.icon}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold text-foreground flex items-center gap-1.5">
                          {m.title}
                          {m.pro && <span className="text-[9.5px] bg-accent/15 text-accent-2 border border-accent/30 px-1.5 py-0.5 rounded-full font-semibold">Pro</span>}
                        </div>
                        <div className="text-[12px] text-ink-4 mt-0.5 leading-snug">{m.desc}</div>
                      </div>
                      {mode === m.id && <CheckCircle className="w-4 h-4 text-accent-2 absolute top-3 right-3" />}
                    </button>
                  ))}
                </div>

                {proNag && (
                  <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-[10px] text-[13px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Entire site discovery requires the <strong>Pro plan</strong>.</span>
                    <Link href="/billing" className="ml-auto text-amber-300 underline text-[12px] shrink-0">Upgrade →</Link>
                  </div>
                )}

                <div className="space-y-4">
                  {/* URL */}
                  <div className="grid gap-1.5">
                    <label className="text-[13px] font-medium text-ink-2">
                      {mode === 'discover' ? 'Site URL (root domain)' : 'Page URL'}
                    </label>
                    <input
                      {...register('url')}
                      type="url"
                      autoFocus
                      placeholder={mode === 'discover' ? 'https://competitor.com' : 'https://competitor.com/pricing'}
                      className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground font-mono focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                    />
                    {errors.url && (
                      <p className="text-red-ink text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.url.message}
                      </p>
                    )}
                  </div>

                  {/* Name / Group name */}
                  {mode === 'discover' ? (
                    <div className="grid gap-1.5">
                      <label className="text-[13px] font-medium text-ink-2">
                        Group name <span className="text-ink-4 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder={autoName || 'e.g. Competitor site'}
                        className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                      />
                      <p className="text-[11.5px] text-ink-4">All selected pages will be grouped under this name.</p>
                    </div>
                  ) : (
                    <div className="grid gap-1.5">
                      <label className="text-[13px] font-medium text-ink-2">
                        Monitor name <span className="text-ink-4 font-normal">(optional — auto-filled)</span>
                      </label>
                      <input
                        {...register('name')}
                        type="text"
                        placeholder={autoName || 'e.g. Competitor Pricing Page'}
                        className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                      />
                      {autoName && !watchName?.trim() && (
                        <p className="text-[11.5px] text-ink-4 flex items-center gap-1">
                          <Info className="w-3 h-3 shrink-0" />
                          Will be saved as &ldquo;<strong className="text-ink-3">{autoName}</strong>&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: Pages ── */}
            {step === 2 && mode === 'single' && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                {/* Browser frame mockup */}
                <div className="w-full max-w-md bg-bg-soft border border-line rounded-[12px] overflow-hidden mb-6">
                  <div className="frame-bar">
                    <div className="dots"><span /><span /><span /></div>
                    <div className="addr truncate flex-1 text-left">{watchUrl}</div>
                    <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="text-ink-4 hover:text-accent transition-colors" title="Open in new tab">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="p-5 flex items-center justify-center min-h-[80px]">
                    <p className="text-[13px] text-ink-3">This page will be monitored for changes.</p>
                  </div>
                </div>
                <p className="text-ink-4 text-[12.5px] max-w-xs">
                  You&apos;ll choose <em>which element</em> to track in the next step.
                </p>
              </div>
            )}

            {step === 2 && mode === 'discover' && (
              <DiscoveryStep
                url={watchUrl}
                selected={selectedUrls}
                onChange={setSelectedUrls}
                quotaSummary={
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-3">
                      <strong className="text-foreground">{selectedUrls.size}</strong>{' '}
                      page{selectedUrls.size !== 1 ? 's' : ''} →{' '}
                      <strong className={cn('ml-0.5', isOverQuota ? 'text-red-ink' : 'text-foreground')}>
                        {checksPerMonth.toLocaleString()}
                      </strong> checks/mo
                    </span>
                    <span className="text-ink-4">{remainingChecks.toLocaleString()} remaining</span>
                  </div>
                }
              />
            )}

            {/* ── STEP 3: Element picker ── */}
            {step === 3 && (
              <ElementPickerPanel
                mode={mode}
                isPro={isPro}
                urlsForPicking={urlsForPicking}
                hiddenUrlCount={hiddenUrlCount}
                totalSelectedCount={selectedUrls.size}
                previewUrl={previewUrl}
                onPreviewUrlChange={setPreviewUrl}
                cssSelector={cssSelector || ''}
                screenshots={screenshots}
                onOpenPicker={openPicker}
                onRetryScreenshot={retryScreenshot}
                onClearSelector={() => setValue('cssSelector', '')}
                register={register}
                showAdvancedSelector={showAdvancedSelector}
                setShowAdvancedSelector={setShowAdvancedSelector}
                showSelectorHelp={showSelectorHelp}
                setShowSelectorHelp={setShowSelectorHelp}
              />
            )}

            {/* ── STEP 4: Review summary ── */}
            {step === 4 && (
              <div className="p-8">
                <h3 className="text-[16px] font-semibold mb-1.5">Review &amp; confirm</h3>
                <p className="text-ink-3 text-[14px] mb-5">
                  {mode === 'discover'
                    ? `${selectedUrls.size} monitor${selectedUrls.size !== 1 ? 's' : ''} will be created.`
                    : 'Check your settings before saving.'}
                </p>

                <div className="rounded-[12px] border border-line overflow-hidden">
                  {mode === 'discover' ? (
                    <>
                      <ReviewRow label="Group name" value={groupName || autoName || 'Monitored site'} />
                      <ReviewRow label="Pages selected" value={String(selectedUrls.size)} />
                      <div className="px-4 py-3 border-t border-line-soft">
                        <div className="text-[11.5px] text-ink-4 mb-1.5 font-semibold uppercase tracking-[0.06em]">Selected URLs</div>
                        <div className="max-h-[110px] overflow-y-auto space-y-0.5">
                          {Array.from(selectedUrls).map(u => (
                            <div key={u} className="text-[11.5px] font-mono text-ink-3 truncate">{u}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <ReviewRow label="URL" value={watchUrl} mono />
                      <ReviewRow label="Name" value={displayName} />
                    </>
                  )}
                  <ReviewRow label="Track" value={cssSelector || 'Full page'} mono={!!cssSelector} />
                  <ReviewRow label="Check every" value={FREQUENCIES.find(f => f.value === interval)?.label || `${interval}m`} />
                  <ReviewRow label="Alert threshold" value={`${(threshold * 100).toFixed(0)}% change`} />
                  <ReviewRow label="Exclusion rules" value={fields.length === 0 ? 'None' : `${fields.length} rule${fields.length !== 1 ? 's' : ''}`} />
                </div>

                {/* Quota summary */}
                <div className={cn(
                  "mt-4 rounded-[12px] p-4 flex items-center justify-between",
                  isOverQuota ? "bg-red-bg border border-red/20" : "bg-accent/4 border border-accent/20"
                )}>
                  <div>
                    <span className="font-display text-[22px] font-semibold">{checksPerMonth.toLocaleString()}</span>
                    <span className="text-ink-4 ml-1.5 text-[13px]">checks / month</span>
                  </div>
                  <div className="text-right text-[12px]">
                    <div className={isOverQuota ? 'text-red-ink font-medium' : 'text-ink-4'}>
                      {isOverQuota ? '⚠ Exceeds quota' : `${remainingChecks.toLocaleString()} remaining`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════
              RIGHT PANEL — config + nav
          ════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Element summary (step 3+) — shows what's currently targeted */}
            {step >= 3 && (
              <div className="bg-bg-card border border-line rounded-[14px] p-5">
                <h4 className="text-[11.5px] font-semibold text-ink-4 uppercase tracking-[0.08em] mb-3">Element target</h4>
                <div className="bg-bg-soft border border-line rounded-[10px] p-3">
                  <div className="text-[11px] text-ink-4 mb-0.5">Tracking</div>
                  <div className="text-[13px] font-medium truncate">
                    {cssSelector
                      ? <span className="font-mono text-accent-2">{cssSelector}</span>
                      : <span className="text-ink-3">Full page</span>}
                  </div>
                </div>
                {step === 4 && isPro && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-[12px] text-accent-2 hover:underline mt-2 block"
                  >
                    ← Change element
                  </button>
                )}
              </div>
            )}

            {/* Frequency (step 4) */}
            {step >= 4 && (
              <div className="bg-bg-card border border-line rounded-[14px] p-5">
                <h4 className="text-[11.5px] font-semibold text-ink-4 uppercase tracking-[0.08em] mb-3">Check frequency</h4>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCIES.map((freq) => {
                    const locked = freq.pro && !isPro;
                    return (
                      <button
                        key={freq.value}
                        type="button"
                        disabled={locked}
                        onClick={() => setValue('checkIntervalMinutes', freq.value)}
                        title={locked ? 'Requires Pro plan' : `Check every ${freq.label}`}
                        className={cn(
                          "relative py-2.5 px-2 rounded-lg text-[12.5px] font-medium border transition-all text-center",
                          interval === freq.value
                            ? "border-accent bg-accent/8 text-accent-2"
                            : locked
                              ? "border-line bg-bg-muted text-ink-5 cursor-not-allowed opacity-50"
                              : "border-line bg-bg-card text-ink-3 hover:border-accent/50 hover:text-foreground"
                        )}
                      >
                        {freq.label}
                        {locked && (
                          <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-accent/15 text-accent-2 border border-accent/25 px-1 rounded-full">Pro</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly impact (step 4) */}
            {step >= 4 && (
              <div className={cn(
                "border rounded-[14px] p-4",
                isOverQuota ? "bg-red-bg/60 border-red/25" : "bg-accent/4 border-accent/20"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-accent-2" />
                  <h4 className="text-[11.5px] font-semibold text-ink-4 uppercase tracking-[0.08em]">Monthly impact</h4>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-display text-[24px] font-semibold tracking-tight">{checksPerMonth.toLocaleString()}</span>
                    <span className="text-ink-4 text-[12px] ml-1">checks/mo</span>
                  </div>
                  <div className="text-right text-[12px]">
                    <div className="text-ink-4">Remaining</div>
                    <div className={cn("font-mono font-medium", isOverQuota ? "text-red-ink" : "text-foreground")}>
                      {remainingChecks.toLocaleString()}
                    </div>
                  </div>
                </div>
                {isOverQuota && (
                  <p className="text-[12px] text-red-ink mt-2 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Exceeds quota. Lower frequency or upgrade.
                  </p>
                )}
              </div>
            )}

            {/* Sensitivity (step 4) */}
            {step >= 4 && (
              <div className="bg-bg-card border border-line rounded-[14px] p-5">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-[11.5px] font-semibold text-ink-4 uppercase tracking-[0.08em]">Alert sensitivity</h4>
                  <span className="text-xs font-mono font-semibold text-accent-2 bg-accent/8 px-2 py-0.5 rounded-full">
                    {(threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10.5px] text-ink-4 mb-1.5">
                  <span>More sensitive</span>
                  <span>Less sensitive</span>
                </div>
                <input
                  {...register('threshold', { valueAsNumber: true })}
                  type="range" min="0.01" max="1" step="0.01"
                  className="w-full accent-accent"
                />
                <p className="text-[12px] text-ink-4 mt-2">{thresholdLabel()}</p>
              </div>
            )}

            {/* Advanced options (step 4) */}
            {step >= 4 && (
              <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(s => !s)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-[13px] font-medium text-ink-3 hover:bg-bg-soft transition-colors"
                >
                  <span className="flex items-center gap-2">
                    Advanced options
                    {fields.length > 0 && (
                      <span className="text-[11px] bg-accent/12 text-accent-2 border border-accent/25 px-1.5 py-0.5 rounded-full font-semibold">
                        {fields.length} rule{fields.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvancedOptions && "rotate-180")} />
                </button>

                {showAdvancedOptions && (
                  <div className="px-5 pb-5 border-t border-line pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-[13px] font-semibold">Exclusion rules</h4>
                        <p className="text-[11.5px] text-ink-4 mt-0.5">Ignore content matching these patterns.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => append({ type: 'keyword', value: '' })}
                        className="text-accent-2 text-xs font-medium flex items-center gap-1 hover:underline shrink-0 mt-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add rule
                      </button>
                    </div>

                    {fields.length === 0 ? (
                      <div className="text-[12px] text-ink-4 py-3 text-center bg-bg-soft rounded-lg border border-line-soft">
                        No rules — all changes will trigger alerts.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fields.map((field, index) => (
                          <div key={field.id} className="flex gap-2 items-start">
                            <select
                              {...register(`exclusionRules.${index}.type` as const)}
                              className="h-8 px-2 border border-line rounded-md bg-bg-card text-[12px] text-foreground focus:outline-none focus:border-accent shrink-0"
                            >
                              <option value="keyword">Keyword</option>
                              <option value="regex">Regex</option>
                            </select>
                            <div className="flex-1">
                              <input
                                {...register(`exclusionRules.${index}.value` as const)}
                                className="w-full h-8 px-2.5 border border-line rounded-md bg-bg-card text-[12px] text-foreground font-mono focus:outline-none focus:border-accent"
                                placeholder={watch(`exclusionRules.${index}.type`) === 'keyword' ? 'e.g. out of stock' : 'e.g. \\d+ items'}
                              />
                              {errors.exclusionRules?.[index]?.value && (
                                <p className="text-red-ink text-[11px] mt-0.5">{errors.exclusionRules[index]?.value?.message}</p>
                              )}
                            </div>
                            <button type="button" onClick={() => remove(index)} className="p-1 mt-1 text-ink-4 hover:text-red transition-colors shrink-0" title="Remove rule">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-1">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step === 3 && mode === 'single' ? 1 : step - 1)}
                  className="btn ghost"
                >
                  ← Back
                </button>
              )}
              {step === 1 && (
                <button type="button" onClick={goToStep2} className="btn accent flex-1">
                  Continue →
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  onClick={goToStep3}
                  disabled={mode === 'discover' && selectedUrls.size === 0}
                  className="btn accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mode === 'discover' && selectedUrls.size === 0
                    ? 'Select at least one page'
                    : mode === 'discover'
                      ? `Continue → (${selectedUrls.size} page${selectedUrls.size !== 1 ? 's' : ''})`
                      : 'Continue →'}
                </button>
              )}
              {step === 3 && (
                <button type="button" onClick={goToStep4} className="btn accent flex-1">
                  Continue →
                </button>
              )}
              {step === 4 && (
                <button
                  type="submit"
                  disabled={isSubmitting || isOverQuota || (mode === 'discover' && selectedUrls.size === 0)}
                  className="btn accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    : mode === 'discover'
                      ? `Create ${selectedUrls.size} monitor${selectedUrls.size !== 1 ? 's' : ''} →`
                      : 'Save monitor →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* DOM picker modal — pointed at pickerTargetUrl */}
      <DomPickerModal
        url={pickerTargetUrl}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(selector) => {
          setValue('cssSelector', selector, { shouldValidate: true });
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Step 3: Element picker panel — handles both single and discover modes */
function ElementPickerPanel({
  mode, isPro, urlsForPicking, hiddenUrlCount, totalSelectedCount, previewUrl, onPreviewUrlChange,
  cssSelector, screenshots, onOpenPicker, onRetryScreenshot, onClearSelector,
  register, showAdvancedSelector, setShowAdvancedSelector, showSelectorHelp, setShowSelectorHelp,
}: {
  mode: 'single' | 'discover';
  isPro: boolean;
  urlsForPicking: string[];
  hiddenUrlCount: number;
  totalSelectedCount: number;
  previewUrl: string;
  onPreviewUrlChange: (url: string) => void;
  cssSelector: string;
  screenshots: Record<string, { url: string | null; loading: boolean; error: string | null }>;
  onOpenPicker: (url: string) => void;
  onRetryScreenshot: (url: string) => void;
  onClearSelector: () => void;
  register: any;
  showAdvancedSelector: boolean;
  setShowAdvancedSelector: (v: boolean) => void;
  showSelectorHelp: boolean;
  setShowSelectorHelp: (v: boolean) => void;
}) {
  const ss = screenshots[previewUrl];

  return (
    <div className="flex flex-col h-full">
      {/* ── Page selector tabs (discover mode with multiple URLs) ── */}
      {mode === 'discover' && urlsForPicking.length > 1 && (
        <div className="border-b border-line bg-bg-soft px-4 py-2.5 flex gap-1.5 overflow-x-auto">
          <div className="text-[11px] text-ink-4 font-semibold uppercase tracking-[0.08em] py-1 pr-2 shrink-0">Pick from:</div>
          {urlsForPicking.map((u) => {
            let label = u;
            try { const parsed = new URL(u); label = parsed.pathname === '/' ? parsed.hostname.replace('www.', '') : parsed.pathname; } catch {}
            const isActive = u === previewUrl;
            const ss = screenshots[u];
            return (
              <button
                key={u}
                type="button"
                onClick={() => onPreviewUrlChange(u)}
                title={u}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium whitespace-nowrap transition-all shrink-0 border",
                  isActive
                    ? "bg-bg-card border-accent text-accent-2"
                    : "bg-bg-muted border-line text-ink-4 hover:text-foreground hover:border-ink-5"
                )}
              >
                {ss?.loading && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                {!ss?.loading && ss?.url && <span className="w-2 h-2 rounded-full bg-green shrink-0" />}
                {!ss?.loading && !ss?.url && !ss?.error && <span className="w-2 h-2 rounded-full bg-line shrink-0" />}
                {ss?.error && <span className="w-2 h-2 rounded-full bg-red shrink-0" />}
                <span className="truncate max-w-[120px]">{label}</span>
              </button>
            );
          })}
          {hiddenUrlCount > 0 && (
            <div className="flex items-center px-3 py-1.5 text-[11px] text-ink-4 shrink-0 italic">
              +{hiddenUrlCount} more (selector will apply to all {totalSelectedCount})
            </div>
          )}
        </div>
      )}

      {/* ── Page preview area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Browser chrome — stays pinned at top */}
        <div className="frame-bar shrink-0">
          <div className="dots"><span /><span /><span /></div>
          <div className="addr truncate flex-1">{previewUrl}</div>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-ink-4 hover:text-accent transition-colors" title="Open page">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">

        {!isPro ? (
          /* Free: explain full-page tracking */
          <div className="p-10 flex flex-col items-center justify-center text-center min-h-[240px]">
            <div className="w-14 h-14 rounded-2xl bg-accent/8 border border-accent/15 flex items-center justify-center mb-4">
              <MousePointerClick className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-[16px] font-semibold mb-2">Full-page tracking</h3>
            <p className="text-ink-3 text-[14px] max-w-xs leading-relaxed mb-4">
              Your monitor will track <strong className="text-foreground">all content</strong> on the page.
              Upgrade to Pro to target a specific element.
            </p>
            <Link href="/billing" className="btn ghost sm text-[12px]">See Pro features →</Link>
          </div>
        ) : ss?.loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-7 h-7 text-accent animate-spin mb-3" />
            <p className="text-ink-3 text-[13px]">Loading page preview…</p>
            <p className="text-ink-4 text-[12px] mt-1">5–15 seconds</p>
          </div>
        ) : ss?.error ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-red-bg flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5 text-red" />
            </div>
            <p className="text-[14px] font-medium mb-1">Preview unavailable</p>
            <p className="text-ink-4 text-[12.5px] mb-4">{ss.error}</p>
            <button type="button" onClick={() => onRetryScreenshot(previewUrl)} className="btn ghost sm flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
            <p className="text-[11.5px] text-ink-4 mt-3">Use the CSS selector input to target an element.</p>
          </div>
        ) : ss?.url ? (
          <div className="p-4 relative group cursor-crosshair" onClick={() => onOpenPicker(previewUrl)}>
            <img src={ss.url} alt="Page preview" className="w-full rounded-lg border border-line" />
            {/* Click overlay hint */}
            <div className="absolute inset-4 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <div className="bg-slate-900/90 text-white text-[13px] font-medium px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg">
                <MousePointerClick className="w-4 h-4" />
                Click to open element picker
              </div>
            </div>
          </div>
        ) : !previewUrl ? (
          <div className="flex items-center justify-center py-16 text-ink-4 text-[13px]">
            No page selected
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-ink-4 text-[13px]">
            Preview loading…
          </div>
        )}
        </div>{/* end scrollable content */}
      </div>

      {/* ── Selector actions bar (Pro only) ── */}
      {isPro && previewUrl && (
        <div className="border-t border-line bg-bg-soft px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenPicker(previewUrl)}
              className="btn accent flex items-center gap-2 flex-1 min-w-[140px]"
            >
              <MousePointerClick className="w-4 h-4" />
              {cssSelector ? 'Change element' : 'Pick element visually'}
            </button>
            {cssSelector && (
              <button type="button" onClick={onClearSelector} className="btn ghost sm text-[12px]">
                ✕ Track full page
              </button>
            )}
          </div>

          {/* Current selector display */}
          {cssSelector && (
            <div className="bg-bg-card border border-accent/25 rounded-[8px] px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] text-ink-4 shrink-0">Selector:</span>
              <code className="text-[12px] font-mono text-accent-2 truncate flex-1">{cssSelector}</code>
            </div>
          )}

          {/* Discover-mode warning: selector applies to ALL selected pages */}
          {mode === 'discover' && cssSelector && totalSelectedCount > 1 && (
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/25 rounded-[8px] px-3 py-2.5 text-[12px] text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                This selector will be applied to <strong>all {totalSelectedCount} selected pages</strong>.
                Make sure it exists on every page, or leave empty to track the full page.
              </span>
            </div>
          )}

          {/* Manual CSS input toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedSelector(!showAdvancedSelector)}
            className="text-[12px] text-ink-4 hover:text-ink-2 transition-colors flex items-center gap-1"
          >
            {showAdvancedSelector ? '−' : '+'} Paste a CSS selector manually
          </button>

          {showAdvancedSelector && (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[12px] text-ink-3">CSS selector</label>
                <button
                  type="button"
                  onClick={() => setShowSelectorHelp(!showSelectorHelp)}
                  className="text-ink-4 hover:text-accent-2 transition-colors"
                  title="How to find a CSS selector"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              {showSelectorHelp && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSelectorHelp(false)}
                    className="absolute top-2 right-2 z-20 p-1 rounded bg-black/40 hover:bg-black/60 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <CssSelectorHelpAnimation />
                </div>
              )}
              <input
                {...register('cssSelector')}
                type="text"
                placeholder="e.g. #pricing-table .price"
                className="h-9 px-3 border border-line rounded-lg bg-bg-card text-[13px] font-mono text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-line-soft first:border-t-0 gap-4">
      <span className="text-ink-4 text-[13px] shrink-0">{label}</span>
      <span className={cn("text-[13px] text-right truncate max-w-[220px]", mono && "font-mono text-accent-2")}>
        {value}
      </span>
    </div>
  );
}
