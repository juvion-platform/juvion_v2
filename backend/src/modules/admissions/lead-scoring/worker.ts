/**
 * Lead-scoring BullMQ worker.
 *
 * Registered explicitly from `server.ts` (alongside other background
 * workers like proposal-expiry), inside a Redis-availability guard so
 * test environments and Redis-less local dev don't trip on it.
 *
 * The processor is exported for unit testing without BullMQ.
 */

import type { Job } from 'bullmq';

import { registerQueue, QUEUE_NAMES } from '../../../shared/queue/QueueManager';
import { scoreInquiry } from './service';
import type { ScoringJobPayload } from './enqueue';

export const LEAD_SCORING_CONCURRENCY = 3;

export async function leadScoringProcessor(job: Job<ScoringJobPayload>) {
  const { collegeId, inquiryId, performedBy, trigger } = job.data;
  return scoreInquiry(collegeId, inquiryId, performedBy, { trigger });
}

export function registerLeadScoringQueue(): void {
  registerQueue({
    name: QUEUE_NAMES.LEAD_SCORING,
    processor: leadScoringProcessor as Parameters<typeof registerQueue>[0]['processor'],
    concurrency: LEAD_SCORING_CONCURRENCY,
  });
}
