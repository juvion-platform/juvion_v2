/**
 * T4 Fee-Commitment queue tests.
 *
 * These are synchronous / mocked tests — no live Redis required.
 * Full end-to-end job flow (worker actually processing a real BullMQ job
 * via a Redis instance) is intentionally deferred to T7 integration
 * tests, which will also exercise the PDF rendering.
 *
 * Scope covered here:
 *   1. `FEE_COMMITMENT` queue name is registered in the QueueManager
 *      registry with the expected `finance:fee-commitment` value.
 *   2. Concurrency is capped at 4 (per plan R-4).
 *   3. Retry/backoff config defaults match the spec: 3 attempts,
 *      exponential backoff starting at 5s (approximating 5s / 30s /
 *      2m per plan §1.8 — exact custom-backoff wiring documented in
 *      the worker file for T7).
 *   4. Worker skeleton has the correct signature and resolves for any
 *      well-formed payload (logs + acks).
 *   5. `enqueueFeeCommitmentJob` delegates to `addJob` with the
 *      spec retry options.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { QUEUE_NAMES } from '../QueueManager';

// Mock the queue-add primitive so we can assert the options we pass
// without needing a live Redis connection.
vi.mock('../QueueManager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../QueueManager')>();
  return {
    ...actual,
    addJob: vi.fn().mockResolvedValue({ id: 'mock-job-1' }),
  };
});

// Mock the commitment-sheet service (T7) so T4's queue-config tests
// remain isolated from business-logic behavior. The worker now
// delegates to `generateSheet` — we stub it to a trivial resolve so
// the worker ACKs cleanly when invoked with synthetic payloads.
vi.mock('../../../modules/finance/fee-commitment-sheet-service', () => ({
  generateSheet: vi.fn().mockResolvedValue({ documentId: 'doc-1', pdfBuffer: Buffer.alloc(1) }),
}));

import {
  feeCommitmentWorker,
  FEE_COMMITMENT_CONCURRENCY,
  FEE_COMMITMENT_JOB_OPTS,
  enqueueFeeCommitmentJob,
} from '../../../workers/fee-commitment.worker';
import { addJob } from '../QueueManager';
import * as feeCommitmentSheetService from '../../../modules/finance/fee-commitment-sheet-service';

describe('FEE_COMMITMENT queue registration', () => {
  it('registers FEE_COMMITMENT in the QUEUE_NAMES registry', () => {
    expect(QUEUE_NAMES).toHaveProperty('FEE_COMMITMENT');
  });

  it('uses a finance-namespaced queue name', () => {
    // Mirrors existing patterns like `admissions_fee_reminder`,
    // `admissions_provisioning`, `campus_proposal_expiry`.
    expect(QUEUE_NAMES.FEE_COMMITMENT).toBe('finance_fee_commitment');
  });
});

describe('FEE_COMMITMENT worker config', () => {
  it('caps concurrency at 4 (plan §4 R-4)', () => {
    expect(FEE_COMMITMENT_CONCURRENCY).toBe(4);
  });

  it('retries 3 times with exponential backoff', () => {
    expect(FEE_COMMITMENT_JOB_OPTS.attempts).toBe(3);
    expect(FEE_COMMITMENT_JOB_OPTS.backoff).toBeDefined();
    const backoff = FEE_COMMITMENT_JOB_OPTS.backoff!;
    expect(backoff.type).toBe('exponential');
    // Initial delay of 5s — BullMQ's exponential formula produces
    // 5s / 10s / 20s with this delay. Exact spec values (5s / 30s /
    // 2m) would need a custom backoff strategy; that's documented in
    // the worker module and noted for T7 to finalize if Finance
    // requires the spec cadence exactly.
    expect(backoff.delay).toBe(5_000);
  });
});

describe('feeCommitmentWorker (T7)', () => {
  beforeEach(() => {
    vi.mocked(feeCommitmentSheetService.generateSheet).mockClear();
  });

  it('has the expected signature and resolves for a valid payload', async () => {
    const job = {
      id: 'job-xyz',
      name: 'generate-commitment-sheet',
      data: { studentId: 'student-1', pinId: 'pin-1' },
    } as unknown as Parameters<typeof feeCommitmentWorker>[0];

    await expect(feeCommitmentWorker(job)).resolves.toBeUndefined();
  });

  it('delegates to fee-commitment-sheet-service.generateSheet with the job payload', async () => {
    const job = {
      id: 'job-xyz',
      name: 'generate-commitment-sheet',
      data: { studentId: 'student-42', pinId: 'pin-9' },
    } as unknown as Parameters<typeof feeCommitmentWorker>[0];

    await feeCommitmentWorker(job);

    expect(feeCommitmentSheetService.generateSheet).toHaveBeenCalledTimes(1);
    expect(feeCommitmentSheetService.generateSheet).toHaveBeenCalledWith(
      'student-42',
      'pin-9',
    );
  });

  it('rethrows when generateSheet fails so BullMQ applies its retry policy', async () => {
    vi.mocked(feeCommitmentSheetService.generateSheet).mockRejectedValueOnce(
      new Error('pdf-store-down'),
    );
    const job = {
      id: 'job-xyz',
      name: 'generate-commitment-sheet',
      data: { studentId: 'student-1', pinId: 'pin-1' },
    } as unknown as Parameters<typeof feeCommitmentWorker>[0];

    await expect(feeCommitmentWorker(job)).rejects.toThrow('pdf-store-down');
  });
});

describe('enqueueFeeCommitmentJob', () => {
  beforeEach(() => {
    vi.mocked(addJob).mockClear();
  });

  it('enqueues on the FEE_COMMITMENT queue with the spec retry policy', async () => {
    await enqueueFeeCommitmentJob({ studentId: 'student-1', pinId: 'pin-1' });

    expect(addJob).toHaveBeenCalledTimes(1);
    const [queueName, jobName, data, opts] = vi.mocked(addJob).mock.calls[0]!;
    expect(queueName).toBe(QUEUE_NAMES.FEE_COMMITMENT);
    expect(jobName).toBe('generate-commitment-sheet');
    expect(data).toEqual({ studentId: 'student-1', pinId: 'pin-1' });
    expect(opts?.attempts).toBe(3);
    expect(opts?.backoff?.type).toBe('exponential');
    expect(opts?.backoff?.delay).toBe(5_000);
  });

  it('returns whatever addJob returns (so callers can read the job id)', async () => {
    const result = await enqueueFeeCommitmentJob({
      studentId: 'student-9',
      pinId: 'pin-9',
    });
    expect(result).toMatchObject({ id: 'mock-job-1' });
  });
});
