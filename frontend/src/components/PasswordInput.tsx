'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<React.ComponentPropsWithRef<'input'>, 'type'> & {
  /** Classes for the outer wrapper (positioning, width) */
  wrapperClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, wrapperClassName, id, ...props }, ref) {
    const [show, setShow] = useState(false);
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className={cn('relative', wrapperClassName)}>
        <input
          ref={ref}
          id={inputId}
          type={show ? 'text' : 'password'}
          className={cn('w-full pr-11', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-4 hover:text-foreground hover:bg-bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
        </button>
      </div>
    );
  }
);
