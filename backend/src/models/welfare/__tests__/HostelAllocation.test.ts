import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { HostelAllocation } from '../HostelAllocation';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Schema contract for HostelAllocation after the optional-allotment extension.
 * Derived from tasks.md Task 1 acceptance criteria.
 */

const NEW_STATUSES = [
  'proposed',
  'waitlisted',
  'active',
  'vacate_requested',
  'vacated',
  'cancelled',
  'declined',
  'withdrawn',
  'expired',
  'transferred',
] as const;

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    collegeId: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    roomId: new mongoose.Types.ObjectId(),
    academicYearId: new mongoose.Types.ObjectId(),
    ...overrides,
  };
}

describe('HostelAllocation schema — optional-allotment extensions', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('status enum and default', () => {
    it("defaults status to 'proposed' when not provided", async () => {
      const doc = await HostelAllocation.create(basePayload());
      expect(doc.status).toBe('proposed');
    });

    it.each(NEW_STATUSES)('persists and round-trips status=%s', async (status) => {
      const doc = await HostelAllocation.create(basePayload({ status }));
      const reloaded = await HostelAllocation.findById(doc._id).lean();
      expect(reloaded?.status).toBe(status);
    });

    it('rejects an invalid status value', async () => {
      await expect(
        HostelAllocation.create(basePayload({ status: 'bogus' })),
      ).rejects.toThrow();
    });
  });

  describe('new proposal/response/vacate metadata fields', () => {
    it('persists all new fields and retrieves them intact', async () => {
      const proposedBy = new mongoose.Types.ObjectId();
      const respondedBy = new mongoose.Types.ObjectId();
      const vacateApprovedBy = new mongoose.Types.ObjectId();
      const proposedAt = new Date('2026-04-01T10:00:00Z');
      const respondedAt = new Date('2026-04-02T10:00:00Z');
      const expiresAt = new Date('2026-04-08T10:00:00Z');
      const vacateRequestedAt = new Date('2026-04-15T10:00:00Z');

      const doc = await HostelAllocation.create(basePayload({
        status: 'active',
        proposedBy,
        proposedAt,
        respondedAt,
        respondedBy,
        ttlDays: 7,
        expiresAt,
        withdrawReason: 'admin decision',
        declineReason: 'prefers day-scholar',
        vacateRequestedAt,
        vacateApprovedBy,
      }));
      const reloaded = await HostelAllocation.findById(doc._id).lean();
      expect(reloaded).toBeTruthy();
      expect(String(reloaded!.proposedBy)).toBe(String(proposedBy));
      expect(reloaded!.proposedAt?.toISOString()).toBe(proposedAt.toISOString());
      expect(reloaded!.respondedAt?.toISOString()).toBe(respondedAt.toISOString());
      expect(String(reloaded!.respondedBy)).toBe(String(respondedBy));
      expect(reloaded!.ttlDays).toBe(7);
      expect(reloaded!.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
      expect(reloaded!.withdrawReason).toBe('admin decision');
      expect(reloaded!.declineReason).toBe('prefers day-scholar');
      expect(reloaded!.vacateRequestedAt?.toISOString()).toBe(vacateRequestedAt.toISOString());
      expect(String(reloaded!.vacateApprovedBy)).toBe(String(vacateApprovedBy));
    });

    it('defaults proposedAt to approximately now when not supplied', async () => {
      const before = Date.now();
      const doc = await HostelAllocation.create(basePayload());
      const after = Date.now();
      const t = doc.proposedAt?.getTime();
      expect(t).toBeDefined();
      expect(t!).toBeGreaterThanOrEqual(before - 1000);
      expect(t!).toBeLessThanOrEqual(after + 1000);
    });

    it("accepts 'admin_proposed' in the allocationMethod enum", async () => {
      const doc = await HostelAllocation.create(basePayload({ allocationMethod: 'admin_proposed' }));
      expect(doc.allocationMethod).toBe('admin_proposed');
    });

    it("continues to accept pre-existing allocationMethod values", async () => {
      const doc = await HostelAllocation.create(basePayload({ allocationMethod: 'ai_recommended' }));
      expect(doc.allocationMethod).toBe('ai_recommended');
    });
  });

  describe('compound index for expiry scanning', () => {
    it('has a { collegeId, status, expiresAt } index', async () => {
      await HostelAllocation.syncIndexes();
      const indexes = await HostelAllocation.collection.indexes();
      const match = indexes.find((ix) => {
        const k = ix.key as Record<string, number>;
        return (
          k.collegeId === 1 &&
          k.status === 1 &&
          k.expiresAt === 1 &&
          Object.keys(k).length === 3
        );
      });
      expect(match, `expected compound index on collegeId+status+expiresAt, got ${JSON.stringify(indexes.map(i => i.key))}`).toBeDefined();
    });
  });
});
