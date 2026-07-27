import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '../../stores/toastStore';

const STYLES: Record<ToastVariant, { ring: string; icon: string; Icon: typeof Info }> = {
  success: { ring: 'border-teal-200', icon: 'text-teal-600', Icon: CheckCircle2 },
  error: { ring: 'border-red-200', icon: 'text-red-600', Icon: XCircle },
  warning: { ring: 'border-orange-200', icon: 'text-orange-600', Icon: AlertTriangle },
  info: { ring: 'border-primary-200', icon: 'text-primary-600', Icon: Info },
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { ring, icon, Icon } = STYLES[t.variant];
        return (
          <div
            key={t.id}
            data-testid={`toast-${t.variant}`}
            role={t.variant === 'error' ? 'alert' : 'status'}
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${ring} bg-white p-3 shadow-lg`}
          >
            <span className={`mt-0.5 shrink-0 ${icon}`}><Icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 break-words text-xs text-slate-600">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
