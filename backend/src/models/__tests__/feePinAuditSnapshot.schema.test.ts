import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { FeePinAuditSnapshot } from '../finance/FeePinAuditSnapshot';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

/**
 * Task 17 — FeePinAuditSnapshot schema assertions.
 *
 * Pure model-level tests; the worker + orchestration live in the
 * companion `fee-pin-audit.worker.test.ts`. Plan §5 + Task 17 AC.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('FeePinAuditSnapshot schema', () => {
  beforeAll(async () => {
    await setupMongo();
    await FeePinAuditSnapshot.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  it('creates a valid snapshot with required fields, sub-arrays, and timestamps', async () => {
    const collegeId = oid();
    const studentId = oid();
    const programmeId = oid();
    const invoiceId = oid();
    const pinId = oid();

    const snap = await FeePinAuditSnapshot.create({
      collegeId,
      runAt: new Date('2026-04-21T02:00:00Z'),
      coverage: {
        totalActiveStudents: 10,
        studentsWithActivePinForCurrentYear: 8,
        coveragePercent: 80,
        missingSample: [
          {
            studentId,
            rollNumber: 'R123',
            programmeId,
            currentYearOfStudy: 2,
          },
        ],
      },
      invariants: {
        totalInvoicesChecked: 100,
        mismatches: [
          {
            invoiceId,
            studentId,
            pinId,
            pinnedTotal: 50000,
            invoiceTotal: 48000,
            delta: -2000,
          },
        ],
      },
      deferredPinsCount: 3,
      commitmentSheetFailureCount: 1,
    });

    expect(snap._id).toBeDefined();
    expect(String(snap.collegeId)).toBe(String(collegeId));
    expect(snap.coverage.coveragePercent).toBe(80);
    expect(snap.coverage.missingSample).toHaveLength(1);
    expect(snap.coverage.missingSample[0]?.rollNumber).toBe('R123');
    expect(snap.invariants.mismatches).toHaveLength(1);
    expect(snap.invariants.mismatches[0]?.delta).toBe(-2000);
    expect(snap.deferredPinsCount).toBe(3);
    expect(snap.commitmentSheetFailureCount).toBe(1);
    const withTs = snap as unknown as { createdAt?: Date; updatedAt?: Date };
    expect(withTs.createdAt).toBeInstanceOf(Date);
    expect(withTs.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects missing collegeId (required)', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      FeePinAuditSnapshot.create({
        runAt: new Date(),
        coverage: {
          totalActiveStudents: 0,
          studentsWithActivePinForCurrentYear: 0,
          coveragePercent: 100,
          missingSample: [],
        },
        invariants: { totalInvoicesChecked: 0, mismatches: [] },
        deferredPinsCount: 0,
        commitmentSheetFailureCount: 0,
      } as any),
    ).rejects.toThrow();
  });

  it('indexes { collegeId: 1, runAt: -1 } for latest-per-college lookups', async () => {
    const indexes = await FeePinAuditSnapshot.collection.indexes();
    const target = indexes.find((i) => {
      const k = i.key as Record<string, number>;
      return k.collegeId === 1 && k.runAt === -1;
    });
    expect(target).toBeDefined();
  });
});
