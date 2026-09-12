/**
 * People outreach drafts — guardian messages drafted by the welfare agent,
 * reviewed by a mentor, then RECORDED against the student's alert.
 *
 * Nothing is sent. No delivery provider is configured, and the backend says
 * so in every approval result; this panel repeats it rather than letting a
 * mentor believe a parent was contacted.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, HeartHandshake, Loader2 } from 'lucide-react';

import {
  approveOutreach, getOutreachDrafts,
  type ApprovedOutreach, type OutreachApprovalResult, type OutreachDraft,
} from '../../services/people-agent';
import { initials } from '../agent/format';
import { DraftCard, DraftsPanel, useDraftReview } from '../agent/DraftsPanel';
import type { ToastState } from '../agent/states';
import { languageLabel } from '../finance/ReminderDraftsPanel';

const TONE_STYLE: Record<OutreachDraft['tone'], string> = {
  supportive: 'bg-teal-100 text-teal-800',
  direct: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

export function OutreachDraftsPanel({
  open, studentIds, onClose,
}: {
  open: boolean;
  studentIds: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const idsKey = studentIds.join(',');
  const draftsQuery = useQuery<OutreachDraft[]>({
    queryKey: ['outreach-drafts', idsKey],
    queryFn: () => getOutreachDrafts(studentIds),
    enabled: open && studentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const drafts = draftsQuery.data ?? [];
  const review = useDraftReview(drafts, idsKey);
  const [toast, setToast] = useState<ToastState | null>(null);

  const approveMutation = useMutation<OutreachApprovalResult, Error, { approved: ApprovedOutreach[]; ids: string[] }>({
    mutationFn: (vars) => approveOutreach(vars.approved),
    onSuccess: (result, vars) => {
      review.markApproved(vars.ids);
      // The server's own wording — honest by construction.
      setToast({ kind: 'success', message: `Recorded ${result.approvedCount}. ${result.deliveryNote}` });
      void qc.invalidateQueries({ queryKey: ['ccd-board'] });
      void qc.invalidateQueries({ queryKey: ['ccd-outreach-effectiveness'] });
    },
    onError: (err) => setToast({ kind: 'error', message: err.message || 'Could not record the outreach.' }),
  });

  const approve = (ids: string[]) => {
    const approved = ids
      .map((id) => review.finalOf(id))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({ studentId: d.studentId, subject: d.subject, body: d.body, channel: d.channel }));
    if (approved.length === 0) return;
    approveMutation.mutate({ approved, ids: approved.map((a) => a.studentId) });
  };
  const busy = draftsQuery.isLoading || approveMutation.isPending;

  return (
    <DraftsPanel
      open={open}
      onClose={onClose}
      title="Draft guardian outreach"
      subtitle="In the guardian's language · you approve, nothing is sent"
      icon={<HeartHandshake size={16} />}
      isLoading={draftsQuery.isLoading}
      isError={draftsQuery.isError}
      errorLabel="Outreach drafts unavailable."
      onRetry={() => draftsQuery.refetch()}
      isEmpty={drafts.length === 0}
      emptyLabel="No open alert to draft against for these students."
      toast={toast}
      onToastDismiss={() => setToast(null)}
      footerNote="Approving records the outreach on the alert. No message is sent — no delivery provider is configured."
      toolbar={
        <>
          <button
            type="button"
            onClick={() => approve(review.pending.map((d) => d.studentId))}
            disabled={busy || review.pending.length === 0}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {approveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Record all ({review.pending.length})
          </button>
          <span className="ml-auto text-[11px] font-semibold text-slate-600">
            {review.approvedCount}/{drafts.length} recorded
          </span>
        </>
      }
    >
      {drafts.map((d) => (
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
                {initials(d.studentName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{d.studentName}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {d.guardianName ? `To ${d.guardianName}` : 'No guardian on file'} · via {d.channel}
                </div>
              </div>
            </>
          }
          pills={
            <>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{languageLabel(d.language)}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${TONE_STYLE[d.tone]}`}>{d.tone} tone</span>
              {d.fallback && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title="The model was unavailable; this is the standard template.">
                  Template
                </span>
              )}
            </>
          }
        />
      ))}
    </DraftsPanel>
  );
}
