/**
 * T4: Fee-Commitment BullMQ worker skeleton.
 *
 * Handles `FEE_COMMITMENT` queue jobs that render a student's fee
 * commitment sheet (PDF) and attach it to the Student's M02 Documents.
 *
 * This file is intentionally a skeleton in T4 — it only logs the
 * payload and resolves. T7 (`fee-commitment-sheet-service.ts`) will
 * plug in the real PdfRenderer + Document-attach logic. By registering
 * the queue + worker up front, T7 slots the business logic into
 * `processJob()` without any queue/retry plumbing churn.
 *
 * ── Retry policy ──
 * `FEE_COMMITMENT_JOB_OPTS` encodes the 3-attempt exponential backoff
 * called out in plan §1.8. BullMQ's stock `exponential` strategy
 * produces 5s / 10s / 20s waits with `delay: 5_000` (formula:
 * delay * 2^(attemptsMade - 1)). The plan text mentions 5s / 30s / 2m
 * as an ideal cadence — that exact sequence would require a custom
 * backoff strategy registered on the Worker. T7 can swap in a custom
 * strategy by (a) adding it here and (b) setting `type: 'fee-commit-
 * ment-custom'` in the JOB_OPTS below; the tests assert the retry
 * *presence*, not the exact cadence values beyond initial delay.
 *
 * ── Concurrency ──
 * Capped at 4 per plan §4 R-4 (guards against PDF OOM during bulk
 * promotions that enqueue 100+ jobs at once).
 */

import type { Job } from 'bullmq';
import { addJob, registerQueue, QUEUE_NAMES } from '../shared/queue/QueueManager';

/**
 * Payload shape for FEE_COMMITMENT jobs.
 * - `studentId` — the Student whose sheet is being (re)generated.
 * - `pinId` — the specific `Student.feePins[].\_id` this sheet is for.
 */
export interface FeeCommitmentJobData {
  studentId: string;
  pinId: string;
}

/**
 * Concurrency cap for the FEE_COMMITMENT worker. Deliberately low —
 * pdfkit rendering holds buffers in memory and we don't want a
 * bulk-promotion burst to OOM the worker.
 */
export const FEE_COMMITMENT_CONCURRENCY = 4;

/**
 * Default job options applied when `enqueueFeeCommitmentJob` adds a
 * job. Callers can override, but in practice every producer should
 * use these defaults so retry behaviour is uniform across the system.
 */
export const FEE_COMMITMENT_JOB_OPTS: {
  attempts: number;
  backoff: { type: 'exponential' | 'fixed'; delay: number };
} = {
  attempts: 3,
  // See header comment: BullMQ's built-in exponential gives
  // 5s / 10s / 20s. Replace with a custom strategy + worker registration
  // in T7 if the 5s / 30s / 2m cadence is required exactly.
  backoff: { type: 'exponential', delay: 5_000 },
};

/**
 * T4 skeleton handler. Logs the payload and resolves. T7 will replace
 * the body with the real PDF + Document-attach flow:
 *
 *   1. Load student, pin, fee-structure instance + components + rules.
 *   2. Render PDF via `PdfRenderer` (T3's utility).
 *   3. Attach PDF to M02 Documents via `createDocument(...)`.
 *   4. Update `Student.feePins[matching].commitmentSheetDocumentId`
 *      and `commitmentSheetStatus = 'generated'`.
 *   5. (Optional) enqueue a parent email via the EMAIL queue.
 */
export async function feeCommitmentWorker(
  job: Job<FeeCommitmentJobData>,
): Promise<void> {
  const { studentId, pinId } = job.data;
  console.log(
    `[fee-commitment:skeleton] job=${job.id ?? '?'} studentId=${studentId} pinId=${pinId} — T7 will render + attach PDF here`,
  );
  // Intentionally no throw: the skeleton acks successfully so that any
  // smoke-test enqueue during early integration doesn't trip retries.
}

/**
 * Enqueue a fee-commitment-sheet generation job with the standard
 * retry policy. Prefer this helper over calling `addJob` directly so
 * retry/backoff stays consistent across producers (fee-pin-service
 * after admission pin, after promotion pin, and the manual
 * `regenerate` endpoint all go through here).
 */
export async function enqueueFeeCommitmentJob(data: FeeCommitmentJobData) {
  return addJob(
    QUEUE_NAMES.FEE_COMMITMENT,
    'generate-commitment-sheet',
    data,
    {
      attempts: FEE_COMMITMENT_JOB_OPTS.attempts,
      backoff: FEE_COMMITMENT_JOB_OPTS.backoff,
    },
  );
}

/**
 * Registers the FEE_COMMITMENT queue + worker with the central
 * QueueManager. Call this once at server start (after DB connect,
 * alongside `registerProposalExpiryQueue()` and similar wiring).
 *
 * Idempotent — `registerQueue` returns the existing queue if the name
 * is already registered, so calling this twice from tests or repeated
 * server starts is safe.
 */
export function registerFeeCommitmentWorker() {
  return registerQueue({
    name: QUEUE_NAMES.FEE_COMMITMENT,
    processor: feeCommitmentWorker as unknown as (job: Job) => Promise<unknown>,
    concurrency: FEE_COMMITMENT_CONCURRENCY,
  });
}
