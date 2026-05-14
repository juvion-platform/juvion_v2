/**
 * Enqueue helper for the lead-scoring queue.
 *
 * Spec §10.6 — BullMQ jobId deduplicates score requests within a one-minute
 * window. The composite key folds (college, inquiry, minute-of-day) into a
 * string the queue uses to reject duplicates.
 *
 * Callers: createInquiry hook, interaction creation hook, rescore route,
 * batch endpoint, W01 workflow handler.
 */

import { addJob, QUEUE_NAMES } from '../../../shared/queue/QueueManager';

export type ScoringTrigger = 'create' | 'interaction' | 'manual' | 'batch';

export interface ScoringJobPayload {
  collegeId: string;
  inquiryId: string;
  performedBy: string;
  trigger: ScoringTrigger;
}

export interface EnqueueScoringInput extends ScoringJobPayload {
  /** Injectable clock for tests; defaults to wall-clock. */
  now?: Date;
}

const MINUTE_MS = 60_000;

export function scoringJobId(collegeId: string, inquiryId: string, when: Date = new Date()): string {
  const minuteBucket = Math.floor(when.getTime() / MINUTE_MS);
  return `score:${collegeId}:${inquiryId}:${minuteBucket}`;
}

export async function enqueueScoring(input: EnqueueScoringInput) {
  const { collegeId, inquiryId, performedBy, trigger } = input;
  const jobId = scoringJobId(collegeId, inquiryId, input.now);
  return addJob(
    QUEUE_NAMES.LEAD_SCORING,
    'score',
    { collegeId, inquiryId, performedBy, trigger },
    { jobId },
  );
}
