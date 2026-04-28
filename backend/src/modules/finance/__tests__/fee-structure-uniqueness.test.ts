/**
 * FeeStructure combination-uniqueness tests.
 *
 * Locks in the contract that a college may have AT MOST ONE FeeStructure
 * per (academicYearId, programmeId, branchId, category, quota, year)
 * tuple. Enforced by a unique compound index
 * (`feestructure_combination_unique`); the service layer translates the
 * Mongo E11000 into a clean AppError(409, ...) with a copy-paste-able
 * fix hint.
 *
 * Companion to FeeStructuresPage.copy.test.tsx — the Copy flow prefills
 * the modal with the source's combination, so the user is EXPECTED to
 * change at least one combination field before saving. Submitting an
 * unchanged clone now yields a clear 409.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { FeeStructure } from '../../../models/finance/FeeStructure';
import { AppError } from '../../../middleware/errorHandler';

import {
  createFeeStructure,
  updateFeeStructure,
} from '../service';

// ── Fixtures ───────────────────────────────────────────────────────────

const COLLEGE_ID = String(new Types.ObjectId());
const AY_ID = String(new Types.ObjectId());
const PROG_ID = String(new Types.ObjectId());
const BRANCH_ID = String(new Types.ObjectId());

function baseInput(overrides: Partial<{
  academicYearId: string;
  programmeId: string;
  branchId?: string;
  category?: string;
  quota: string;
  year: number;
  totalAmount: number;
}> = {}) {
  return {
    academicYearId: AY_ID,
    programmeId: PROG_ID,
    branchId: BRANCH_ID,
    category: 'OC',
    quota: 'convener',
    year: 1,
    totalAmount: 50000,
    components: [{ name: 'Tuition', amount: 50000, isRefundable: false }],
    status: 'draft',
    ...overrides,
  };
}

beforeAll(async () => {
  await setupMongo();
  // Force the unique index to materialise — otherwise the first-test
  // collisions go undetected since `Model.create` doesn't auto-build
  // indexes inside the in-memory replica.
  await FeeStructure.syncIndexes();
}, 60_000);

afterAll(async () => {
  await teardownMongo();
}, 30_000);

afterEach(async () => {
  await clearCollections();
});

// ── Create ────────────────────────────────────────────────────────────

describe('createFeeStructure — uniqueness', () => {
  it('first create with a combination succeeds', async () => {
    const doc = await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');
    expect(String(doc._id)).toBeTruthy();
    expect(doc.year).toBe(1);
  });

  it('second create with the IDENTICAL combination is rejected with AppError(409)', async () => {
    await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');

    await expect(
      createFeeStructure(COLLEGE_ID, baseInput(), 'tester'),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /already exists/i,
      name: 'AppError',
    });

    // Only one row landed in the DB
    const count = await FeeStructure.countDocuments({ collegeId: COLLEGE_ID });
    expect(count).toBe(1);
  });

  it('a different YEAR alone makes the combination distinct → both succeed', async () => {
    await createFeeStructure(COLLEGE_ID, baseInput({ year: 1 }), 'tester');
    const second = await createFeeStructure(
      COLLEGE_ID,
      baseInput({ year: 2 }),
      'tester',
    );
    expect(second.year).toBe(2);

    const count = await FeeStructure.countDocuments({ collegeId: COLLEGE_ID });
    expect(count).toBe(2);
  });

  it('a different CATEGORY alone makes the combination distinct → both succeed', async () => {
    await createFeeStructure(COLLEGE_ID, baseInput({ category: 'OC' }), 'tester');
    await createFeeStructure(COLLEGE_ID, baseInput({ category: 'SC' }), 'tester');

    const count = await FeeStructure.countDocuments({ collegeId: COLLEGE_ID });
    expect(count).toBe(2);
  });

  it('null-branchId vs set-branchId are treated as distinct combinations', async () => {
    await createFeeStructure(
      COLLEGE_ID,
      baseInput({ branchId: BRANCH_ID }),
      'tester',
    );
    // Branch omitted → schema-level absence → Mongo unique key sees null
    const without = baseInput();
    delete (without as Partial<typeof without>).branchId;
    await createFeeStructure(COLLEGE_ID, without, 'tester');

    const count = await FeeStructure.countDocuments({ collegeId: COLLEGE_ID });
    expect(count).toBe(2);
  });

  it('two BOTH-null-branchId structures with otherwise identical combo collide', async () => {
    const without1 = baseInput();
    delete (without1 as Partial<typeof without1>).branchId;
    await createFeeStructure(COLLEGE_ID, without1, 'tester');

    const without2 = baseInput();
    delete (without2 as Partial<typeof without2>).branchId;
    await expect(
      createFeeStructure(COLLEGE_ID, without2, 'tester'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('two colleges may independently hold the same combination', async () => {
    const collegeA = String(new Types.ObjectId());
    const collegeB = String(new Types.ObjectId());

    const a = await createFeeStructure(collegeA, baseInput(), 'tester');
    const b = await createFeeStructure(collegeB, baseInput(), 'tester');

    expect(String(a._id)).not.toBe(String(b._id));
  });

  it('the AppError carries a usable message naming the combination fields', async () => {
    await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');

    let caught: AppError | null = null;
    try {
      await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');
    } catch (e) {
      caught = e as AppError;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught?.message).toMatch(/Academic Year/i);
    expect(caught?.message).toMatch(/Programme/i);
    expect(caught?.message).toMatch(/Year/i);
  });
});

// ── Update ────────────────────────────────────────────────────────────

describe('updateFeeStructure — uniqueness', () => {
  it('updating a non-combination field (totalAmount) on an existing row succeeds', async () => {
    const created = await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');

    const updated = await updateFeeStructure(
      COLLEGE_ID,
      String(created._id),
      { totalAmount: 99_000 },
      'tester',
    );

    expect(updated.totalAmount).toBe(99_000);
  });

  it('updating WITH the same combination as itself (no real change) is fine', async () => {
    const created = await createFeeStructure(COLLEGE_ID, baseInput(), 'tester');

    const updated = await updateFeeStructure(
      COLLEGE_ID,
      String(created._id),
      baseInput(), // re-submit the same combination
      'tester',
    );

    expect(String(updated._id)).toBe(String(created._id));
  });

  it('updating to a combination that COLLIDES with another row is rejected', async () => {
    // Two distinct rows, distinct only by year
    const yearOne = await createFeeStructure(COLLEGE_ID, baseInput({ year: 1 }), 'tester');
    await createFeeStructure(COLLEGE_ID, baseInput({ year: 2 }), 'tester');

    // Try to bump year-1 → year=2 → collides with the other row
    await expect(
      updateFeeStructure(
        COLLEGE_ID,
        String(yearOne._id),
        { year: 2 },
        'tester',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /already exists/i,
    });

    // Both rows still exist + neither was clobbered
    const yearOneFresh = await FeeStructure.findById(yearOne._id);
    expect(yearOneFresh?.year).toBe(1);
  });

  it('moving a row to a free combination succeeds', async () => {
    const created = await createFeeStructure(COLLEGE_ID, baseInput({ year: 1 }), 'tester');

    const updated = await updateFeeStructure(
      COLLEGE_ID,
      String(created._id),
      { year: 3 }, // free
      'tester',
    );

    expect(updated.year).toBe(3);
  });
});
