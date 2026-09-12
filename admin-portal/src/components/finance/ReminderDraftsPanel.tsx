/**
 * Finance reminder drafts — review LLM-drafted fee reminders and approve
 * them individually or in bulk. Approval auto-dispatches via
 * `/reminder-drafts/approve`; the toast carries the 5-min recall hint.
 * Shell, card and review state come from `components/agent/DraftsPanel`.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Check, Loader2, Sparkles } from 'lucide-react';

import type { DefaulterListItem } from '../../services/fee-analytics';
import { approveReminderDrafts, type ApprovalResult, type ApprovedDraft, type ReminderDraft } from '../../services/finance-agent';
import { formatInrFull, initials } from '../agent/format';
import { DraftCard, DraftsPanel, useDraftReview } from '../agent/DraftsPanel';
import type { ToastState } from '../agent/states';
import { useReminderDrafts } from '../agent/useAgent';

/** Soft = teal (default), Firm = amber (escalation), Empathetic = violet (welfare-flagged). */
function tonePillStyle(tone: ReminderDraft['tone']): string {
  if (tone === 'soft') return 'bg-teal-100 text-teal-800';
  if (tone === 'firm') return 'bg-amber-100 text-amber-800';
  return 'bg-violet-100 text-violet-800';
}

/** Green if >= 0.7 (the `[Approve recommended]` threshold), amber 0.5-0.7, red < 0.5. */
function readRateBadgeStyle(rate: number): string {
  if (rate >= 0.7) return 'bg-emerald-100 text-emerald-800';
  if (rate >= 0.5) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function languageLabel(code: string): string {
  const map: Record<string, string> = {
    en: 'English', te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam',
    mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', or: 'Odia', ur: 'Urdu',
  };
  return map[code.toLowerCase()] ?? code.toUpperCase();
}

const RECOMMENDED_READ_RATE = 0.7;

export function ReminderDraftsPanel({
  open, studentIds, defaultersById, onClose,
}: {
  open: boolean;
  studentIds: string[];
  defaultersById: Map<string, DefaulterListItem>;
  onClose: () => void;
}) {
  const idsKey = studentIds.join(',');
  const draftsQuery = useReminderDrafts(studentIds, open);
  const drafts = draftsQuery.data ?? [];
  const review = useDraftReview(drafts, idsKey);
  const [toast, setToast] = useState<ToastState | null>(null);

  const approveMutation = useMutation<ApprovalResult, Error, { drafts: ApprovedDraft[]; approvedIds: string[] }>({
    mutationFn: (vars) => approveReminderDrafts(vars.drafts),
    onSuccess: (result, vars) => {
      review.markApproved(vars.approvedIds);
      setToast({
        kind: 'success',
        message:
          `Approved ${result.approvedCount} reminder${result.approvedCount === 1 ? '' : 's'}.` +
          ' Recall window: 5 min — visit Reminders page to cancel.',
      });
    },
    onError: (err) => setToast({ kind: 'error', message: err.message || 'Failed to approve reminders.' }),
  });

  const approve = (ids: string[]) => {
    const payloads = ids
      .map((id) => review.finalOf(id))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({ studentId: d.studentId, subject: d.subject, body: d.body }));
    if (payloads.length === 0) return;
    approveMutation.mutate({ drafts: payloads, approvedIds: payloads.map((p) => p.studentId) });
  };
  const recommendedPending = review.pending.filter((d) => d.predictedReadRate >= RECOMMENDED_READ_RATE);
  const busy = draftsQuery.isLoading || approveMutation.isPending;

  return (
    <DraftsPanel
      open={open}
      onClose={onClose}
      title="Draft reminders"
      subtitle="AI-personalized · review before sending"
      icon={<Bell size={16} />}
      isLoading={draftsQuery.isLoading}
      isError={draftsQuery.isError}
      errorLabel="Reminder drafts unavailable."
      onRetry={() => draftsQuery.refetch()}
      isEmpty={drafts.length === 0}
      emptyLabel="No reminder drafts to review."
      toast={toast}
      onToastDismiss={() => setToast(null)}
      footerNote="After approval: 5-min recall window via the Reminders page."
      toolbar={
        <>
          <button
            type="button"
            onClick={() => approve(review.pending.map((d) => d.studentId))}
            disabled={busy || review.pending.length === 0}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {approveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Approve all ({review.pending.length})
          </button>
          <button
            type="button"
            onClick={() => approve(recommendedPending.map((d) => d.studentId))}
            disabled={busy || recommendedPending.length === 0}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            Approve recommended ({recommendedPending.length})
          </button>
          <span className="ml-auto text-[11px] font-semibold text-slate-600">
            {review.approvedCount}/{drafts.length} approved
          </span>
        </>
      }
    >
      {drafts.map((d) => {
        const defaulter = defaultersById.get(d.studentId);
        const studentName = defaulter?.name ?? `Student ${d.studentId.slice(-4)}`;
        return (
          <DraftCard
            key={d.studentId}
            draft={d}
            status={review.statusOf(d.studentId)}
            edited={review.editOf(d.studentId)}
            onApprove={() => approve([d.studentId])}
            onSkip={() => review.skip(d.studentId)}
            onSaveEdit={(s, b) => review.saveEdit(d.studentId, s, b)}
            header={
              <>
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
                  {initials(studentName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {studentName}
                    <span className="text-xs font-normal text-slate-500 ml-1.5">
                      · {defaulter?.rollNumber ?? '—'}
                      {defaulter?.programmeName ? ` · ${defaulter.programmeName}` : ''}
                    </span>
                  </div>
                  {defaulter && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatInrFull(defaulter.overdueAmount)} overdue · {defaulter.daysOverdue} days
                    </div>
                  )}
                </div>
              </>
            }
            pills={
              <>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{languageLabel(d.language)}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${tonePillStyle(d.tone)}`}>{d.tone} tone</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${readRateBadgeStyle(d.predictedReadRate)}`}>
                  {Math.round(d.predictedReadRate * 100)}% predicted read-rate
                </span>
              </>
            }
          />
        );
      })}
    </DraftsPanel>
  );
}
