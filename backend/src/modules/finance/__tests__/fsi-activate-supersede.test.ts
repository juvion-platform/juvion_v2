/**
 * FeeStructureInstance activation / supersede-scope tests.
 *
 * Locks in the Issue-2 fix: activating an FSI must supersede ONLY the
 * active FSI occupying the exact same axis slot —
 *   (academicYearId, programmeId, branchId, category, quota, yearOfStudy)
 * — never a different year-of-study or academic year for the same
 * programme/branch/quota/category.
 *
 * The pre-fix filter omitted academicYearId + yearOfStudy, so activating
 * a Year-2/2026 structure silently superseded the still-needed
 * Year-1/2025 one and unpinned that cohort.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { activateFeeStructure } from '../service';

// ── Fixtures ───────────────────────────────────────────────────────────

const COLLEGE_ID = new Types.ObjectId();
const AY_2025 = new Types.ObjectId();
const AY_2026 = new Types.ObjectId();
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
}>;

async function makeApproved(overrides: FsiOverrides = {}) {
  return FeeStructureInstance.create({
    collegeId: COLLEGE_ID,
    academicYearId: AY_2025,
    programmeId: PROG_ID,
    branchId: BRANCH_ID,
    category: 'OC',
    quota: 'convener',
    yearOfStudy: 1,
    status: 'approved',
    totalAmount: 50_000,
    ...overrides,
  });
}

async function statusOf(id: Types.ObjectId | string): Promise<string | undefined> {
  const doc = await FeeStructureInstance.findById(id);
  return doc?.status;
}

const activate = (id: Types.ObjectId | string) =>
  activateFeeStructure(String(COLLEGE_ID), String(id), 'tester');

beforeAll(async () => {
  await setupMongo();
}, 60_000);

afterAll(async () => {
  await teardownMongo();
}, 30_000);

afterEach(async () => {
  await clearCollections();
});

// ── Supersede scope ─────────────────────────────────────────────────────

describe('activateFeeStructure — supersede scope', () => {
  it('activating a structure for a DIFFERENT year-of-study leaves the other year active (the bug)', async () => {
    const year1 = await makeApproved({ yearOfStudy: 1 });
    const year2 = await makeApproved({ yearOfStudy: 2, status: 'approved' });

    await activate(year1._id);
    await activate(year2._id);

    expect(await statusOf(year1._id)).toBe('active');
    expect(await statusOf(year2._id)).toBe('active');
  });

  it('activating a structure for a DIFFERENT academic year leaves the other year active', async () => {
    const y2025 = await makeApproved({ academicYearId: AY_2025 });
    const y2026 = await makeApproved({ academicYearId: AY_2026 });

    await activate(y2025._id);
    await activate(y2026._id);

    expect(await statusOf(y2025._id)).toBe('active');
    expect(await statusOf(y2026._id)).toBe('active');
  });

  it('activating a structure for the SAME slot supersedes the previous active one', async () => {
    const first = await makeApproved();
    const second = await makeApproved();

    await activate(first._id);
    await activate(second._id);

    expect(await statusOf(first._id)).toBe('superseded');
    expect(await statusOf(second._id)).toBe('active');

    const activeCount = await FeeStructureInstance.countDocuments({
      collegeId: COLLEGE_ID,
      status: 'active',
    });
    expect(activeCount).toBe(1);
  });

  it('treats a wildcard-branch (branchId absent) as the same slot when superseding', async () => {
    const first = await makeApproved({ branchId: undefined });
    const second = await makeApproved({ branchId: undefined });

    await activate(first._id);
    await activate(second._id);

    expect(await statusOf(first._id)).toBe('superseded');
    expect(await statusOf(second._id)).toBe('active');
  });

  it('a branch-specific and a branch-wildcard structure are DIFFERENT slots and coexist (fallback design intact)', async () => {
    const specific = await makeApproved({ branchId: BRANCH_ID });
    const wildcard = await makeApproved({ branchId: undefined });

    await activate(specific._id);
    await activate(wildcard._id);

    expect(await statusOf(specific._id)).toBe('active');
    expect(await statusOf(wildcard._id)).toBe('active');
  });
});

// NOTE: we intentionally do NOT assert a DB-level "one active per slot"
// uniqueness. The matcher tolerates multiple same-slot actives and picks
// the most-recently-approved (see fee-pin-service.test.ts "Preference
// tie-break by most recent approvedAt"). This suite only locks the
// supersede SCOPE — which prior actives an activation retires.
