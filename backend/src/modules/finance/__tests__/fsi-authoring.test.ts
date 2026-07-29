/**
 * FSI authoring backend tests (Fix 1).
 *
 * Covers the three new/changed surfaces:
 *  - B1: `yearOfStudy` is now accepted by the create schema (previously
 *    stripped by Zod, making per-year fees unreachable via the API).
 *  - B2: PATCH edit of a draft/revision_required FSI — axes/year/total,
 *    the draft-only lock, revision_required → draft on edit, and
 *    component-driven totalAmount recompute.
 *  - B3: draft-only hard delete with component/rule cascade.
 *
 * Deliberately does NOT assert any "one active per slot" uniqueness —
 * the matcher tolerates same-slot actives (see fee-pin-service.test.ts
 * "Preference tie-break by most recent approvedAt").
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { FeeComponent } from '../../../models/finance/FeeComponent';
import { FeeComponentRule } from '../../../models/finance/FeeComponentRule';
import {
  createFeeStructureInstanceSchema,
  updateFeeStructureInstanceSchema,
} from '../validation';
import {
  createFeeStructureInstance,
  updateFeeStructureInstance,
  deleteFeeStructureInstance,
  approveFeeStructure,
} from '../service';

const COLLEGE_ID = new Types.ObjectId();
const OTHER_COLLEGE = new Types.ObjectId();
const AY_ID = new Types.ObjectId();
const PROG_ID = new Types.ObjectId();
const BRANCH_ID = new Types.ObjectId();

type FsiOverrides = Partial<{
  academicYearId: Types.ObjectId;
  programmeId: Types.ObjectId;
  branchId: Types.ObjectId;
  category: string;
  quota: string;
  yearOfStudy: number;
  status: string;
  totalAmount: number;
  rejectionComments: string;
  collegeId: Types.ObjectId;
}>;

async function makeFsi(overrides: FsiOverrides = {}) {
  return FeeStructureInstance.create({
    collegeId: COLLEGE_ID,
    academicYearId: AY_ID,
    programmeId: PROG_ID,
    branchId: BRANCH_ID,
    category: 'OC',
    quota: 'convener',
    yearOfStudy: 1,
    status: 'draft',
    totalAmount: 0,
    ...overrides,
  });
}

async function addComponent(fsiId: Types.ObjectId | string, name: string, amount: number) {
  return FeeComponent.create({
    collegeId: COLLEGE_ID,
    feeStructureInstanceId: fsiId,
    name,
    amount,
    componentType: 'tuition',
  });
}

beforeAll(async () => {
  await setupMongo();
}, 60_000);

afterAll(async () => {
  await teardownMongo();
}, 30_000);

afterEach(async () => {
  await clearCollections();
});

// ── B1: create schema accepts yearOfStudy ────────────────────────────

describe('createFeeStructureInstanceSchema — yearOfStudy (B1)', () => {
  it('parses and preserves yearOfStudy', () => {
    const parsed = createFeeStructureInstanceSchema.parse({
      academicYearId: String(AY_ID),
      programmeId: String(PROG_ID),
      yearOfStudy: 3,
    });
    expect(parsed.yearOfStudy).toBe(3);
  });

  it('rejects out-of-range yearOfStudy', () => {
    expect(() =>
      createFeeStructureInstanceSchema.parse({
        academicYearId: String(AY_ID),
        programmeId: String(PROG_ID),
        yearOfStudy: 9,
      }),
    ).toThrow();
  });

  it('service persists yearOfStudy end-to-end', async () => {
    const doc = await createFeeStructureInstance(
      String(COLLEGE_ID),
      { academicYearId: AY_ID, programmeId: PROG_ID, yearOfStudy: 2, totalAmount: 0 },
      'tester',
    );
    expect(doc.yearOfStudy).toBe(2);
  });
});

// ── B2: PATCH update ─────────────────────────────────────────────────

describe('updateFeeStructureInstance (B2)', () => {
  it('edits axes + yearOfStudy on a draft', async () => {
    const fsi = await makeFsi();
    const updated = await updateFeeStructureInstance(
      String(COLLEGE_ID),
      String(fsi._id),
      { category: 'SC', yearOfStudy: 2 },
      'tester',
    );
    expect(updated?.category).toBe('SC');
    expect(updated?.yearOfStudy).toBe(2);
  });

  it('clears a wildcardable axis when passed null', async () => {
    const fsi = await makeFsi({ branchId: BRANCH_ID });
    const updated = await updateFeeStructureInstance(
      String(COLLEGE_ID),
      String(fsi._id),
      { branchId: null },
      'tester',
    );
    expect(updated?.branchId ?? null).toBeNull();
  });

  it('rejects editing an active FSI (locked)', async () => {
    const fsi = await makeFsi({ status: 'active' });
    await expect(
      updateFeeStructureInstance(String(COLLEGE_ID), String(fsi._id), { category: 'SC' }, 'tester'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects editing an approved FSI (locked)', async () => {
    const fsi = await makeFsi({ status: 'approved' });
    await expect(
      updateFeeStructureInstance(String(COLLEGE_ID), String(fsi._id), { category: 'SC' }, 'tester'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('moves a revision_required FSI back to draft on edit and clears rejection comments', async () => {
    const fsi = await makeFsi({ status: 'revision_required', rejectionComments: 'fix the tuition' });
    const updated = await updateFeeStructureInstance(
      String(COLLEGE_ID),
      String(fsi._id),
      { category: 'SC' },
      'tester',
    );
    expect(updated?.status).toBe('draft');
    expect(updated?.rejectionComments ?? null).toBeNull();
  });

  it('recomputes totalAmount from components, ignoring the client value', async () => {
    const fsi = await makeFsi({ totalAmount: 0 });
    await addComponent(fsi._id, 'Tuition', 5000);
    await addComponent(fsi._id, 'Lab', 3000);
    const updated = await updateFeeStructureInstance(
      String(COLLEGE_ID),
      String(fsi._id),
      { totalAmount: 999999 },
      'tester',
    );
    expect(updated?.totalAmount).toBe(8000);
  });

  it('honours a client totalAmount when the FSI has no components', async () => {
    const fsi = await makeFsi({ totalAmount: 0 });
    const updated = await updateFeeStructureInstance(
      String(COLLEGE_ID),
      String(fsi._id),
      { totalAmount: 50000 },
      'tester',
    );
    expect(updated?.totalAmount).toBe(50000);
  });

  it('is tenant-scoped — cannot edit another college\'s FSI', async () => {
    const fsi = await makeFsi();
    await expect(
      updateFeeStructureInstance(String(OTHER_COLLEGE), String(fsi._id), { category: 'SC' }, 'tester'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('parses null wildcard axes in the update schema', () => {
    const parsed = updateFeeStructureInstanceSchema.parse({ branchId: null, quota: null });
    expect(parsed.branchId).toBeNull();
    expect(parsed.quota).toBeNull();
  });
});

// ── Approve with a non-ObjectId approver name (UI 500 regression) ─────

describe('approveFeeStructure — approver name is not an ObjectId', () => {
  it('approves a submitted FSI when who is a display name (no CastError)', async () => {
    const fsi = await makeFsi({ status: 'submitted' });
    const approved = await approveFeeStructure(String(COLLEGE_ID), String(fsi._id), 'System');
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeTruthy();
    // Name is not stored in the ObjectId ref field.
    expect(approved.approvedBy ?? null).toBeNull();
  });

  it('records approvedBy when who IS a valid ObjectId', async () => {
    const fsi = await makeFsi({ status: 'submitted' });
    const approverId = new Types.ObjectId();
    const approved = await approveFeeStructure(String(COLLEGE_ID), String(fsi._id), String(approverId));
    expect(String(approved.approvedBy)).toBe(String(approverId));
  });
});

// ── B3: draft-only delete + cascade ──────────────────────────────────

describe('deleteFeeStructureInstance (B3)', () => {
  it('deletes a draft and cascades its components and rules', async () => {
    const fsi = await makeFsi();
    const comp = await addComponent(fsi._id, 'Tuition', 5000);
    await FeeComponentRule.create({
      collegeId: COLLEGE_ID,
      feeComponentId: comp._id,
      conditionType: 'category',
      conditionValue: 'OC',
      operator: 'equals',
      status: 'configured',
    });

    await deleteFeeStructureInstance(String(COLLEGE_ID), String(fsi._id), 'tester');

    expect(await FeeStructureInstance.findById(fsi._id)).toBeNull();
    expect(await FeeComponent.countDocuments({ feeStructureInstanceId: fsi._id })).toBe(0);
    expect(await FeeComponentRule.countDocuments({ feeComponentId: comp._id })).toBe(0);
  });

  it('rejects deleting a non-draft FSI', async () => {
    const fsi = await makeFsi({ status: 'active' });
    await expect(
      deleteFeeStructureInstance(String(COLLEGE_ID), String(fsi._id), 'tester'),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await FeeStructureInstance.findById(fsi._id)).not.toBeNull();
  });

  it('is tenant-scoped — cannot delete another college\'s FSI', async () => {
    const fsi = await makeFsi();
    await expect(
      deleteFeeStructureInstance(String(OTHER_COLLEGE), String(fsi._id), 'tester'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
