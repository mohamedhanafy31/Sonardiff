'use client';

import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Clock, ExternalLink, Play, Loader2, Settings2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const { user } = useAuthStore();
  const [monitor, setMonitor] = useState<any>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkToast, setCheckToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [monitorRes, diffsRes] = await Promise.all([
          api.get(`/monitors/${id}`),
          api.get(`/monitors/${id}/diffs`),
        ]);
        setMonitor(monitorRes.data.monitor);
        setDiffs(diffsRes.data.diffs);
      } catch (err: any) {
        if (err.response?.status === 404 || err.response?.status === 403) {
          setNotFound(true);
        }
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleCheckNow = async () => {
    setChecking(true);
    setCheckToast(null);
    try {
      const { data } = await api.post(`/monitors/${id}/check`);
      setCheckToast({ type: 'success', message: data.message || 'Check enqueued! It may take a minute to process.' });
    } catch (err: any) {
      setCheckToast({ type: 'error', message: err.response?.data?.error || 'Failed to trigger check.' });
    } finally {
      setChecking(false);
      setTimeout(() => setCheckToast(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (notFound || !monitor) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="p-5 bg-red-bg/60 rounded-2xl border border-red/10 mb-6 inline-block">
          <AlertCircle className="w-10 h-10 text-red-ink mx-auto" />
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">Monitor not found</h2>
        <p className="text-ink-3 text-sm mb-6">
          This monitor does not exist or you do not have permission to view it.
        </p>
        <Link href="/monitors" className="btn primary">
          Back to monitors
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/monitors" className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[28px] font-semibold tracking-tight">{monitor.name}</h1>
              <span className={`pill text-[11px] ${monitor.isActive ? 'live' : 'paused'}`}>
                <span className="dot" />
                {monitor.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
            <a href={monitor.url} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline flex items-center gap-1.5 text-[13px] mt-1">
              {monitor.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/monitors/${id}/edit`} className="btn ghost sm">
            <Settings2 className="w-3.5 h-3.5" />
            Edit
          </Link>
          <button
            onClick={handleCheckNow}
            disabled={checking || user?.plan !== 'pro' || (user?.manualChecksUsedThisPeriod ?? 0) >= 50}
            title={user?.plan !== 'pro' ? 'Manual checks are a Pro feature' : (user?.manualChecksUsedThisPeriod ?? 0) >= 50 ? 'Monthly manual check limit reached' : 'Trigger a manual check now'}
            className="btn accent sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Check now
          </button>
        </div>
      </div>

      {/* Inline check toast */}
      {checkToast && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-[10px] mb-5 text-sm border ${
          checkToast.type === 'success'
            ? 'bg-green-bg border-green/20 text-green-ink'
            : 'bg-red-bg border-red/20 text-red-ink'
        }`}>
          {checkToast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {checkToast.message}
        </div>
      )}

      {/* Change history */}
      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Change history</h3>
          <span className="text-xs text-ink-4 font-mono">{diffs.length} changes</span>
        </div>

        {diffs.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bg-muted mb-4">
              <Clock className="w-6 h-6 text-ink-4" />
            </div>
            <h3 className="text-[16px] font-semibold mb-2">No changes detected yet</h3>
            <p className="text-ink-3 text-[14px] max-w-sm mx-auto">
              The first check will establish a baseline. Subsequent checks will show changes here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {diffs.map((diff) => (
              <Link
                key={diff.id}
                href={`/monitors/${id}/diffs/${diff.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-bg-soft/50 transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-bg-muted flex flex-col items-center justify-center text-xs shrink-0">
                  <span className="font-semibold text-foreground">{new Date(diff.detectedAt).getDate()}</span>
                  <span className="text-ink-5 uppercase text-[10px]">{new Date(diff.detectedAt).toLocaleString('default', { month: 'short' })}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[13.5px] group-hover:text-accent-2 transition-colors">Content changed</span>
                    <span className="pill text-[11px] warn">
                      <span className="dot" />
                      {Number(diff.changePercentage).toFixed(1)}% diff
                    </span>
                  </div>
                  <div className="text-xs text-ink-4 mt-0.5 font-mono truncate">{diff.changeSummary}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-ink-3 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(diff.detectedAt).toLocaleTimeString()}
                  </div>
                  <span className="text-accent-2 text-[12px] font-medium group-hover:underline">View diff →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
