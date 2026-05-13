'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  /** If set, user must type this exact string to enable the confirm button */
  requireTyping?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  requireTyping,
  loading,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const canConfirm = requireTyping ? typed === requireTyping : true;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-bg-card border border-line rounded-[16px] shadow-2xl w-full max-w-md mx-4 p-6 z-10">
        <button onClick={onCancel} className="absolute top-4 right-4 text-ink-4 hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-display text-[18px] font-semibold mb-2">{title}</h2>
        <p className="text-ink-3 text-[13.5px] leading-relaxed mb-4">{description}</p>

        {children && <div className="mb-4">{children}</div>}

        {requireTyping && (
          <div className="mb-4">
            <label className="text-[12px] text-ink-4 block mb-1.5">
              Type <span className="font-mono text-foreground">{requireTyping}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-soft border border-line text-sm text-foreground focus:outline-none focus:border-red/50 font-mono"
              placeholder={requireTyping}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-line text-ink-3 text-[13.5px] hover:bg-bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || loading}
            className={cn(
              'px-4 py-2 rounded-lg text-[13.5px] font-medium transition-colors flex items-center gap-2',
              confirmVariant === 'danger'
                ? 'bg-red/90 text-white hover:bg-red disabled:opacity-40'
                : 'bg-accent text-bg font-semibold hover:bg-accent/90 disabled:opacity-40'
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
