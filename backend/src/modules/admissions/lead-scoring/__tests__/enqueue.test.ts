import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 001-ai-lead-scoring — Task 4.1
 * The enqueue helper composes a deterministic minute-bucketed jobId so
 * two scoring requests on the same inquiry inside a 60s window collapse
 * into one BullMQ job (spec §10.6).
 */

const { addJobMock } = vi.hoisted(() => ({
  addJobMock: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

vi.mock('../../../../shared/queue/QueueManager', async (orig) => {
  const actual = await orig<typeof import('../../../../shared/queue/QueueManager')>();
  return { ...actual, addJob: addJobMock };
});

import { enqueueScoring, scoringJobId } from '../enqueue';

beforeEach(() => addJobMock.mockClear());

describe('scoringJobId', () => {
  it('produces the same jobId for the same (college, inquiry, minute)', () => {
    const t = new Date('2026-05-14T10:00:30Z');
    const a = scoringJobId('c1', 'i1', t);
    const b = scoringJobId('c1', 'i1', new Date('2026-05-14T10:00:45Z'));
    expect(a).toBe(b);
  });

  it('produces a different jobId in the next minute', () => {
    const a = scoringJobId('c1', 'i1', new Date('2026-05-14T10:00:30Z'));
    const b = scoringJobId('c1', 'i1', new Date('2026-05-14T10:01:30Z'));
    expect(a).not.toBe(b);
  });

  it('produces a different jobId for different inquiries', () => {
    const t = new Date('2026-05-14T10:00:30Z');
    expect(scoringJobId('c1', 'i1', t)).not.toBe(scoringJobId('c1', 'i2', t));
  });

  it('contains NO `:` characters (BullMQ rejects them in custom jobIds)', () => {
    const id = scoringJobId('college-1', 'inquiry-2', new Date('2026-05-14T10:00:30Z'));
    expect(id).not.toMatch(/:/);
  });
});

describe('enqueueScoring', () => {
  it('forwards the composite jobId, queue name, and payload to addJob', async () => {
    await enqueueScoring({
      collegeId: 'c1',
      inquiryId: 'i1',
      performedBy: 'user-7',
      trigger: 'create',
      now: new Date('2026-05-14T10:00:30Z'),
    });
    expect(addJobMock).toHaveBeenCalledTimes(1);
    const [queueName, jobName, data, opts] = addJobMock.mock.calls[0]!;
    expect(queueName).toBe('admissions_lead_scoring');
    expect(jobName).toBe('score');
    expect(data).toMatchObject({
      collegeId: 'c1',
      inquiryId: 'i1',
      performedBy: 'user-7',
      trigger: 'create',
    });
    expect(opts.jobId).toBe(scoringJobId('c1', 'i1', new Date('2026-05-14T10:00:30Z')));
  });

  it('marks batch trigger payloads so the worker can prioritize/log accordingly', async () => {
    await enqueueScoring({
      collegeId: 'c1', inquiryId: 'i1', performedBy: 'system:lead-scoring-batch', trigger: 'batch',
    });
    const [, , data] = addJobMock.mock.calls[0]!;
    expect(data.trigger).toBe('batch');
  });
});
