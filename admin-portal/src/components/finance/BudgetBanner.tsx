/**
 * <BudgetBanner /> — dashboard-level "AI usage at NN% of weekly budget"
 * notice rendered above the finance dashboard header (L7b).
 *
 * Two visible states (per plan §1.11):
 *   - warning  (amber, ≥ alertThresholdPct, < 100%)
 *   - exceeded (red,   ≥ 100%)
 *
 * Hydrated from the `budgetWarning` field on the latest agent endpoint
 * response. The banner renders nothing when no warning is supplied; the
 * parent (the dashboard) decides which response shape to read from. v1
 * sources the warning from the `forecast-narrative` query — that endpoint
 * fires on every dashboard load, so the banner shows up within one tick of
 * the budget crossing the threshold.
 *
 * Per-session dismissal: an inline X clears the banner until next page
 * load. By design the banner reappears on refresh — admins should know
 * the budget state at every entry point.
 *
 * Copy:
 *   - Warning : "AI usage at NN% of weekly budget. ₹X remaining. Resets in <relative time>."
 *   - Exceeded: "AI usage exceeded weekly budget. Contact admin to increase the limit."
 */
import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface BudgetWarningPayload {
  spent: number;
  limit: number;
  /** 0..100 */
  pct: number;
  /** ISO timestamp; next Monday 00:00 UTC. */
  resetsAt: string;
}

interface Props {
  /** When undefined / null, the banner renders nothing. */
  warning?: BudgetWarningPayload | null;
  /**
   * Hard 429 state — the LLM gate has fired. Shows the red "exceeded"
   * variant regardless of the `pct` value (defensive: covers cache
   * staleness where pct == 99.x but the backend already blocked).
   */
  exceeded?: boolean;
}

function formatInr(v: number): string {
  // Match the dashboard's existing `formatInrCompact` rounding so the
  // "₹X remaining" copy reads in the same units as the StatPills above.
  const abs = Math.abs(v);
  if (abs >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
}

/**
 * Pure helper — formats an ISO timestamp as a coarse relative duration
 * ("3 days", "5 hours", "in <1 hour"). Exported for testing.
 */
export function formatRelativeFuture(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'soon';
  const diffMs = target - now.getTime();
  if (diffMs <= 0) return 'momentarily';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export default function BudgetBanner({ warning, exceeded = false }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Nothing to render when there is no signal at all.
  if (!warning && !exceeded) return null;
  if (dismissed) return null;

  const isExceeded = exceeded || (warning ? warning.pct >= 100 : false);

  // Color tokens — keep both branches concrete (Tailwind purges dynamic
  // class names like `bg-${color}-50`).
  const tone = isExceeded
    ? {
        wrap: 'border-l-4 border-red-500 bg-red-50 text-red-900',
        iconBg: 'text-red-600',
        dismiss: 'text-red-500 hover:text-red-700',
      }
    : {
        wrap: 'border-l-4 border-amber-400 bg-amber-50 text-amber-900',
        iconBg: 'text-amber-600',
        dismiss: 'text-amber-500 hover:text-amber-700',
      };

  let message: string;
  let secondary: string | null = null;
  if (isExceeded) {
    message = 'AI usage exceeded weekly budget. Contact admin to increase the limit.';
    if (warning?.resetsAt) {
      secondary = `Resets in ${formatRelativeFuture(warning.resetsAt)}.`;
    }
  } else {
    // warning is non-null here per the early-return above
    const w = warning!;
    const remaining = Math.max(0, w.limit - w.spent);
    message = `AI usage at ${Math.round(w.pct)}% of weekly budget. ${formatInr(remaining)} remaining.`;
    secondary = `Resets in ${formatRelativeFuture(w.resetsAt)}.`;
  }

  return (
    <div
      role="alert"
      data-testid="budget-banner"
      className={`flex items-start gap-3 rounded-lg ${tone.wrap} px-4 py-3 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}
    >
      <AlertTriangle size={18} className={`flex-shrink-0 mt-0.5 ${tone.iconBg}`} />
      <div className="flex-1 min-w-0 text-sm leading-snug">
        <strong className="font-semibold">{message}</strong>
        {secondary && <span className="ml-1 text-xs opacity-80">{secondary}</span>}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={`flex-shrink-0 ${tone.dismiss}`}
        aria-label="Dismiss budget notice"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
