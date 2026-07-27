import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, UserCheck, Scale, MessageSquareWarning, Gavel, RefreshCw } from 'lucide-react';
import {
  submitSelfAssessment,
  submitReviewerAssessment,
  moderateAppraisal,
  disputeAppraisal,
  resolveAppraisalDispute,
  aggregateAppraisalData,
} from '../../services/hr';

const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';
const lbl = 'mb-1 block text-sm font-medium text-gray-700';

interface Props {
  appraisal: any;
  onDone?: () => void;
}

type Stage = 'self' | 'reviewer' | 'moderate' | 'dispute' | 'resolve';

const STAGES: { key: Stage; label: string; Icon: typeof UserCheck; blurb: string }[] = [
  { key: 'self', label: 'Self assessment', Icon: UserCheck, blurb: 'The employee rates themselves and records supporting notes.' },
  { key: 'reviewer', label: 'Reviewer assessment', Icon: ClipboardCheck, blurb: 'The reviewer records their rating and written feedback.' },
  { key: 'moderate', label: 'Moderation', Icon: Scale, blurb: 'Normalises the rating across the cohort with a signed adjustment.' },
  { key: 'dispute', label: 'Raise dispute', Icon: MessageSquareWarning, blurb: 'The employee contests the outcome in writing.' },
  { key: 'resolve', label: 'Resolve dispute', Icon: Gavel, blurb: 'Confirm the original rating, or revise it.' },
];

/**
 * Guided appraisal workflow.
 *
 * The Appraisals page only ever showed selfRating / reviewerRating /
 * finalRating as bare number inputs saved with a PUT, bypassing the stage
 * endpoints that own transitions, moderation and the dispute trail. Each
 * action here posts to the endpoint that actually models that step.
 */
export default function AppraisalWorkflowPanel({ appraisal, onDone }: Props) {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage | null>(null);

  const [selfRating, setSelfRating] = useState(String(appraisal?.selfRating ?? ''));
  const [selfNotes, setSelfNotes] = useState('');
  const [reviewerRating, setReviewerRating] = useState(String(appraisal?.reviewerRating ?? ''));
  const [reviewerComments, setReviewerComments] = useState(appraisal?.reviewerComments ?? '');
  const [adjustment, setAdjustment] = useState('0');
  const [disputeText, setDisputeText] = useState('');
  const [resolution, setResolution] = useState<'confirmed' | 'revised'>('confirmed');
  const [revisedRating, setRevisedRating] = useState('');

  const id: string = appraisal?._id;

  function afterSuccess() {
    qc.invalidateQueries({ queryKey: ['appraisals'] });
    setStage(null);
    onDone?.();
  }

  const mut = useMutation({
    mutationFn: async (which: Stage) => {
      switch (which) {
        case 'self':
          return submitSelfAssessment(id, {
            selfRating: Number(selfRating),
            selfAssessmentData: selfNotes ? { notes: selfNotes } : {},
          });
        case 'reviewer':
          return submitReviewerAssessment(id, {
            reviewerRating: Number(reviewerRating),
            reviewerComments: reviewerComments.trim(),
          });
        case 'moderate':
          return moderateAppraisal(id, { moderationAdjustment: Number(adjustment) });
        case 'dispute':
          return disputeAppraisal(id, { disputeText: disputeText.trim() });
        case 'resolve':
          return resolveAppraisalDispute(id, {
            resolution,
            ...(resolution === 'revised' && revisedRating !== '' ? { revisedRating: Number(revisedRating) } : {}),
          });
      }
    },
    meta: { successMessage: 'Appraisal updated' },
    onSuccess: afterSuccess,
  });

  const aggregateMut = useMutation({
    mutationFn: () => aggregateAppraisalData(id),
    meta: { successMessage: 'Appraisal data refreshed from source records' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  });

  const ratingInRange = (v: string) => v !== '' && Number(v) >= 0 && Number(v) <= 10;

  const canSubmit: Record<Stage, boolean> = {
    self: ratingInRange(selfRating),
    reviewer: ratingInRange(reviewerRating) && reviewerComments.trim().length > 0,
    moderate: adjustment !== '' && !Number.isNaN(Number(adjustment)),
    dispute: disputeText.trim().length > 0,
    resolve: resolution === 'confirmed' || ratingInRange(revisedRating),
  };

  if (!id) return null;

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
        <span className="text-sm font-medium text-slate-700">Appraisal workflow</span>
        <button
          type="button"
          onClick={() => aggregateMut.mutate()}
          disabled={aggregateMut.isPending}
          title="Recompute the appraisal's source metrics (teaching load, publications, feedback)"
          className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={aggregateMut.isPending ? 'animate-spin' : ''} /> Aggregate data
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b p-3">
        {STAGES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStage(stage === key ? null : key)}
            aria-pressed={stage === key}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              stage === key
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {stage && (
        <div className="space-y-3 p-4">
          <p className="text-xs text-slate-500">{STAGES.find(s => s.key === stage)!.blurb}</p>

          {stage === 'self' && (
            <>
              <div>
                <label className={lbl} htmlFor="ap-self-rating">Self rating (0–10) *</label>
                <input id="ap-self-rating" type="number" min={0} max={10} step="0.1" value={selfRating} onChange={e => setSelfRating(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl} htmlFor="ap-self-notes">Supporting notes</label>
                <textarea id="ap-self-notes" rows={3} value={selfNotes} onChange={e => setSelfNotes(e.target.value)} className={inp} placeholder="Achievements, evidence, context" />
              </div>
            </>
          )}

          {stage === 'reviewer' && (
            <>
              <div>
                <label className={lbl} htmlFor="ap-rev-rating">Reviewer rating (0–10) *</label>
                <input id="ap-rev-rating" type="number" min={0} max={10} step="0.1" value={reviewerRating} onChange={e => setReviewerRating(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl} htmlFor="ap-rev-comments">Reviewer comments *</label>
                <textarea id="ap-rev-comments" rows={3} value={reviewerComments} onChange={e => setReviewerComments(e.target.value)} className={inp} />
              </div>
            </>
          )}

          {stage === 'moderate' && (
            <div>
              <label className={lbl} htmlFor="ap-adj">Moderation adjustment *</label>
              <input id="ap-adj" type="number" step="0.1" value={adjustment} onChange={e => setAdjustment(e.target.value)} className={inp} placeholder="e.g. -0.5 or 0.5" />
              <p className="mt-1 text-xs text-slate-500">Signed value added to the reviewer rating.</p>
            </div>
          )}

          {stage === 'dispute' && (
            <div>
              <label className={lbl} htmlFor="ap-dispute">Dispute *</label>
              <textarea id="ap-dispute" rows={3} value={disputeText} onChange={e => setDisputeText(e.target.value)} className={inp} placeholder="Why the outcome is being contested" />
            </div>
          )}

          {stage === 'resolve' && (
            <>
              <div>
                <label className={lbl} htmlFor="ap-resolution">Resolution *</label>
                <select id="ap-resolution" value={resolution} onChange={e => setResolution(e.target.value as 'confirmed' | 'revised')} className={inp}>
                  <option value="confirmed">Confirm the original rating</option>
                  <option value="revised">Revise the rating</option>
                </select>
              </div>
              {resolution === 'revised' && (
                <div>
                  <label className={lbl} htmlFor="ap-revised">Revised rating (0–10) *</label>
                  <input id="ap-revised" type="number" min={0} max={10} step="0.1" value={revisedRating} onChange={e => setRevisedRating(e.target.value)} className={inp} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={() => setStage(null)} className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={mut.isPending || !canSubmit[stage]}
              onClick={() => mut.mutate(stage)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {mut.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
