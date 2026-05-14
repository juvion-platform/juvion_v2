/**
 * QueueManager — jobId option forwarding test.
 *
 * Added for 001-ai-lead-scoring. The lead-scoring enqueue helper relies
 * on BullMQ's native jobId-based dedup so two scoring requests for the
 * same inquiry inside the same minute collapse into one job. That
 * requires `addJob` to forward an optional `jobId` to `Queue.add`.
 *
 * We mock the `bullmq` module so the test doesn't need a live Redis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { addMock } = vi.hoisted(() => ({ addMock: vi.fn().mockResolvedValue({ id: 'whatever' }) }));

vi.mock('bullmq', () => {
  class Queue { add = addMock; close = vi.fn(); }
  class Worker { on = vi.fn(); close = vi.fn(); }
  class QueueEvents { close = vi.fn(); }
  return { Queue, Worker, QueueEvents };
});

import { registerQueue, addJob } from '../QueueManager';

describe('QueueManager.addJob — jobId option', () => {
  beforeEach(() => {
    addMock.mockClear();
  });

  it('forwards a jobId to Queue.add when provided', async () => {
    registerQueue({ name: 'test:jobid-q', processor: async () => 'ok' });

    await addJob('test:jobid-q', 'score', { inquiryId: 'inq-1' }, {
      jobId: 'score:college-1:inq-1:29457182',
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    const opts = addMock.mock.calls[0]![2] as Record<string, unknown>;
    expect(opts.jobId).toBe('score:college-1:inq-1:29457182');
  });

  it('omits jobId when not provided (preserves existing behavior)', async () => {
    registerQueue({ name: 'test:no-jobid-q', processor: async () => 'ok' });

    await addJob('test:no-jobid-q', 'work', { x: 1 });

    expect(addMock).toHaveBeenCalledTimes(1);
    const opts = addMock.mock.calls[0]![2] as Record<string, unknown>;
    expect(opts.jobId).toBeUndefined();
  });
});
