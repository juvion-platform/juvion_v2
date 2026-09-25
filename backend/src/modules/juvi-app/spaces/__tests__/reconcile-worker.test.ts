import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue = vi.hoisted(() => ({
  getJobSchedulers: vi.fn(),
  removeJobScheduler: vi.fn().mockResolvedValue(true),
  upsertJobScheduler: vi.fn().mockResolvedValue({}),
}));
const queueModule = vi.hoisted(() => ({
  registerQueue: vi.fn(),
  getQueue: vi.fn(() => queue),
  addJob: vi.fn(),
  QUEUE_NAMES: { JUVI_RECONCILE: 'juvi-reconcile' },
}));
vi.mock('../../../../shared/queue', () => queueModule);
vi.mock('../reconcile-service', () => ({ reconcileCollege: vi.fn() }));
vi.mock('../../../../models/College', () => ({ College: { find: vi.fn() } }));

import { registerJuviReconcileQueue, SWEEP_SCHEDULER_ID } from '../reconcile-worker';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerJuviReconcileQueue', () => {
  it('upserts one sweep schedule under a stable id with 3 attempts and 30 s exponential backoff', async () => {
    queue.getJobSchedulers.mockResolvedValue([]);
    await registerJuviReconcileQueue(7);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(SWEEP_SCHEDULER_ID, { every: 7 * 60_000 }, {
      name: 'sweep',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: true, removeOnFail: true },
    });
  });

  it('removes a sweep schedule left under another key, keeping the stable one and unrelated schedulers', async () => {
    queue.getJobSchedulers.mockResolvedValue([
      { key: 'sweep:legacy:300000', name: 'sweep' },
      { key: SWEEP_SCHEDULER_ID, name: 'sweep' },
      { key: 'other', name: 'reconcile-college' },
    ]);
    await registerJuviReconcileQueue(5);
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('sweep:legacy:300000');
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
  });
});
