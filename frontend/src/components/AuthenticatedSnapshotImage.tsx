'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `/api/snapshots/foo.jpeg` + axios base `/api` → request `/snapshots/foo.jpeg` */
function axiosPathFromScreenshotUrl(screenshotUrl: string): string {
  const u = screenshotUrl.trim();
  if (u.startsWith('/api/')) return u.slice('/api'.length);
  if (u.startsWith('/')) return u;
  return `/snapshots/${u.replace(/^\//, '')}`;
}

type Props = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Snapshot files are served behind Bearer auth; plain <img src> never sends the token.
 * Load bytes with axios (interceptor adds Authorization) and display as a blob URL.
 */
export function AuthenticatedSnapshotImage({ src, alt, className }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setBlobUrl(null);

    (async () => {
      try {
        const path = axiosPathFromScreenshotUrl(src);
        const { data } = await api.get(path, { responseType: 'blob' });
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(data);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  if (failed) {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center text-ink-4 text-sm px-4 text-center', className)}>
        Could not load screenshot (check auth or file on server).
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center bg-bg-muted/30', className)}>
        <Loader2 className="w-8 h-8 text-accent animate-spin" aria-hidden />
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
