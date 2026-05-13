'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft, Search, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function DomPickerPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [url, setUrl] = useState(searchParams.get('url') || '');
  const [selector, setSelector] = useState(searchParams.get('selector') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ content: string } | null>(null);
  const [pageStatus, setPageStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [selectorError, setSelectorError] = useState<string | null>(null);

  const validateUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError(null);
    setUrlError(null);
    setSelectorError(null);
    setPageStatus(null);

    let valid = true;

    if (!url.trim()) {
      setUrlError('URL is required');
      valid = false;
    } else if (!validateUrl(url.trim())) {
      setUrlError('Must be a valid URL (e.g. https://example.com)');
      valid = false;
    }

    if (!selector.trim()) {
      setSelectorError('CSS selector is required');
      valid = false;
    }

    if (!valid) return;

    setLoading(true);
    try {
      const { data } = await api.post('/dom-picker/test-selector', {
        url: url.trim(),
        selector: selector.trim(),
      });
      setResult({ content: data.content });
      setPageStatus('200 OK');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to preview selector';
      setError(msg);
      setPageStatus(err.response?.status ? `${err.response.status} Error` : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsMonitor = () => {
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (selector) params.set('selector', selector);
    router.push(`/monitors/new?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/monitors" className="p-2 border border-line rounded-lg text-ink-4 hover:bg-bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">DOM Picker Preview</h1>
          <p className="text-ink-3 text-[14.5px] mt-0.5">
            Test a CSS selector against a live page before creating a monitor.
          </p>
        </div>
      </div>

      {user?.plan !== 'pro' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-[10px] mb-6 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>DOM Picker requires the <strong>Pro plan</strong>. Upgrade to use selector-based monitoring.</p>
        </div>
      )}

      <div className="bg-bg-card border border-line rounded-[14px] p-6 mb-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid gap-1.5">
            <label htmlFor="preview-url" className="text-[13px] font-medium text-ink-2">
              Page URL
            </label>
            <input
              id="preview-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground font-mono focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
            />
            {urlError && <p className="text-red-ink text-xs mt-0.5">{urlError}</p>}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="preview-selector" className="text-[13px] font-medium text-ink-2">
              CSS Selector
            </label>
            <input
              id="preview-selector"
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="h1, .price, #main-content"
              className="h-11 px-3.5 border border-line rounded-[10px] bg-bg-card text-[14.5px] text-foreground font-mono focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
            />
            {selectorError && <p className="text-red-ink text-xs mt-0.5">{selectorError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || user?.plan !== 'pro'}
            className="btn accent w-full h-11 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Previewing…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Preview selector
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-bg border border-red/20 text-red-ink p-4 rounded-[10px] mb-6 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Preview failed</p>
            <p className="text-xs mt-1 opacity-80">{error}</p>
            {pageStatus && <p className="text-xs mt-1 font-mono opacity-70">Status: {pageStatus}</p>}
          </div>
        </div>
      )}

      {result && (
        <div className="bg-bg-card border border-line rounded-[14px] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-[13px] font-medium">Selector matched content</span>
            </div>
            {pageStatus && (
              <span className="text-[11px] font-mono text-ink-4 bg-bg-soft px-2 py-0.5 rounded">
                {pageStatus}
              </span>
            )}
          </div>

          <div className="bg-bg-soft border border-line rounded-[10px] p-4 mb-4">
            <p className="text-[13px] font-medium text-ink-2 mb-1">Extracted content:</p>
            <pre className="text-[13px] text-foreground font-mono whitespace-pre-wrap break-words">
              {result.content}
            </pre>
          </div>

          <button
            type="button"
            onClick={handleSaveAsMonitor}
            className="btn primary w-full h-10 text-[14px]"
          >
            Save as monitor →
          </button>
        </div>
      )}
    </div>
  );
}

export default function DomPickerPreviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>}>
      <DomPickerPreviewContent />
    </Suspense>
  );
}
