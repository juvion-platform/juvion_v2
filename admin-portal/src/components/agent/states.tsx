/**
 * The render states every agent surface shares (STATE_OF_BUILD §B.6):
 * loading skeleton · populated · delayed empty · inline error + retry ·
 * transient toast. One copy, so finance and people cannot drift.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, Sparkles, X } from 'lucide-react';

export function LoadingBanner() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
    </div>
  );
}

export function ErrorBanner({ onRetry, message = 'Failed to load dashboard data.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
      <div className="text-sm text-red-700">{message}</div>
      <button
        onClick={onRetry}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white"
      >
        Retry
      </button>
    </div>
  );
}

/** Amber "X unavailable." strip with a retry — an agent feature failing must never take the page down. */
export function InlineRetry({ label, onRetry, className = '' }: { label: string; onRetry: () => void; className?: string }) {
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${className}`}>
      <div className="text-xs text-amber-800 flex items-center gap-1.5">
        <Sparkles size={12} aria-hidden />
        {label}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
      >
        Retry
      </button>
    </div>
  );
}

/** True only after `isEmpty` has held for `ms` — so a fast load never flashes an empty state. */
export function useDelayedEmpty(isEmpty: boolean, ms = 500): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isEmpty) {
      setShow(false);
      return undefined;
    }
    const t = window.setTimeout(() => setShow(true), ms);
    return () => window.clearTimeout(t);
  }, [isEmpty, ms]);
  return show;
}

export interface ToastState {
  kind: 'success' | 'info' | 'error';
  message: string;
}

/** Fixed top-right, auto-dismisses after 3.5s. */
export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 3500);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const cls =
    toast.kind === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : toast.kind === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-violet-50 border-violet-200 text-violet-800';
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? ShieldAlert : Sparkles;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[60] max-w-sm rounded-lg border px-4 py-3 shadow-lg ${cls}`}
    >
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button type="button" onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5" aria-label="Dismiss notification">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
