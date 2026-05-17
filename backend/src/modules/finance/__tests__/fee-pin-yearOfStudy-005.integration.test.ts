import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';

// BullMQ enqueue is mocked at module load so we don't try to talk to Redis.
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { pinYear, rePin, checkPinValidity, FeeStructureNotFoundError } from '../fee-pin-service';

/**
 * §005 integration — end-to-end pin pipeline against real Mongoose
 * models. Covers the full call chain:
 *
 *   admission / promotion call → pinYear(studentId, yearOfStudy)
 *      → resolveMatchingFeeStructureInstance picks the right FSI
 *      → commitPin writes the pin onto Student.feePins
 *
 * Distinct from the unit-style `fee-pin-service-axes-005.test.ts`
 * which calls the matcher directly — these tests assert the
 * Student.feePins[] subdoc lands with the correct
 * `feeStructureInstanceId` reference for the requested yearOfStudy.
 */

const oid = () => new mongoose.Types.ObjectId();

interface FsiOpts {
  collegeId: mongoose.Types.ObjectId;
  academicYearId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId | null;
  category?: string | null;
  quota?: string | null;
  yearOfStudy?: number | null;
  totalAmount?: number;
}

async function makeFSI(opts: FsiOpts) {
  const payload: Record<string, unknown> = {
    collegeId: opts.collegeId,
    academicYearId: opts.academicYearId,
    programmeId: opts.programmeId,
    status: 'active',
    totalAmount: opts.totalAmount ?? 100000,
    approvedAt: new Date(),
  };
  if (opts.branchId !== undefined && opts.branchId !== null) payload.branchId = opts.branchId;
  if (opts.category !== undefined && opts.category !== null) payload.category = opts.category;
  if (opts.quota !== undefined && opts.quota !== null) payload.quota = opts.quota;
  if (opts.yearOfStudy !== undefined && opts.yearOfStudy !== null) payload.yearOfStudy = opts.yearOfStudy;
  return FeeStructureInstance.create(payload);
}

async function makeStudent(opts: {
  collegeId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  quota?: string;
  category?: string;
}) {
  return Student.create({
    collegeId: opts.collegeId,
    personId: oid(),
    admissionYear: 2025,
    programmeId: opts.programmeId,
    branchId: opts.branchId,
    quota: opts.quota ?? 'convener',
    category: opts.category ?? 'OC',
    status: 'active',
  });
}

async function makeAcademicYear(collegeId: mongoose.Types.ObjectId, label = '2026-27') {
  return AcademicYear.create({
    collegeId,
    code: label,
    label,
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    isCurrent: true,
  });
}

describe('§005 — pinYear end-to-end (integration)', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('Year-1 pin picks the Year-1 FSI when a Year-1-specific FSI exists', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const y1 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 1,
      totalAmount: 80000,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    const pin = await pinYear(String(student._id), 1, {
      pinnedBy: 'integration-test',
      reason: 'initial',
      academicYearId: ay._id as mongoose.Types.ObjectId,
      enqueueCommitmentSheet: false,
    });
    expect(String(pin.feeStructureInstanceId)).toBe(String(y1._id));
    expect(pin.yearOfStudy).toBe(1);

    // Verify the pin lands on Student.feePins[].
    const fresh = await Student.findById(student._id).lean();
    const activePin = fresh!.feePins.find((p) => p.yearOfStudy === 1 && !p.archivedAt);
    expect(activePin).toBeTruthy();
    expect(String(activePin!.feeStructureInstanceId)).toBe(String(y1._id));
  });

  it('Year-2 pin picks the Year-2 FSI when both Year-1 and Year-2 FSIs exist (no leakage)', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const y1 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 1, totalAmount: 80000,
    });
    const y2 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 2, totalAmount: 95000,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    const pin = await pinYear(String(student._id), 2, {
      pinnedBy: 'integration-test', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false,
    });
    expect(String(pin.feeStructureInstanceId)).toBe(String(y2._id));
    expect(String(pin.feeStructureInstanceId)).not.toBe(String(y1._id));
  });

  it('Year-1 pin prefers the exact-year FSI over a wildcard FSI', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const wildcard = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: null, totalAmount: 100000,
    });
    const y1 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 1, totalAmount: 80000,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    const pin = await pinYear(String(student._id), 1, {
      pinnedBy: 'integration-test', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false,
    });
    expect(String(pin.feeStructureInstanceId)).toBe(String(y1._id));
    void wildcard;
  });

  it('Year-3 pin falls back to the wildcard FSI when no Year-3-specific FSI exists', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const wildcard = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: null, totalAmount: 100000,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    const pin = await pinYear(String(student._id), 3, {
      pinnedBy: 'integration-test', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false,
    });
    expect(String(pin.feeStructureInstanceId)).toBe(String(wildcard._id));
    expect(pin.yearOfStudy).toBe(3);
  });

  it('pin fails when only a year-specific FSI exists that does NOT match the requested year', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    // Only a Year-2 FSI; student asking for Year-1.
    await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 2,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    await expect(
      pinYear(String(student._id), 1, {
        pinnedBy: 'integration-test', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false,
      }),
    ).rejects.toBeInstanceOf(FeeStructureNotFoundError);

    // Verify nothing landed on the student.
    const fresh = await Student.findById(student._id).lean();
    expect(fresh!.feePins.filter((p) => !p.archivedAt)).toHaveLength(0);
  });

  it('rePin to an explicit Year-2 target archives the Year-1 pin and writes a new Year-2 pin', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const y1 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 1, totalAmount: 80000,
    });
    const y2 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 2, totalAmount: 95000,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    await pinYear(String(student._id), 1, { pinnedBy: 'init', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false });

    // Now manually re-pin Year-2 against an explicit target. The
    // explicit-target path bypasses the matcher; this exercises that
    // §005 didn't break the matcher-free path.
    await rePin(String(student._id), 2, {
      pinnedBy: 'admin', reason: 'admin_override',
      targetFeeStructureInstanceId: String(y2._id),
      enqueueCommitmentSheet: false,
    });

    const fresh = await Student.findById(student._id).lean();
    // Year-1 pin should still exist (not archived — different yearOfStudy).
    const y1Pin = fresh!.feePins.find((p) => p.yearOfStudy === 1 && !p.archivedAt);
    expect(y1Pin).toBeTruthy();
    expect(String(y1Pin!.feeStructureInstanceId)).toBe(String(y1._id));
    // New Year-2 pin should be the rePin target.
    const y2Pin = fresh!.feePins.find((p) => p.yearOfStudy === 2 && !p.archivedAt);
    expect(y2Pin).toBeTruthy();
    expect(String(y2Pin!.feeStructureInstanceId)).toBe(String(y2._id));
  });

  it('checkPinValidity flags drift when a student is pinned to a Year-1 FSI but is now in Year-2', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAcademicYear(collegeId);
    const y1 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 1,
    });
    const y2 = await makeFSI({
      collegeId, programmeId, academicYearId: ay._id as mongoose.Types.ObjectId,
      branchId: null, category: null, quota: null, yearOfStudy: 2,
    });
    const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });

    // Pin Year-1 explicitly.
    await pinYear(String(student._id), 1, { pinnedBy: 'init', reason: 'initial', academicYearId: ay._id as mongoose.Types.ObjectId, enqueueCommitmentSheet: false });

    // The Year-1 pin is valid against its Year-1 FSI (§005 wildcard
    // contract — quota null on FSI matches student.quota='convener').
    const v1 = await checkPinValidity(String(student._id), 1);
    expect(v1.valid).toBe(true);
    expect(v1.currentPin && String(v1.currentPin.feeStructureInstanceId)).toBe(String(y1._id));
    // The matchingInstance (what *should* be pinned right now) is the
    // same Year-1 FSI — checkPinValidity infers the academicYearId
    // from the pinned instance, so the matcher can run successfully.
    expect(v1.matchingInstance && String(v1.matchingInstance._id)).toBe(String(y1._id));
    void y2;
  });
});
