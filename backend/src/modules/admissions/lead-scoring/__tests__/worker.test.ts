import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 001-ai-lead-scoring — Task 4.2
 * The worker module exposes the BullMQ processor in isolation so it can
 * be tested without spinning up BullMQ. Module load also calls
 * `registerQueue` once — verified separately.
 */

const { registerQueueMock, scoreInquiryMock } = vi.hoisted(() => ({
  registerQueueMock: vi.fn(),
  scoreInquiryMock: vi.fn(),
}));

vi.mock('../../../../shared/queue/QueueManager', async (orig) => {
  const actual = await orig<typeof import('../../../../shared/queue/QueueManager')>();
  return { ...actual, registerQueue: registerQueueMock };
});

vi.mock('../service', () => ({
  scoreInquiry: scoreInquiryMock,
}));

import { leadScoringProcessor, registerLeadScoringQueue } from '../worker';

beforeEach(() => {
  scoreInquiryMock.mockReset();
});

describe('leadScoringProcessor', () => {
  it('delegates to scoreInquiry with the payload fields', async () => {
    scoreInquiryMock.mockResolvedValueOnce({ blendedScore: 72, leadGrade: 'warm' });
    const job = {
      id: 'job-1',
      name: 'score',
      data: { collegeId: 'c1', inquiryId: 'i1', performedBy: 'user-1', trigger: 'create' },
    } as unknown as Parameters<typeof leadScoringProcessor>[0];

    const r = await leadScoringProcessor(job);
    expect(scoreInquiryMock).toHaveBeenCalledWith('c1', 'i1', 'user-1', expect.objectContaining({ trigger: 'create' }));
    expect(r).toMatchObject({ blendedScore: 72, leadGrade: 'warm' });
  });

  it('rethrows so BullMQ applies its retry policy', async () => {
    scoreInquiryMock.mockRejectedValueOnce(new Error('mongo-down'));
    const job = {
      id: 'job-2',
      name: 'score',
      data: { collegeId: 'c1', inquiryId: 'i1', performedBy: 'user-1', trigger: 'manual' },
    } as unknown as Parameters<typeof leadScoringProcessor>[0];
    await expect(leadScoringProcessor(job)).rejects.toThrow('mongo-down');
  });
});

describe('registerLeadScoringQueue', () => {
  it('does NOT register at module load (server.ts is the only caller)', () => {
    // The mock was wired before the worker module imported QueueManager.
    // If this fires at import time, test environments that import app.ts
    // (e.g. e2e route tests) get an unwanted BullMQ connect attempt.
    expect(registerQueueMock).not.toHaveBeenCalled();
  });

  it('registers the lead-scoring queue when called explicitly', () => {
    registerLeadScoringQueue();
    expect(registerQueueMock).toHaveBeenCalledTimes(1);
    const cfg = registerQueueMock.mock.calls[0]![0];
    expect(cfg.name).toBe('admissions_lead_scoring');
    expect(typeof cfg.processor).toBe('function');
    expect(cfg.concurrency).toBe(3);
  });
});
