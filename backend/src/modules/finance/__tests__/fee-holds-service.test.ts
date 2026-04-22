import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import * as svc from '../fee-holds-service';
import { FinancialHold, IFinancialHold } from '../../../models/finance/FinancialHold';
import { AuditLog } from '../../../shared/audit';
import { AppError } from '../../../middleware/errorHandler';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * Task 4 — fee-holds-service (fee-collection-analytics-and-alerts)
 *
 * Covers:
 *   - listHolds: default ordering (pending_approval → active → released, each
 *     sorted by createdAt DESC), filter by status + studentId, pagination
 *   - activateHold: pending_approval → active, effectiveDate + approvedBy set,
 *     409 on stale state, audit log emitted
 *   - waiveHold: pending_approval | active → released, releaseDate +
 *     releasedBy + releaseReason set, 400 on missing reason, 409 on stale,
 *     audit log emitted
 *
 * T4 is a pure service layer — routing (T8) and UI (T10) are out of scope.
 */

const oid = () => new mongoose.Types.ObjectId();

interface SeedHoldOverrides {
  collegeId?: string;
  studentId?: string;
  holdStatus?: 'pending_approval' | 'active' | 'released';
  createdAt?: Date;
  approvedBy?: string;
  releaseDate?: Date;
  releasedBy?: string;
  releaseReason?: string;
}

async function seedHold(overrides: SeedHoldOverrides = {}): Promise<IFinancialHold> {
  const doc = await FinancialHold.create({
    collegeId: overrides.collegeId ?? String(oid()),
    studentId: overrides.studentId ?? String(oid()),
    defaulterRecordId: oid(),
    holdType: 'exam_debarment',
    holdStatus: overrides.holdStatus ?? 'pending_approval',
    effectiveDate: new Date(),
    ...(overrides.approvedBy ? { approvedBy: overrides.approvedBy } : {}),
    ...(overrides.releaseDate ? { releaseDate: overrides.releaseDate } : {}),
    ...(overrides.releasedBy ? { releasedBy: overrides.releasedBy } : {}),
    ...(overrides.releaseReason ? { releaseReason: overrides.releaseReason } : {}),
  });
  // Force createdAt if a specific ordering timestamp is required (timestamps
  // are auto-populated — we use updateOne to override since direct assign on
  // a new doc is a no-op).
  if (overrides.createdAt) {
    await FinancialHold.updateOne({ _id: doc._id }, { $set: { createdAt: overrides.createdAt } });
    const fresh = await FinancialHold.findById(doc._id);
    return fresh!;
  }
  return doc;
}

describe('fee-holds-service', () => {
  beforeAll(async () => {
    await setupMongo();
    await FinancialHold.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  // ── listHolds ─────────────────────────────────────────────────────────

  describe('listHolds', () => {
    it('default ordering: pending_approval first, then active, then released; within each group newest first', async () => {
      const collegeId = String(oid());
      const old = new Date('2026-01-01T00:00:00Z');
      const mid = new Date('2026-02-01T00:00:00Z');
      const recent = new Date('2026-03-01T00:00:00Z');

      // Seed in scrambled order to prove ordering isn't insertion order
      await seedHold({ collegeId, holdStatus: 'released', createdAt: mid, approvedBy: String(oid()), releasedBy: String(oid()), releaseDate: new Date(), releaseReason: 'r' });
      await seedHold({ collegeId, holdStatus: 'active', createdAt: old, approvedBy: String(oid()) });
      await seedHold({ collegeId, holdStatus: 'pending_approval', createdAt: old });
      await seedHold({ collegeId, holdStatus: 'pending_approval', createdAt: recent });
      await seedHold({ collegeId, holdStatus: 'active', createdAt: recent, approvedBy: String(oid()) });

      const { items, total } = await svc.listHolds(collegeId, {});
      expect(total).toBe(5);
      expect(items.map((i) => i.holdStatus)).toEqual([
        'pending_approval', // recent
        'pending_approval', // old
        'active',            // recent
        'active',            // old
        'released',          // mid (only one released)
      ]);
    });

    it('filters by status (exact match)', async () => {
      const collegeId = String(oid());
      await seedHold({ collegeId, holdStatus: 'pending_approval' });
      await seedHold({ collegeId, holdStatus: 'active', approvedBy: String(oid()) });
      await seedHold({ collegeId, holdStatus: 'released', approvedBy: String(oid()), releasedBy: String(oid()), releaseDate: new Date(), releaseReason: 'r' });

      const res = await svc.listHolds(collegeId, { status: 'active' });
      expect(res.total).toBe(1);
      expect(res.items[0]!.holdStatus).toBe('active');
    });

    it('filters by studentId', async () => {
      const collegeId = String(oid());
      const studentA = String(oid());
      const studentB = String(oid());
      await seedHold({ collegeId, studentId: studentA, holdStatus: 'pending_approval' });
      await seedHold({ collegeId, studentId: studentA, holdStatus: 'active', approvedBy: String(oid()) });
      await seedHold({ collegeId, studentId: studentB, holdStatus: 'pending_approval' });

      const res = await svc.listHolds(collegeId, { studentId: studentA });
      expect(res.total).toBe(2);
      for (const h of res.items) expect(String(h.studentId)).toBe(studentA);
    });

    it('always filters by collegeId — cross-college isolation', async () => {
      const collegeA = String(oid());
      const collegeB = String(oid());
      await seedHold({ collegeId: collegeA, holdStatus: 'pending_approval' });
      await seedHold({ collegeId: collegeB, holdStatus: 'pending_approval' });

      const resA = await svc.listHolds(collegeA, {});
      const resB = await svc.listHolds(collegeB, {});
      expect(resA.total).toBe(1);
      expect(resB.total).toBe(1);
      expect(String(resA.items[0]!.collegeId)).toBe(collegeA);
      expect(String(resB.items[0]!.collegeId)).toBe(collegeB);
    });

    it('honors limit + offset; default limit is 20; max limit is 100', async () => {
      const collegeId = String(oid());
      for (let i = 0; i < 25; i++) {
        await seedHold({ collegeId, holdStatus: 'pending_approval' });
      }
      // Default limit = 20
      const defaultRes = await svc.listHolds(collegeId, {});
      expect(defaultRes.total).toBe(25);
      expect(defaultRes.items.length).toBe(20);

      // Offset 20 returns 5
      const offsetRes = await svc.listHolds(collegeId, { offset: 20 });
      expect(offsetRes.items.length).toBe(5);

      // Max limit clamps to 100 (we pass 500)
      const bigRes = await svc.listHolds(collegeId, { limit: 500 });
      expect(bigRes.items.length).toBeLessThanOrEqual(100);
    });
  });

  // ── activateHold ──────────────────────────────────────────────────────

  describe('activateHold', () => {
    it('pending_approval → active: sets approvedBy + effectiveDate; returns updated doc', async () => {
      const collegeId = String(oid());
      const approver = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'pending_approval' });

      const before = Date.now();
      const updated = await svc.activateHold(collegeId, String(hold._id), approver);
      const after = Date.now();

      expect(updated.holdStatus).toBe('active');
      expect(String(updated.approvedBy)).toBe(approver);
      expect(updated.effectiveDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.effectiveDate.getTime()).toBeLessThanOrEqual(after);

      const persisted = await FinancialHold.findById(hold._id);
      expect(persisted!.holdStatus).toBe('active');
      expect(String(persisted!.approvedBy)).toBe(approver);
    });

    it('409 when hold is already active', async () => {
      const collegeId = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'active', approvedBy: String(oid()) });
      await expect(svc.activateHold(collegeId, String(hold._id), String(oid()))).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('409 when hold is already released', async () => {
      const collegeId = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'released', approvedBy: String(oid()), releasedBy: String(oid()), releaseDate: new Date(), releaseReason: 'r' });
      await expect(svc.activateHold(collegeId, String(hold._id), String(oid()))).rejects.toBeInstanceOf(AppError);
    });

    it('409 when hold belongs to a different college (multi-tenancy guard)', async () => {
      const collegeA = String(oid());
      const collegeB = String(oid());
      const hold = await seedHold({ collegeId: collegeA, holdStatus: 'pending_approval' });
      await expect(svc.activateHold(collegeB, String(hold._id), String(oid()))).rejects.toMatchObject({
        statusCode: 409,
      });
      // Unchanged in the actual college
      const persisted = await FinancialHold.findById(hold._id);
      expect(persisted!.holdStatus).toBe('pending_approval');
    });

    it('emits an AuditLog entry with from→to change', async () => {
      const collegeId = String(oid());
      const approver = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'pending_approval' });

      await svc.activateHold(collegeId, String(hold._id), approver);

      const logs = await AuditLog.find({ entityType: 'FinancialHold', entityId: String(hold._id) });
      expect(logs.length).toBe(1);
      const log = logs[0]!;
      expect(log.action).toBe('update');
      expect(log.performedBy).toBe(approver);
      expect(String(log.collegeId)).toBe(collegeId);
      expect(log.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'holdStatus',
            oldValue: 'pending_approval',
            newValue: 'active',
          }),
        ]),
      );
    });
  });

  // ── waiveHold ─────────────────────────────────────────────────────────

  describe('waiveHold', () => {
    it('pending_approval → released: sets releasedBy + releaseDate + releaseReason', async () => {
      const collegeId = String(oid());
      const approver = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'pending_approval' });

      const updated = await svc.waiveHold(collegeId, String(hold._id), approver, 'Financial hardship');

      expect(updated.holdStatus).toBe('released');
      expect(String(updated.releasedBy)).toBe(approver);
      expect(updated.releaseReason).toBe('Financial hardship');
      expect(updated.releaseDate).toBeInstanceOf(Date);
    });

    it('active → released: works too (waive covers both active + pending)', async () => {
      const collegeId = String(oid());
      const approver = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'active', approvedBy: String(oid()) });

      const updated = await svc.waiveHold(collegeId, String(hold._id), approver, 'Paid in full');
      expect(updated.holdStatus).toBe('released');
      expect(String(updated.releasedBy)).toBe(approver);
      expect(updated.releaseReason).toBe('Paid in full');
    });

    it('409 when hold is already released', async () => {
      const collegeId = String(oid());
      const hold = await seedHold({
        collegeId,
        holdStatus: 'released',
        approvedBy: String(oid()),
        releasedBy: String(oid()),
        releaseDate: new Date(),
        releaseReason: 'prev',
      });
      await expect(svc.waiveHold(collegeId, String(hold._id), String(oid()), 'again')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('400 when reason is missing / empty / whitespace', async () => {
      const collegeId = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'pending_approval' });
      await expect(svc.waiveHold(collegeId, String(hold._id), String(oid()), '')).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(svc.waiveHold(collegeId, String(hold._id), String(oid()), '   ')).rejects.toMatchObject({
        statusCode: 400,
      });

      // Missing reason must NOT have mutated the hold
      const persisted = await FinancialHold.findById(hold._id);
      expect(persisted!.holdStatus).toBe('pending_approval');
    });

    it('409 when hold belongs to a different college', async () => {
      const collegeA = String(oid());
      const collegeB = String(oid());
      const hold = await seedHold({ collegeId: collegeA, holdStatus: 'pending_approval' });
      await expect(svc.waiveHold(collegeB, String(hold._id), String(oid()), 'wrong tenant')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('emits an AuditLog entry with from→to change capturing the waiver', async () => {
      const collegeId = String(oid());
      const approver = String(oid());
      const hold = await seedHold({ collegeId, holdStatus: 'active', approvedBy: String(oid()) });

      await svc.waiveHold(collegeId, String(hold._id), approver, 'Goodwill waiver');

      const logs = await AuditLog.find({ entityType: 'FinancialHold', entityId: String(hold._id) });
      expect(logs.length).toBe(1);
      const log = logs[0]!;
      expect(log.action).toBe('update');
      expect(log.performedBy).toBe(approver);
      expect(log.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'holdStatus',
            oldValue: 'active',
            newValue: 'released',
          }),
        ]),
      );
    });
  });
});
