import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { resolveMatchingFeeStructureInstance } from '../fee-pin-service';

/**
 * §005 fee-mapping clarity — fee-pin-service axis tests.
 *
 *   - quota: now scored alongside branch + category. Wildcard FSI
 *     (quota=null) is acceptable; mismatch is rejected. Pre-§005 the
 *     base filter excluded null-quota wildcards when the student had a
 *     quota set, and admitted any quota when the student had none.
 *   - yearOfStudy: now a real column on FSI. Wildcard (null) keeps
 *     legacy FSIs working; specific value gates the match by year.
 *   - specificity ordering: branch > category > quota > yearOfStudy.
 *     Higher-tier exact always beats any combination of lower-tier
 *     exacts (powers-of-ten weight).
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
  status?: string;
  approvedAt?: Date;
  totalAmount?: number;
}

async function makeFSI(opts: FsiOpts) {
  const payload: Record<string, unknown> = {
    collegeId: opts.collegeId,
    academicYearId: opts.academicYearId,
    programmeId: opts.programmeId,
    status: opts.status ?? 'active',
    totalAmount: opts.totalAmount ?? 100000,
    approvedAt: opts.approvedAt ?? new Date(),
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
  quota?: string | null;
  category?: string;
}) {
  return Student.create({
    collegeId: opts.collegeId,
    personId: oid(),
    admissionYear: 2025,
    programmeId: opts.programmeId,
    branchId: opts.branchId,
    quota: opts.quota === null ? undefined : (opts.quota ?? 'convener'),
    category: opts.category ?? 'OC',
    status: 'active',
  });
}

describe('§005 — fee-pin-service axis scoring', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  describe('quota axis (pre-§005 gap)', () => {
    it('null-quota wildcard FSI matches a student WITH a quota set (pre-§005: this was excluded by the base filter)', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      // Only candidate: a wildcard-quota FSI.
      const wildcard = await makeFSI({
        collegeId, programmeId, academicYearId,
        quota: null, branchId: null, category: null,
      });
      const student = await makeStudent({ collegeId, programmeId, quota: 'management' });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(match).toBeTruthy();
      expect(String(match!._id)).toBe(String(wildcard._id));
    });

    it('exact-quota FSI beats wildcard-quota FSI when both branch/category match', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const wildcard = await makeFSI({ collegeId, programmeId, academicYearId, quota: null, branchId: null, category: null });
      const exact = await makeFSI({ collegeId, programmeId, academicYearId, quota: 'management', branchId: null, category: null });
      const student = await makeStudent({ collegeId, programmeId, quota: 'management' });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(match).toBeTruthy();
      expect(String(match!._id)).toBe(String(exact._id));
      void wildcard;
    });

    it('mismatched-quota FSI is rejected (pre-§005 gap: scoring never checked quota)', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      // Only candidate has the WRONG quota. Pre-§005 bug: student.quota='convener'
      // base filter excluded this FSI. But when student.quota was unset,
      // the loop scored without quota check and could return any quota.
      // The mismatch case is what we now reject in the scorer.
      await makeFSI({ collegeId, programmeId, academicYearId, quota: 'management', branchId: null, category: null });
      const student = await makeStudent({ collegeId, programmeId, quota: 'convener' });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(match).toBeNull();
    });

    it('student with no quota is rejected against an exact-quota FSI', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      await makeFSI({ collegeId, programmeId, academicYearId, quota: 'management', branchId: null, category: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      // Pre-§005 this matched (no quota check in scoring → wildcard treatment).
      // Post-§005: rejected — FSI demands quota='management', student has none.
      expect(match).toBeNull();
    });

    it('student with no quota matches a null-quota wildcard FSI', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const wildcard = await makeFSI({ collegeId, programmeId, academicYearId, quota: null, branchId: null, category: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(match).toBeTruthy();
      expect(String(match!._id)).toBe(String(wildcard._id));
    });
  });

  describe('yearOfStudy axis (new field)', () => {
    it('legacy FSI without yearOfStudy column matches any pin year (wildcard)', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const legacy = await makeFSI({ collegeId, programmeId, academicYearId, yearOfStudy: null, branchId: null, category: null, quota: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      for (const yos of [1, 2, 3, 4]) {
        const match = await resolveMatchingFeeStructureInstance(student, yos, { academicYearId: String(academicYearId) });
        expect(match).toBeTruthy();
        expect(String(match!._id)).toBe(String(legacy._id));
      }
    });

    it('FSI with yearOfStudy=2 matches Year-2 pin', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const y2 = await makeFSI({ collegeId, programmeId, academicYearId, yearOfStudy: 2, branchId: null, category: null, quota: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      const match = await resolveMatchingFeeStructureInstance(student, 2, { academicYearId: String(academicYearId) });
      expect(match).toBeTruthy();
      expect(String(match!._id)).toBe(String(y2._id));
    });

    it('FSI with yearOfStudy=2 does NOT match Year-1 pin (mismatch rejected)', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      await makeFSI({ collegeId, programmeId, academicYearId, yearOfStudy: 2, branchId: null, category: null, quota: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(match).toBeNull();
    });

    it('exact-year FSI beats wildcard-year FSI for the same pin year', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const wildcard = await makeFSI({ collegeId, programmeId, academicYearId, yearOfStudy: null, branchId: null, category: null, quota: null });
      const exact = await makeFSI({ collegeId, programmeId, academicYearId, yearOfStudy: 2, branchId: null, category: null, quota: null });
      const student = await makeStudent({ collegeId, programmeId, quota: null });
      const match = await resolveMatchingFeeStructureInstance(student, 2, { academicYearId: String(academicYearId) });
      expect(String(match!._id)).toBe(String(exact._id));
      void wildcard;
    });
  });

  describe('specificity ordering across all 4 axes', () => {
    it('branch-exact beats category-exact+quota-exact+year-exact when others are wildcard', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const branchId = oid();
      // FSI A: branch-EXACT, everything else wildcard.
      const branchExact = await makeFSI({
        collegeId, programmeId, academicYearId,
        branchId, category: null, quota: null, yearOfStudy: null,
      });
      // FSI B: branch-wildcard, but category+quota+year all exact.
      const triExact = await makeFSI({
        collegeId, programmeId, academicYearId,
        branchId: null, category: 'OC', quota: 'convener', yearOfStudy: 2,
      });
      const student = await makeStudent({
        collegeId, programmeId, branchId, quota: 'convener', category: 'OC',
      });
      const match = await resolveMatchingFeeStructureInstance(student, 2, { academicYearId: String(academicYearId) });
      expect(String(match!._id)).toBe(String(branchExact._id));
      void triExact;
    });

    it('all-exact FSI beats all-wildcard FSI', async () => {
      const collegeId = oid();
      const programmeId = oid();
      const academicYearId = oid();
      const branchId = oid();
      const wildcard = await makeFSI({ collegeId, programmeId, academicYearId, branchId: null, category: null, quota: null, yearOfStudy: null });
      const allExact = await makeFSI({
        collegeId, programmeId, academicYearId,
        branchId, category: 'OC', quota: 'convener', yearOfStudy: 1,
      });
      const student = await makeStudent({ collegeId, programmeId, branchId, quota: 'convener', category: 'OC' });
      const match = await resolveMatchingFeeStructureInstance(student, 1, { academicYearId: String(academicYearId) });
      expect(String(match!._id)).toBe(String(allExact._id));
      void wildcard;
    });
  });
});
