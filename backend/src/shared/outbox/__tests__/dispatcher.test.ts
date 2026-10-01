import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue = vi.hoisted(() => ({ upsertJobScheduler: vi.fn().mockResolvedValue({}), add: vi.fn().mockResolvedValue({}) }));
const queueModule = vi.hoisted(() => ({
  registerQueue: vi.fn(),
  getQueue: vi.fn(() => queue),
  addJob: vi.fn().mockResolvedValue({}),
  QUEUE_NAMES: { OUTBOX: 'platform_outbox' },
}));
const outbox = vi.hoisted(() => ({ processOnce: vi.fn().mockResolvedValue(3), setTickEnqueuer: vi.fn() }));
vi.mock('../../queue', () => queueModule);
vi.mock('../outbox', () => outbox);

import { registerOutboxQueue, TICK_SCHEDULER_ID, TICK_EVERY_MS, KICK_JOB_ID } from '../dispatcher';

beforeEach(() => { vi.clearAllMocks(); });

describe('registerOutboxQueue', () => {
  it('registers the queue with a 5 s tick and installs an immediate-tick enqueuer', async () => {
    await registerOutboxQueue();
    expect(queueModule.registerQueue).toHaveBeenCalledWith(expect.objectContaining({ name: 'platform_outbox', concurrency: 1 }));
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(TICK_SCHEDULER_ID, { every: TICK_EVERY_MS }, {
      name: 'tick', data: {}, opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
    });
    const enqueuer = outbox.setTickEnqueuer.mock.calls[0]![0] as () => Promise<void>;
    await enqueuer();
    expect(queue.add).toHaveBeenCalledWith('kick', {}, { jobId: KICK_JOB_ID, attempts: 1, removeOnComplete: true, removeOnFail: true });
    expect(KICK_JOB_ID).toBe('outbox-kick');
    const processor = (queueModule.registerQueue.mock.calls[0]![0] as { processor: (j: unknown) => Promise<unknown> }).processor;
    expect(await processor({ name: 'tick' })).toEqual({ processed: 3 });
    expect(TICK_EVERY_MS).toBe(5_000);
  });

  it('sweeps on the scheduled tick only, not on a kick', async () => {
    await registerOutboxQueue();
    const processor = (queueModule.registerQueue.mock.calls[0]![0] as { processor: (j: unknown) => Promise<unknown> }).processor;
    await processor({ name: 'tick' });
    expect(outbox.processOnce).toHaveBeenLastCalledWith(undefined, { sweep: true });
    await processor({ name: 'kick' });
    expect(outbox.processOnce).toHaveBeenLastCalledWith(undefined, { sweep: false });
  });
});
