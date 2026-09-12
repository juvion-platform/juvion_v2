/**
 * "Agent findings" — LLM-picked situation cards. Self-fetches `/situations`
 * (5-min stale time). Render states: 3 skeletons · delayed empty · inline
 * retry (agent offline must NOT block the page) · up to 5 cards.
 */
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Bell, EyeOff, FileText, Loader2, PhoneCall, RefreshCcw, Sparkles, X } from 'lucide-react';

import {
  dismissSituation,
  getSituations,
  type Situation,
  type SituationAction,
  type SituationActionType,
} from '../../services/finance-agent';
import { formatCachedAt } from './format';
import { InlineRetry, Toast, useDelayedEmpty, type ToastState } from './states';
import { agentKeys, useForceRefresh, useSituations } from './useAgent';

/**
 * Severity-driven styling for a Situation card. The border-left ring is
 * the signal — body chrome stays muted so 5 cards in a row don't drown
 * out the rest of the dashboard.
 */
function situationCardStyle(severity: Situation['severity']): string {
  if (severity === 'high') {
    return 'border-l-4 border-l-red-500 bg-red-50/50 border border-red-100';
  }
  if (severity === 'medium') {
    return 'border-l-4 border-l-amber-500 bg-amber-50/50 border border-amber-100';
  }
  return 'border-l-4 border-l-slate-400 bg-slate-50 border border-slate-200';
}
const SITUATION_ACTION_ICON: Record<SituationActionType, React.ComponentType<{ size?: number; className?: string }>> = {
  draft_plan: FileText,
  draft_reminder: Bell,
  schedule_call: PhoneCall,
  review_policy: BookOpen,
  dismiss: EyeOff,
};
/**
 * Default human-readable labels for each action type — used as a fallback
 * when the LLM omits the `label` field. The orchestrator usually provides
 * one but defence in depth is cheap.
 */
const SITUATION_ACTION_DEFAULT_LABEL: Record<SituationActionType, string> = {
  draft_plan: 'Draft plan',
  draft_reminder: 'Draft reminder',
  schedule_call: 'Schedule call',
  review_policy: 'Review policy',
  dismiss: 'Dismiss',
};
/**
 * "Coming soon" toast text per action type for the actions that aren't
 * wired in this sprint (per A9 spec — only `draft_reminder` flows through
 * to A10's panel; `dismiss` opens the local dialog).
 */
const SITUATION_ACTION_COMING_SOON: Partial<Record<SituationActionType, string>> = {
  draft_plan: 'Plan builder coming soon',
  schedule_call: 'Calendar integration coming soon',
  review_policy: 'Policy retrieval coming soon',
};
/**
 * Snooze choices for the dismiss dialog. 7 days is the spec default.
 */
const SNOOZE_OPTIONS: ReadonlyArray<{ value: 1 | 3 | 7 | 30; label: string }> = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];
/**
 * Inline modal for dismissing (snoozing) a situation. Anchored to the
 * page (fixed inset) rather than the card to avoid clipping at card edges.
 * Renders only while `open` is true; the parent owns the open state.
 */
function DismissSituationDialog({
  situation,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  situation: Situation;
  onClose: () => void;
  onConfirm: (snoozeDays: 1 | 3 | 7 | 30, reason: string) => void;
  isSubmitting: boolean;
}) {
  const [snoozeDays, setSnoozeDays] = useState<1 | 3 | 7 | 30>(7);
  const [reason, setReason] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-situation-title"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30 px-4"
      // Backdrop click closes the dialog (only when not submitting).
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5">
        <div className="flex items-start justify-between mb-3">
          <h3
            id="dismiss-situation-title"
            className="text-sm font-bold text-slate-800"
          >
            Dismiss situation
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
          {situation.title}
        </p>
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Snooze for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SNOOZE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                  snoozeDays === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="snooze-days"
                  value={opt.value}
                  checked={snoozeDays === opt.value}
                  onChange={() => setSnoozeDays(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label
            htmlFor="dismiss-reason"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            Reason <span className="font-normal lowercase text-slate-400">(optional)</span>
          </label>
          <textarea
            id="dismiss-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you dismissing this? (optional)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none resize-none"
          />
          <div className="text-[10px] text-slate-400 mt-1 text-right">
            {reason.length} / 500
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(snoozeDays, reason.trim())}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <EyeOff size={13} />
            )}
            {isSubmitting ? 'Dismissing…' : 'Dismiss situation'}
          </button>
        </div>
      </div>
    </div>
  );
}
/**
 * One Situation card. Action buttons render in a footer row; the list is
 * deduped (so two `dismiss` actions from the LLM don't both render — only
 * one ghost `[Dismiss]` ever appears, which we always inject regardless of
 * what the LLM included).
 */
function SituationCard({
  situation,
  onAction,
  onDismissClick,
}: {
  situation: Situation;
  onAction: (action: SituationAction) => void;
  onDismissClick: () => void;
}) {
  // Drop any LLM-emitted dismiss actions — we render our own ghost dismiss
  // button at the end of the row regardless. Other action types are
  // deduped by `type` so the row stays compact even if the LLM emits two
  // (e.g. two `draft_reminder` entries with different payloads).
  const visibleActions = useMemo(() => {
    const seen = new Set<SituationActionType>();
    const out: SituationAction[] = [];
    for (const a of situation.actions) {
      if (a.type === 'dismiss') continue;
      if (seen.has(a.type)) continue;
      seen.add(a.type);
      out.push(a);
    }
    return out;
  }, [situation.actions]);

  return (
    <div
      className={`flex flex-col rounded-xl p-3.5 transition-shadow hover:shadow-sm ${situationCardStyle(situation.severity)}`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <Sparkles
          size={13}
          className="flex-shrink-0 mt-0.5 text-violet-500"
          aria-hidden
        />
        <div className="text-[15px] font-bold text-slate-800 leading-snug">
          {situation.title}
        </div>
      </div>
      <p
        className="text-sm text-slate-600 leading-snug mb-3 overflow-hidden"
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
        }}
      >
        {situation.narrative}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-2 border-t border-black/5">
        {visibleActions.map((action) => {
          const Icon = SITUATION_ACTION_ICON[action.type];
          const label =
            action.label || SITUATION_ACTION_DEFAULT_LABEL[action.type];
          return (
            <button
              key={action.type}
              type="button"
              onClick={() => onAction(action)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 inline-flex items-center gap-1 transition-colors"
            >
              <Icon size={11} />
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onDismissClick}
          className="ml-auto text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors"
        >
          <EyeOff size={11} />
          Dismiss
        </button>
      </div>
    </div>
  );
}
/**
 * Skeleton card shown while the situations query is in flight. Three of
 * these render in a row to hint at the eventual layout.
 */
function SituationCardSkeleton() {
  return (
    <div className="border-l-4 border-l-slate-200 bg-slate-50 border border-slate-200 rounded-xl p-3.5 animate-pulse">
      <div className="h-3.5 bg-slate-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-full mb-1.5" />
      <div className="h-3 bg-slate-200 rounded w-5/6 mb-1.5" />
      <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="flex gap-1.5">
        <div className="h-6 w-20 bg-slate-200 rounded-lg" />
        <div className="h-6 w-24 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}
/**
 * "Agent findings" — a row of LLM-picked situation cards above the
 * defaulter list. Self-fetches `/situations` (5min stale time per spec).
 *
 * `onDraftReminder` is the seam for A10's reminder-drafts panel — when
 * that lands the parent will pass a real handler. For now A9 just shows a
 * brief toast "Drafting reminders for N students…" so the click is
 * never silent.
 *
 * Render states:
 *   - loading      → 3 skeleton cards
 *   - empty        → muted message "No situations need attention…"
 *                    (delayed 500ms to avoid flash on quick loads)
 *   - error        → inline amber banner + retry button. Dashboard
 *                    continues rendering — agent offline must NOT block
 *                    the rest of the page.
 *   - success      → up to 5 cards in a 1/2/3-col responsive grid.
 */
export function SituationCards({
  onDraftReminder,
  degraded = false,
}: {
  onDraftReminder?: (studentIds: string[]) => void;
  /** When true, the entire panel is hidden — situations are LLM-derived. */
  degraded?: boolean;
}) {
  const queryClient = useQueryClient();
  // `enabled: !degraded` stops the network call in degraded mode; the panel
  // itself is hidden below, AFTER every hook has run.
  const query = useSituations(!degraded);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dismissTarget, setDismissTarget] = useState<Situation | null>(null);
  const [isDismissSubmitting, setIsDismissSubmitting] = useState(false);
  const { run: refresh, isRefreshing: isForceRefreshing } = useForceRefresh(
    agentKeys.situations,
    () => getSituations(true),
  );
  // Delayed so a quick load never flashes the empty message.
  const showEmpty = useDelayedEmpty(query.isSuccess && (query.data?.situations.length ?? 0) === 0);

  // L7b — degraded mode (e.g. weekly LLM budget hit) hides this panel entirely.
  if (degraded) return null;

  const handleAction = (situation: Situation, action: SituationAction) => {
    if (action.type === 'draft_reminder') {
      const ids = situation.studentIds;
      const count = ids.length;
      setToast({
        kind: 'info',
        message: count > 0
          ? `Drafting reminders for ${count} student${count === 1 ? '' : 's'}…`
          : 'Drafting reminders…',
      });
      if (onDraftReminder) onDraftReminder(ids);
      else {
        // No-op until A10 wires the panel — log so devs notice during dev.
        // eslint-disable-next-line no-console
        console.info(
          '[situations] draft_reminder click (A10 panel not yet wired)',
          { situationId: situation.id, studentIds: ids },
        );
      }
      return;
    }
    const comingSoon = SITUATION_ACTION_COMING_SOON[action.type];
    if (comingSoon) {
      setToast({ kind: 'info', message: comingSoon });
      return;
    }
    // Fallback (e.g. action.type === 'dismiss' shouldn't reach here because
    // the card always uses our local Dismiss button — but guard anyway).
    if (action.type === 'dismiss') {
      setDismissTarget(situation);
    }
  };

  const handleDismissConfirm = async (
    snoozeDays: 1 | 3 | 7 | 30,
    reason: string,
  ) => {
    if (!dismissTarget) return;
    setIsDismissSubmitting(true);
    try {
      await dismissSituation(dismissTarget.fingerprint, snoozeDays, reason);
      setToast({
        kind: 'success',
        message: `Dismissed for ${snoozeDays} day${snoozeDays === 1 ? '' : 's'}`,
      });
      setDismissTarget(null);
      // Refetch so the dismissed card disappears immediately.
      void queryClient.invalidateQueries({ queryKey: ['situations'] });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to dismiss situation';
      setToast({ kind: 'error', message: msg });
    } finally {
      setIsDismissSubmitting(false);
    }
  };

  // Render the section header once and let the body change based on state.
  // This keeps the visual anchor stable while the cards load/empty/error.
  return (
    <section className="mb-4" aria-labelledby="agent-findings-heading">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" aria-hidden />
          <h2
            id="agent-findings-heading"
            className="text-sm font-bold text-slate-800"
          >
            Agent findings
          </h2>
          <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
            Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          {query.data?.cachedAt && (
            <span className="text-[10px] font-medium text-violet-600/60 bg-violet-50 px-2 py-0.5 rounded-full">
              Cached · {formatCachedAt(query.data.cachedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={query.isFetching || isForceRefreshing}
            aria-label="Refresh agent findings"
            title="Refresh"
            className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 disabled:opacity-50"
          >
            <RefreshCcw
              size={12}
              className={query.isFetching || isForceRefreshing ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <SituationCardSkeleton />
          <SituationCardSkeleton />
          <SituationCardSkeleton />
        </div>
      ) : query.isError ? (
        <InlineRetry label="Agent findings unavailable." onRetry={() => query.refetch()} />
      ) : (query.data?.situations.length ?? 0) === 0 ? (
        showEmpty ? (
          <div className="text-xs text-slate-500 italic px-1 transition-opacity duration-300">
            No situations need attention — collection is clean.
          </div>
        ) : (
          // Reserve a small height while the empty-state delay runs to
          // avoid layout shift when the message finally fades in.
          <div className="h-5" aria-hidden />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(query.data?.situations ?? []).slice(0, 5).map((s) => (
            <SituationCard
              key={s.id}
              situation={s}
              onAction={(a) => handleAction(s, a)}
              onDismissClick={() => setDismissTarget(s)}
            />
          ))}
        </div>
      )}

      {dismissTarget && (
        <DismissSituationDialog
          situation={dismissTarget}
          onClose={() => !isDismissSubmitting && setDismissTarget(null)}
          onConfirm={handleDismissConfirm}
          isSubmitting={isDismissSubmitting}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}

// ── Reminder drafts side panel (A10) ─────────────────────────────────
