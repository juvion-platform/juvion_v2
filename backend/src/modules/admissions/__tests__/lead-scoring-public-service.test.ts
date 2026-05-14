import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * 001-ai-lead-scoring — Task 4.7 service-layer smokes for the public
 * surface the controller calls. Routes themselves are exercised by
 * existing supertest patterns in the repo, but these isolate the
 * service contracts:
 *   - rescoreInquiry enqueues + returns 202-shape, or 208-shape on debounce
 *   - batchScoreInquiries enumerates the filter and enqueues N
 *   - getLeadScoringStats aggregates by date
 */

const { addJobMock } = vi.hoisted(() => ({
  addJobMock: vi.fn().mockResolvedValue({ id: 'mock-1' }),
}));

vi.mock('../../../shared/queue/QueueManager', async (orig) => {
  const actual = await orig<typeof import('../../../shared/queue/QueueManager')>();
  return { ...actual, addJob: addJobMock };
});

import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Inquiry } from '../../../models/admissions/Inquiry';
import { LeadScoringStats } from '../../../models/admissions/LeadScoringStats';
import { rescoreInquiry, batchScoreInquiries, getLeadScoringStats } from '../service';

const oid = () => new mongoose.Types.ObjectId();

describe('lead-scoring public service', () => {
  beforeAll(async () => {
    await setupMongo();
    await Inquiry.syncIndexes();
    await LeadScoringStats.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
    addJobMock.mockClear();
  });

  describe('rescoreInquiry', () => {
    it('throws 404 when inquiry does not exist for this college (multi-tenancy)', async () => {
      const otherCollege = oid();
      const inq = await Inquiry.create({ collegeId: otherCollege, name: 'X', phone: '+91-9000000001', source: 'website' });
      await expect(rescoreInquiry(String(oid()), String(inq._id), 'user-1')).rejects.toThrow();
      expect(addJobMock).not.toHaveBeenCalled();
    });

    it('returns 202-shape when no recent score exists', async () => {
      const collegeId = oid();
      const inq = await Inquiry.create({ collegeId, name: 'X', phone: '+91-9000000002', source: 'walk-in' });
      const r = await rescoreInquiry(String(collegeId), String(inq._id), 'user-1');
      expect(r.status).toBe('enqueued');
      expect(r.jobId).toBeTruthy();
      expect(addJobMock).toHaveBeenCalledTimes(1);
    });

    it('returns 208-shape when lastScoredAt is fresh (<60s)', async () => {
      const collegeId = oid();
      const inq = await Inquiry.create({
        collegeId, name: 'X', phone: '+91-9000000003', source: 'walk-in',
        lastScoredAt: new Date(),
      });
      const r = await rescoreInquiry(String(collegeId), String(inq._id), 'user-1');
      expect(r.status).toBe('already_scored');
      expect(addJobMock).not.toHaveBeenCalled();
    });
  });

  describe('batchScoreInquiries', () => {
    it('enqueues one job per matching inquiry and respects maxJobs', async () => {
      const collegeId = oid();
      for (let i = 0; i < 5; i++) {
        await Inquiry.create({
          collegeId, name: `Lead ${i}`, phone: `+91-90000010${i.toString().padStart(2, '0')}`, source: 'website',
          status: 'new',
        });
      }
      const r = await batchScoreInquiries(String(collegeId), 'user-1', { status: 'new', maxJobs: 3 });
      expect(r.enqueued).toBe(3);
      expect(addJobMock).toHaveBeenCalledTimes(3);
    });

    it('only enqueues for inquiries in the calling college', async () => {
      const collegeA = oid();
      const collegeB = oid();
      await Inquiry.create({ collegeId: collegeA, name: 'A', phone: '+91-9000000101', source: 'walk-in' });
      await Inquiry.create({ collegeId: collegeB, name: 'B', phone: '+91-9000000102', source: 'walk-in' });
      const r = await batchScoreInquiries(String(collegeA), 'user-1', {});
      expect(r.enqueued).toBe(1);
    });
  });

  describe('getLeadScoringStats', () => {
    it('aggregates daily rows over the requested range', async () => {
      const collegeId = oid();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 86_400_000);

      await LeadScoringStats.create({
        collegeId, date: today,
        totalScored: 30, llmScored: 28, rulesOnlyScored: 2,
        totalLlmCostInr: 42, avgLatencyMs: 3000,
        gradeDistribution: { hot: 5, warm: 10, cold: 10, dormant: 5 },
        llmCapHit: false, modelVersion: 'rules-v1+claude',
      });
      await LeadScoringStats.create({
        collegeId, date: yesterday,
        totalScored: 20, llmScored: 18, rulesOnlyScored: 2,
        totalLlmCostInr: 30, avgLatencyMs: 3500,
        gradeDistribution: { hot: 2, warm: 8, cold: 8, dormant: 2 },
        llmCapHit: true, modelVersion: 'rules-v1+claude',
      });

      const r = await getLeadScoringStats(String(collegeId), 'week');
      expect(r.totalScored).toBe(50);
      expect(r.llmScored).toBe(46);
      expect(r.totalLlmCostInr).toBe(72);
      expect(r.gradeDistribution.hot).toBe(7);
      expect(r.gradeDistribution.warm).toBe(18);
      expect(r.capReached).toBe(true); // any row in range hit the cap
      expect(r.daily).toHaveLength(2);
    });

    it('returns zeros when no stats exist for the college', async () => {
      const r = await getLeadScoringStats(String(oid()), 'today');
      expect(r.totalScored).toBe(0);
      expect(r.daily).toHaveLength(0);
    });
  });
});
