import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queue = vi.hoisted(() => ({ upsertJobScheduler: vi.fn().mockResolvedValue({}) }));
const queueModule = vi.hoisted(() => ({
  registerQueue: vi.fn(),
  getQueue: vi.fn(() => queue),
  QUEUE_NAMES: { JUVI_ACCOUNT_DELETION: 'juvi_account_deletion' },
}));
vi.mock('../../../../shared/queue', () => queueModule);

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import {
  JUVI_ACCOUNT_DELETION_SWEEP_ID, SWEEP_EVERY_MS, registerJuviAccountDeletionQueue,
} from '../deletion-sweep-worker';

/**
 * 011 T11 — the sweep's registration and its scan shape.
 *
 * The sweep's *behaviour* is T12's file (`deletion-sweep.test.ts`); this one is about the two things
 * that are easy to get subtly wrong and invisible when wrong: the schedule's identity, and the
 * question of which index the scan lands on.
 */

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => { await clearCollections(); });

describe('the sweep schedule (011 T11)', () => {
  it('registers under a stable id, so re-registering replaces the schedule instead of adding a second', async () => {
    await registerJuviAccountDeletionQueue();
    await registerJuviAccountDeletionQueue();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    // The id carries no interval. A schedule keyed by its own period — the shape `add(..., {repeat})`
    // produces — leaves the old one running when the period changes, which for this queue means
    // deletions executing on a cadence nobody chose. The reconcile worker had to ship a cleanup loop
    // for exactly that (`reconcile-worker.ts:43-47`); this one is not going to need it.
    expect(JUVI_ACCOUNT_DELETION_SWEEP_ID).not.toContain(String(SWEEP_EVERY_MS));
    for (const call of queue.upsertJobScheduler.mock.calls) {
      expect(call[0]).toBe(JUVI_ACCOUNT_DELETION_SWEEP_ID);
      expect(call[1]).toEqual({ every: SWEEP_EVERY_MS });
    }
    expect(queueModule.registerQueue).toHaveBeenCalledWith(expect.objectContaining({ name: 'juvi_account_deletion', concurrency: 1 }));
  });
});

describe('the sweep scan (011 T11)', () => {
  it('finds due rows through the sparse index on deletionRequestedAt', async () => {
    await JuviAccount.init();
    const plan = await JuviAccount.find({
      deletionRequestedAt: { $lte: new Date(), $ne: null },
    }).explain('queryPlanner') as unknown;

    expect(JSON.stringify((plan as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan))
      .toContain('deletionRequestedAt_1');
  });
});
