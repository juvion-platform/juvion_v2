import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { TransportAllocation } from '../TransportAllocation';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Schema contract for TransportAllocation after the optional-allotment extension.
 * Transport uses 'cancelled' as its terminal vacate state (not 'vacated') — this
 * test file preserves that semantic while asserting the new statuses.
 */

const NEW_STATUSES = [
  'proposed',
  'waitlisted',
  'active',
  'vacate_requested',
  'cancelled',
  'declined',
  'withdrawn',
  'expired',
] as const;

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    collegeId: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    routeId: new mongoose.Types.ObjectId(),
    stopName: 'Main Gate',
    academicYearId: new mongoose.Types.ObjectId(),
    ...overrides,
  };
}

describe('TransportAllocation schema — optional-allotment extensions', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('status enum and default', () => {
    it("defaults status to 'proposed' when not provided", async () => {
      const doc = await TransportAllocation.create(basePayload());
      expect(doc.status).toBe('proposed');
    });

    it.each(NEW_STATUSES)('persists and round-trips status=%s', async (status) => {
      const doc = await TransportAllocation.create(basePayload({ status }));
      const reloaded = await TransportAllocation.findById(doc._id).lean();
      expect(reloaded?.status).toBe(status);
    });

    it('rejects an invalid status value', async () => {
      await expect(
        TransportAllocation.create(basePayload({ status: 'bogus' })),
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

      const doc = await TransportAllocation.create(basePayload({
        status: 'active',
        proposedBy,
        proposedAt,
        respondedAt,
        respondedBy,
        ttlDays: 7,
        expiresAt,
        withdrawReason: 'route closed',
        declineReason: 'moved closer to campus',
        vacateRequestedAt,
        vacateApprovedBy,
        waitlistPosition: 3,
      }));
      const reloaded = await TransportAllocation.findById(doc._id).lean();
      expect(reloaded).toBeTruthy();
      expect(String(reloaded!.proposedBy)).toBe(String(proposedBy));
      expect(reloaded!.proposedAt?.toISOString()).toBe(proposedAt.toISOString());
      expect(reloaded!.respondedAt?.toISOString()).toBe(respondedAt.toISOString());
      expect(String(reloaded!.respondedBy)).toBe(String(respondedBy));
      expect(reloaded!.ttlDays).toBe(7);
      expect(reloaded!.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
      expect(reloaded!.withdrawReason).toBe('route closed');
      expect(reloaded!.declineReason).toBe('moved closer to campus');
      expect(reloaded!.vacateRequestedAt?.toISOString()).toBe(vacateRequestedAt.toISOString());
      expect(String(reloaded!.vacateApprovedBy)).toBe(String(vacateApprovedBy));
      expect(reloaded!.waitlistPosition).toBe(3);
    });

    it('defaults proposedAt to approximately now when not supplied', async () => {
      const before = Date.now();
      const doc = await TransportAllocation.create(basePayload());
      const after = Date.now();
      const t = doc.proposedAt?.getTime();
      expect(t).toBeDefined();
      expect(t!).toBeGreaterThanOrEqual(before - 1000);
      expect(t!).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('compound index for expiry scanning', () => {
    it('has a { collegeId, status, expiresAt } index', async () => {
      await TransportAllocation.syncIndexes();
      const indexes = await TransportAllocation.collection.indexes();
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
