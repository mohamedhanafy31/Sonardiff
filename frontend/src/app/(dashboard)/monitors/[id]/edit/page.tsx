'use client';

import { useEffect, useState, use } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, AlertCircle, Trash2, MousePointerClick, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';
import { DomPickerModal } from '@/components/monitors/DomPickerModal';
import { CssSelectorHelpAnimation } from '@/components/monitors/CssSelectorHelpAnimation';
import { cn } from '@/lib/utils';

const editMonitorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Must be a valid URL'),
  checkIntervalMinutes: z.number().min(1),
  isActive: z.boolean(),
  cssSelector: z.string().optional(),
});

type EditMonitorForm = z.infer<typeof editMonitorSchema>;

const frequencies = [
  { value: 60, label: '1 hour', pro: true },
  { value: 360, label: '6 hours', pro: true },
  { value: 720, label: '12 hours', pro: false },
  { value: 1440, label: '1 day', pro: false },
  { value: 4320, label: '3 days', pro: false },
  { value: 10080, label: '7 days', pro: false },
];

export default function EditMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const router = useRouter();
  const { user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSelectorHelp, setShowSelectorHelp] = useState(false);
  const [showAdvancedSelector, setShowAdvancedSelector] = useState(false);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<EditMonitorForm>({
    resolver: zodResolver(editMonitorSchema),
  });

  useEffect(() => {
    const fetchMonitor = async () => {
      try {
        const { data } = await api.get(`/monitors/${id}`);
        reset({
          name: data.monitor.name,
          url: data.monitor.url,
          checkIntervalMinutes: data.monitor.checkIntervalMinutes,
          isActive: data.monitor.isActive,
          cssSelector: data.monitor.cssSelector || undefined,
        });
      } catch {
        setError('Failed to load monitor data');
      } finally {
        setLoading(false);
      }
    };
    fetchMonitor();
  }, [id, reset]);

  const interval = watch('checkIntervalMinutes');
  const isPro = user?.plan === 'pro';

  const onSubmit = async (data: EditMonitorForm) => {
    setError(null);
    try {
      await api.patch(`/monitors/${id}`, data);
      router.push('/monitors');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update monitor');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await api.delete(`/monitors/${id}`);
      router.push('/monitors');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete monitor');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/monitors/${id}`} className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Edit monitor</h1>
          <div className="text-ink-3 text-[14.5px] mt-0.5">Update your tracking configuration.</div>
        </div>
      </div>

      <div className="bg-bg-card border border-line rounded-[14px] p-6">
        {error && (
          <div className="bg-red-bg border border-red/20 text-red-ink p-4 rounded-[10px] mb-6 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-1.5">
            <label htmlFor="edit-name" className="text-[13px] font-medium text-ink-2">Monitor name</label>
            <input
              {...register('name')}
              id="edit-name"
              type="text"
              className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
            />
            {errors.name && <p className="text-red-ink text-xs">{errors.name.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="edit-url" className="text-[13px] font-medium text-ink-2">URL</label>
            <input
              {...register('url')}
              id="edit-url"
              type="url"
              className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground font-mono focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
            />
            {errors.url && <p className="text-red-ink text-xs">{errors.url.message}</p>}
          </div>

          <div>
            <label className="text-[13px] font-medium text-ink-2 mb-2 block">Check frequency</label>
            <div className="grid grid-cols-3 gap-2">
              {frequencies.map((freq) => {
                const disabled = freq.pro && !isPro;
                return (
                  <button
                    key={freq.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setValue('checkIntervalMinutes', freq.value)}
                    className={cn(
                      "py-2.5 px-3 rounded-[10px] text-[13px] font-medium border transition-all text-center",
                      interval === freq.value
                        ? "border-accent bg-accent/8 text-accent-2"
                        : disabled
                          ? "border-line bg-bg-muted text-ink-5 cursor-not-allowed opacity-50"
                          : "border-line bg-bg-card text-ink-3 hover:border-ink-5"
                    )}
                  >
                    {freq.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isPro && (
            <div className="grid gap-2">
              <label className="text-[13px] font-medium text-ink-2">Element to track</label>

              {/* Currently tracking summary */}
              <div className="bg-bg-soft border border-line rounded-[10px] p-3">
                <div className="text-[11px] text-ink-4 mb-0.5">Currently tracking</div>
                <div className="text-[13px] font-medium text-foreground truncate">
                  {watch('cssSelector') ? <span className="font-mono">{watch('cssSelector')}</span> : 'Full page'}
                </div>
              </div>

              {/* Primary action: visual picker */}
              <button
                type="button"
                onClick={() => {
                  if (!watch('url')) { setError('Enter a URL first.'); return; }
                  setIsPickerOpen(true);
                }}
                className="btn accent w-full flex items-center justify-center gap-2"
              >
                <MousePointerClick className="w-4 h-4" />
                {watch('cssSelector') ? 'Pick a different element' : 'Pick element to track'}
              </button>

              {watch('cssSelector') && (
                <button
                  type="button"
                  onClick={() => setValue('cssSelector', '', { shouldValidate: true })}
                  className="btn ghost sm w-full text-[12px]"
                >
                  Clear &amp; track full page
                </button>
              )}

              {/* Secondary: advanced text selector */}
              <button
                type="button"
                onClick={() => setShowAdvancedSelector(s => !s)}
                className="text-[12px] text-ink-4 hover:text-ink-2 transition-colors mt-1 flex items-center gap-1 self-start"
              >
                {showAdvancedSelector ? '−' : '+'} Advanced: paste a CSS selector
              </button>

              {showAdvancedSelector && (
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[12px] text-ink-3">CSS selector</label>
                    <button
                      type="button"
                      onClick={() => setShowSelectorHelp(s => !s)}
                      className="text-ink-4 hover:text-accent-2 transition-colors"
                      aria-label="How to find a CSS selector"
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
                        aria-label="Close help"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <CssSelectorHelpAnimation />
                    </div>
                  )}
                  <input
                    {...register('cssSelector')}
                    type="text"
                    placeholder="e.g. #pricing-table > tbody"
                    className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14px] font-mono text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-bg-soft rounded-[10px] border border-line">
            <input
              {...register('isActive')}
              type="checkbox"
              className="w-4 h-4 accent-accent rounded"
            />
            <div>
              <label className="text-[13px] font-medium text-foreground">Active monitoring</label>
              <p className="text-[12px] text-ink-4">Uncheck to pause all checks for this monitor.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn accent w-full h-11 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="mt-6 bg-red-bg/50 border border-red/10 rounded-[14px] p-5">
        <h4 className="text-[13px] font-semibold text-red-ink mb-1.5">Danger zone</h4>
        <p className="text-xs text-ink-4 mb-4">Deleting this monitor will also remove all its diff history. This cannot be undone.</p>

        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 h-9 bg-red hover:bg-red/90 text-white text-[13px] font-semibold rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, delete monitor'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 btn ghost sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 h-9 border border-red/20 hover:bg-red-bg text-red-ink text-[13px] font-medium rounded-[10px] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete monitor
          </button>
        )}
      </div>

      <DomPickerModal
        url={watch('url')}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(selector) => {
          setValue('cssSelector', selector, { shouldValidate: true });
        }}
      />
    </div>
  );
}
