import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';

// Registration-only: a matched result is re-fetched with
// .populate('branchId').populate('programmeId'), which throws
// MissingSchemaError unless both models are registered on the connection.
import '../../../models/academic-structure/Programme';
import '../../../models/academic-structure/Branch';

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { previewMatchingFeeStructureInstance } from '../fee-pin-service';

/**
 * Contract tests for `previewMatchingFeeStructureInstance` — the shared
 * dry-run matcher (006-import-fee-pin T1).
 *
 * It already backs the student edit form's "matching fee structure" strip
 * (fee-pin-controller.ts:236). The student bulk import's preview hook is
 * about to become its second caller, so the branches below are the ones
 * both surfaces depend on agreeing about. Untested until now.
 *
 * Covers plan §4.1 and edge cases E1 (no match), E2/E23 (zero / ambiguous
 * isCurrent AY) and E16 (explicit academicYearId overrides isCurrent).
 */

const oid = () => new mongoose.Types.ObjectId();

async function makeAy(opts: {
  collegeId: mongoose.Types.ObjectId;
  code: string;
  isCurrent?: boolean;
}) {
  return AcademicYear.create({
    collegeId: opts.collegeId,
    code: opts.code,
    label: opts.code,
    startDate: new Date('2025-07-01'),
    endDate: new Date('2026-06-30'),
    isCurrent: opts.isCurrent ?? false,
  });
}

async function makeFsi(opts: {
  collegeId: mongoose.Types.ObjectId;
  academicYearId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  quota?: string;
  category?: string;
  totalAmount?: number;
  status?: string;
}) {
  const payload: Record<string, unknown> = {
    collegeId: opts.collegeId,
    academicYearId: opts.academicYearId,
    programmeId: opts.programmeId,
    status: opts.status ?? 'active',
    totalAmount: opts.totalAmount ?? 100000,
    approvedAt: new Date(),
  };
  if (opts.branchId) payload.branchId = opts.branchId;
  if (opts.quota) payload.quota = opts.quota;
  if (opts.category) payload.category = opts.category;
  return FeeStructureInstance.create(payload);
}

describe('previewMatchingFeeStructureInstance', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('matches on an explicit academicYearId and reports the amount', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26' });
    const fsi = await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
      quota: 'management',
      totalAmount: 315000,
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      quota: 'management',
      yearOfStudy: 1,
      academicYearId: String(ay._id),
    });

    expect(res.matched).toBe(true);
    expect(String(res.fsi?._id)).toBe(String(fsi._id));
    expect(res.fsi?.totalAmount).toBe(315000);
    expect(res.academicYearId).toBe(String(ay._id));
    expect(res.reason).toBeUndefined();
  });

  it('falls back to the college\'s isCurrent academic year when none is passed', async () => {
    const collegeId = oid();
    const programmeId = oid();
    await makeAy({ collegeId, code: 'AY2024-25' });
    const current = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    const fsi = await makeFsi({
      collegeId,
      academicYearId: current._id as mongoose.Types.ObjectId,
      programmeId,
      quota: 'convener',
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      quota: 'convener',
      yearOfStudy: 1,
    });

    expect(res.matched).toBe(true);
    expect(String(res.fsi?._id)).toBe(String(fsi._id));
    expect(res.academicYearId).toBe(String(current._id));
  });

  // E16 — importing next year's intake in advance must not silently bind
  // the cohort to whichever year happens to be flagged current today.
  it('honours an explicit academicYearId over the isCurrent one', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const current = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    const next = await makeAy({ collegeId, code: 'AY2026-27' });
    await makeFsi({
      collegeId,
      academicYearId: current._id as mongoose.Types.ObjectId,
      programmeId,
      totalAmount: 100000,
    });
    const nextFsi = await makeFsi({
      collegeId,
      academicYearId: next._id as mongoose.Types.ObjectId,
      programmeId,
      totalAmount: 200000,
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      yearOfStudy: 1,
      academicYearId: String(next._id),
    });

    expect(String(res.fsi?._id)).toBe(String(nextFsi._id));
    expect(res.fsi?.totalAmount).toBe(200000);
  });

  // E2 / E23 — a college with no isCurrent AY must be reported as such, not
  // as "no fee structure". The two are different problems with different owners.
  it('returns reason no-academic-year when no AY is current and none is passed', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26' });
    await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      yearOfStudy: 1,
    });

    expect(res.matched).toBe(false);
    expect(res.reason).toBe('no-academic-year');
    expect(res.fsi).toBeNull();
    expect(res.academicYearId).toBeNull();
  });

  // E1 — the import's soft-fail branch. Distinguished from no-academic-year
  // so the operator is told which of the two to go fix.
  it('returns reason no-matching-fee-structure when the axes resolve nothing', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
      quota: 'convener',
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      quota: 'management',
      yearOfStudy: 1,
    });

    expect(res.matched).toBe(false);
    expect(res.reason).toBe('no-matching-fee-structure');
    expect(res.academicYearId).toBe(String(ay._id));
  });

  it('never matches a fee structure belonging to another college', async () => {
    const collegeId = oid();
    const otherCollegeId = oid();
    const programmeId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    await makeFsi({
      collegeId: otherCollegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      yearOfStudy: 1,
    });

    expect(res.matched).toBe(false);
    expect(res.reason).toBe('no-matching-fee-structure');
  });

  it('prefers the branch-exact structure over the branch-wildcard one', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
      quota: 'management',
      totalAmount: 125000,
    });
    const branchExact = await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
      branchId,
      quota: 'management',
      totalAmount: 315000,
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      branchId,
      quota: 'management',
      yearOfStudy: 1,
    });

    expect(String(res.fsi?._id)).toBe(String(branchExact._id));
    expect(res.fsi?.totalAmount).toBe(315000);
  });

  it('ignores a non-active fee structure', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const ay = await makeAy({ collegeId, code: 'AY2025-26', isCurrent: true });
    await makeFsi({
      collegeId,
      academicYearId: ay._id as mongoose.Types.ObjectId,
      programmeId,
      status: 'draft',
    });

    const res = await previewMatchingFeeStructureInstance({
      collegeId,
      programmeId,
      yearOfStudy: 1,
    });

    expect(res.matched).toBe(false);
    expect(res.reason).toBe('no-matching-fee-structure');
  });
});
