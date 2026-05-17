import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { SemesterResult } from '../../../models/academic-ops/SemesterResult';
import { PromotionDecision } from '../../../models/academic-ops/PromotionDecision';
import { Semester } from '../../../models/academic-structure/Semester';

/**
 * Task 9 — Promotion integration with fee-pin-service.pinYear(N+1).
 *
 * We mock fee-pin-service so these remain unit-ish: no FeeStructureInstance
 * seeding required. Behavioral assertions: call counts, argument shape,
 * deferred-pin bookkeeping, and rethrow of non-FeeStructureNotFoundError.
 */

// Mock BEFORE importing service-under-test so the service module resolves
// our mock implementation.
vi.mock('../../finance/fee-pin-service', async () => {
  const actual = await vi.importActual<typeof import('../../finance/fee-pin-service')>(
    '../../finance/fee-pin-service',
  );
  return {
    ...actual,
    pinYear: vi.fn(),
    // Keep real FeeStructureNotFoundError so `instanceof` works inside the
    // module under test.
    FeeStructureNotFoundError: actual.FeeStructureNotFoundError,
  };
});

import * as feePinService from '../../finance/fee-pin-service';
import { FeeStructureNotFoundError } from '../../finance/fee-pin-service';
import { promoteStudents } from '../academic-delivery-service';

const oid = () => new mongoose.Types.ObjectId();

interface SeedParams {
  collegeId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  semesterId: mongoose.Types.ObjectId;
  studentCount: number;
  /** Per-index override of backlogs (used to force detained/year_back). */
  backlogsByIndex?: Record<number, number>;
  /** Per-index override of SGPA (used to force year_back). */
  sgpaByIndex?: Record<number, number>;
}

async function seedBatch(params: SeedParams) {
  const studentIds: mongoose.Types.ObjectId[] = [];
  for (let i = 0; i < params.studentCount; i++) {
    const student = await Student.create({
      collegeId: params.collegeId,
      personId: oid(),
      // Distinct rollNumber per student — the Student model declares a
      // unique compound index on { collegeId, rollNumber } (sparse, but a
      // sparse compound where `collegeId` is required still indexes every
      // doc — missing rollNumber is treated as `null`). Without unique
      // values here, the second insert in a given test races the index
      // build and intermittently fails E11000. Real-world inserts always
      // assign a rollNumber, so the fixture matches production behaviour.
      rollNumber: `R-${i}-${oid().toString().slice(-6)}`,
      admissionYear: 2025,
      programmeId: params.programmeId,
      branchId: oid(),
      quota: 'convener',
      category: 'OC',
      status: 'active',
    });
    studentIds.push(student._id as mongoose.Types.ObjectId);

    const backlogs = params.backlogsByIndex?.[i] ?? 0;
    const sgpa = params.sgpaByIndex?.[i] ?? 7.5;
    await SemesterResult.create({
      collegeId: params.collegeId,
      studentId: student._id,
      semesterId: params.semesterId,
      sgpa,
      cgpa: sgpa,
      totalCreditsEarned: 20,
      totalCreditsRegistered: 20,
      backlogs,
      result: backlogs === 0 ? 'pass' : 'fail',
      status: 'published',
    });
  }
  return studentIds;
}

describe('promoteStudents — fee-pin integration (Task 9)', { timeout: 30_000 }, () => {
  let collegeId: mongoose.Types.ObjectId;
  let programmeId: mongoose.Types.ObjectId;
  let semesterId: mongoose.Types.ObjectId;
  let academicYearId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });
  beforeEach(() => {
    vi.mocked(feePinService.pinYear).mockReset();
  });

  async function makeSemester() {
    collegeId = oid();
    programmeId = oid();
    academicYearId = oid();
    const sem = await Semester.create({
      collegeId,
      academicYearId,
      number: 2,
      year: 1,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-05-31'),
      status: 'completed',
    });
    semesterId = sem._id as mongoose.Types.ObjectId;
  }

  // ── 1. Happy path: 10 promoted → 10 pinYear calls, 0 deferred ────────
  it('pins Year-2 for every promoted student and reports zero deferrals', async () => {
    await makeSemester();
    const ids = await seedBatch({ collegeId, programmeId, semesterId, studentCount: 10 });

    vi.mocked(feePinService.pinYear).mockResolvedValue({
      _id: oid(),
      yearOfStudy: 2,
      feeStructureInstanceId: oid(),
      pinnedAt: new Date(),
      pinnedBy: 'system:promotion',
      reason: 'initial',
    } as any);

    const result = await promoteStudents(
      String(collegeId),
      { semesterId: String(semesterId), programmeId: String(programmeId) },
      'tester',
    );

    expect(result.promoted).toBe(10);
    expect(result.detained).toBe(0);
    expect(result.yearBack).toBe(0);
    expect(result.deferredPins).toEqual([]);
    expect(vi.mocked(feePinService.pinYear)).toHaveBeenCalledTimes(10);

    // Every call targets year-of-study = N+1 = 2 and passes academicYearId.
    for (const call of vi.mocked(feePinService.pinYear).mock.calls) {
      const [sid, y, opts] = call;
      expect(ids.map(String)).toContain(String(sid));
      expect(y).toBe(2);
      expect(opts).toMatchObject({
        pinnedBy: 'system:promotion',
        reason: 'initial',
      });
      expect(String((opts as any).academicYearId)).toBe(String(academicYearId));
    }
  });

  // ── 2. No active Year-2 structure → all 10 deferred, promotion ok ────
  it('records deferredPins for every FeeStructureNotFoundError without failing promotion', async () => {
    await makeSemester();
    const ids = await seedBatch({ collegeId, programmeId, semesterId, studentCount: 10 });

    vi.mocked(feePinService.pinYear).mockImplementation(async () => {
      throw new FeeStructureNotFoundError({
        programmeId: String(programmeId),
        yearOfStudy: 2,
        academicYearId: String(academicYearId),
        quota: 'convener',
        category: 'OC',
      });
    });

    const result = await promoteStudents(
      String(collegeId),
      { semesterId: String(semesterId), programmeId: String(programmeId) },
      'tester',
    );

    expect(result.promoted).toBe(10);
    expect(result.deferredPins).toHaveLength(10);
    for (const d of result.deferredPins) {
      expect(d.targetYear).toBe(2);
      expect(d.reason).toMatch(/No approved fee structure/);
      expect(ids.map(String)).toContain(String(d.studentId));
    }
    // All 10 PromotionDecisions still got written.
    const count = await PromotionDecision.countDocuments({ collegeId });
    expect(count).toBe(10);
  });

  // ── 3. Mixed statuses: 5 promoted + 3 detained + 2 year_back ─────────
  it('only calls pinYear for promoted students; detained and year_back are skipped', async () => {
    await makeSemester();
    await seedBatch({
      collegeId,
      programmeId,
      semesterId,
      studentCount: 10,
      // indices 5,6,7 → detained (1-4 backlogs)
      // indices 8,9 → year_back (>4 backlogs)
      backlogsByIndex: { 5: 2, 6: 3, 7: 4, 8: 5, 9: 6 },
    });

    vi.mocked(feePinService.pinYear).mockResolvedValue({
      _id: oid(),
      yearOfStudy: 2,
      feeStructureInstanceId: oid(),
      pinnedAt: new Date(),
      pinnedBy: 'system:promotion',
      reason: 'initial',
    } as any);

    const result = await promoteStudents(
      String(collegeId),
      { semesterId: String(semesterId), programmeId: String(programmeId) },
      'tester',
    );

    expect(result.promoted).toBe(5);
    expect(result.detained).toBe(3);
    expect(result.yearBack).toBe(2);
    expect(result.deferredPins).toEqual([]);
    expect(vi.mocked(feePinService.pinYear)).toHaveBeenCalledTimes(5);
  });

  // ── 4. Non-FeeStructureNotFoundError rethrows ────────────────────────
  it('rethrows unexpected errors from pinYear (promotion aborts)', async () => {
    await makeSemester();
    await seedBatch({ collegeId, programmeId, semesterId, studentCount: 3 });

    vi.mocked(feePinService.pinYear).mockRejectedValue(new Error('mongo exploded'));

    await expect(
      promoteStudents(
        String(collegeId),
        { semesterId: String(semesterId), programmeId: String(programmeId) },
        'tester',
      ),
    ).rejects.toThrow(/mongo exploded/);
  });

  // ── 5. Idempotent re-run ─────────────────────────────────────────────
  it('re-running promotion does not create a second active pin (idempotent)', async () => {
    await makeSemester();
    const ids = await seedBatch({ collegeId, programmeId, semesterId, studentCount: 3 });

    // Simulate the real pinYear behavior: archive existing active pin for
    // that yearOfStudy, then push a new active pin. This mirrors
    // commitPin() in fee-pin-service.
    vi.mocked(feePinService.pinYear).mockImplementation(async (studentId, year) => {
      const s = await Student.findById(studentId);
      if (!s) throw new Error('student missing');
      for (const p of s.feePins) {
        if (p.yearOfStudy === year && !p.archivedAt) {
          p.archivedAt = new Date();
          p.archiveReason = 'replaced';
        }
      }
      s.feePins.push({
        yearOfStudy: year,
        feeStructureInstanceId: oid(),
        pinnedAt: new Date(),
        pinnedBy: 'system:promotion',
        reason: 'initial',
        archivedAt: null,
      } as any);
      await s.save();
      const pushed = s.feePins[s.feePins.length - 1]!;
      return pushed.toObject() as any;
    });

    await promoteStudents(
      String(collegeId),
      { semesterId: String(semesterId), programmeId: String(programmeId) },
      'tester',
    );
    const firstCallCount = vi.mocked(feePinService.pinYear).mock.calls.length;
    expect(firstCallCount).toBe(3);

    await promoteStudents(
      String(collegeId),
      { semesterId: String(semesterId), programmeId: String(programmeId) },
      'tester',
    );
    // Second promotion re-invokes pinYear for the same students.
    expect(vi.mocked(feePinService.pinYear).mock.calls.length).toBe(6);

    // And after the second run, each student still has exactly ONE active
    // Year-2 pin (the old one was archived by the pinYear mock).
    for (const sid of ids) {
      const s = await Student.findById(sid);
      const active = (s!.feePins as any[]).filter(
        (p) => p.yearOfStudy === 2 && !p.archivedAt,
      );
      expect(active).toHaveLength(1);
    }
  });
});
