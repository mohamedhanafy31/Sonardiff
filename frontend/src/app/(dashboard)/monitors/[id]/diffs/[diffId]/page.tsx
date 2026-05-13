'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Eye, Code, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthenticatedSnapshotImage } from '@/components/AuthenticatedSnapshotImage';

export default function DiffViewerPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const diffId = String(params?.diffId ?? '');

  const [monitor, setMonitor] = useState<any>(null);
  const [diff, setDiff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('text');

  useEffect(() => {
    if (!id || !diffId) {
      setLoading(false);
      return;
    }
    const fetchDiff = async () => {
      try {
        const { data } = await api.get(`/monitors/${id}/diffs/${diffId}`);
        setMonitor(data.monitor);
        setDiff(data.diff);
        if (data.diff?.snapshotNew?.screenshotUrl) {
          setActiveTab('visual');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [id, diffId]);

  if (!id || !diffId) {
    return <div className="text-ink-3">Invalid diff link.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!diff) return <div className="text-ink-3">Diff not found.</div>;

  const isExpired = diff.expiresAt ? new Date(diff.expiresAt) < new Date() : false;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/monitors/${id}`} className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">
              Changes on {monitor?.name}
            </h1>
            <p className="text-ink-4 text-[13px] mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Detected {diff.detectedAt ? new Date(diff.detectedAt).toLocaleString() : '—'}
              <span className="mx-1">·</span>
              <span className="font-mono text-accent-2">
                {Number.isFinite(Number(diff.changePercentage))
                  ? Number(diff.changePercentage).toFixed(2)
                  : '0.00'}
                % change
              </span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-bg-muted p-1 rounded-[10px] border border-line">
          <button
            onClick={() => setActiveTab('visual')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5",
              activeTab === 'visual' ? "bg-bg-card text-foreground shadow-sm" : "text-ink-4 hover:text-ink-3"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Visual
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5",
              activeTab === 'text' ? "bg-bg-card text-foreground shadow-sm" : "text-ink-4 hover:text-ink-3"
            )}
          >
            <Code className="w-3.5 h-3.5" />
            Text diff
          </button>
        </div>
      </div>

      {isExpired && (
        <div className="bg-[rgba(245,158,11,0.14)] border border-[rgba(245,158,11,0.3)] rounded-[14px] p-4 flex items-center gap-3 text-[#92400E] text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          This snapshot is old and its files may have been cleaned up.
        </div>
      )}

      {activeTab === 'visual' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">Before</h3>
            <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden aspect-video relative">
              {diff.snapshotOld?.screenshotUrl ? (
                <AuthenticatedSnapshotImage
                  src={diff.snapshotOld.screenshotUrl}
                  alt="Previous State"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-ink-4 text-sm">No screenshot</div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">After</h3>
            <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden aspect-video relative">
              {diff.snapshotNew?.screenshotUrl ? (
                <AuthenticatedSnapshotImage
                  src={diff.snapshotNew.screenshotUrl}
                  alt="New State"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-ink-4 text-sm">No screenshot</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden flex flex-col h-[calc(100vh-280px)]">
          {/* Legend bar */}
          <div className="px-5 py-3 bg-bg-soft border-b border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-[12px] font-medium">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-bg border border-red/30" />
                <span className="text-ink-3">Removed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-bg border border-green/30" />
                <span className="text-ink-3">Added</span>
              </div>
            </div>
            <div className="text-accent-2 font-mono text-[12px] font-medium">
              {Number.isFinite(Number(diff.changePercentage))
                ? Number(diff.changePercentage).toFixed(2)
                : '0.00'}
              % change
            </div>
          </div>

          {/* Diff content */}
          <div className="flex-1 overflow-auto p-4 bg-[#0B0F14] font-mono text-[13px] leading-relaxed">
            {diff.diffData && Array.isArray(diff.diffData) ? (
              <div className="space-y-px">
                {diff.diffData.flatMap((part: unknown, idx: number) => {
                  const p = part as { value?: string; added?: boolean; removed?: boolean };
                  const raw = typeof p?.value === 'string' ? p.value : '';
                  const lines = raw.split('\n');
                  return lines.flatMap((line: string, lineIdx: number) => {
                    if (line === '' && lineIdx === lines.length - 1) return [];
                    return [
                      <div
                        key={`${idx}-${lineIdx}`}
                        className={cn(
                          'px-4 py-0.5 rounded-sm flex',
                          p.added ? 'bg-[rgba(16,185,129,0.12)] text-[#6EE7B7]' :
                          p.removed ? 'bg-[rgba(239,68,68,0.12)] text-[#FCA5A5]' :
                          'text-[#94A3B8]/60'
                        )}
                      >
                        <span className="select-none inline-block w-6 text-[#64748B] border-r border-[rgba(255,255,255,0.06)] mr-3 pr-1 text-right text-[11px]">
                          {p.added ? '+' : p.removed ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
                      </div>,
                    ];
                  });
                })}
              </div>
            ) : (
              <div className="text-[#64748B] text-center py-20">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                Raw diff data could not be parsed or file was deleted.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
