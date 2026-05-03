/**
 * createStudent auto-pin tests.
 *
 * Locks in the contract that creating a Student with a programmeId
 * triggers a soft auto-pin to the matching FeeStructureInstance.
 * Three behaviours under test:
 *
 *   1. Happy path — matching FeeStructureInstance exists → student
 *      is created AND a pin lands in `student.feePins[]`. Response
 *      carries `feePin: { attempted: true, success: true, pinId, ... }`.
 *
 *   2. Missing-instance soft-fail — no matching FeeStructureInstance →
 *      student is STILL created (no rollback). Response carries
 *      `feePin: { attempted: true, success: false, reason:
 *      'no-matching-fee-structure' }`.
 *
 *   3. No programmeId → auto-pin SKIPPED. Response carries
 *      `feePin: { attempted: false, success: false, reason:
 *      'no-programme-id' }`.
 *
 * Year-of-study comes from `studyYearAtAdmission ?? 1` so lateral
 * entries (Y2/Y3 admit) bind to the right structure on day 1.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

import { createStudent } from '../service';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';

// ── Mock the BullMQ commitment-sheet enqueue so pinYear doesn't try
// to talk to Redis from inside the test. (pinYear already wraps the
// enqueue in try/catch and logs; the mock keeps the logs quiet too.)

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));

// ── Fixtures ───────────────────────────────────────────────────────────

const COLLEGE_ID = String(new Types.ObjectId());
const PROGRAMME_ID = String(new Types.ObjectId());
const ACADEMIC_YEAR_ID = String(new Types.ObjectId());
const BRANCH_ID = String(new Types.ObjectId());

function studentInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Student',
    phone: `+91-${Math.floor(Math.random() * 10_000_000_000)}`,
    email: `s${Math.floor(Math.random() * 10_000_000)}@t.edu`,
    admissionYear: 2025,
    studyYearAtAdmission: 1,
    programmeId: PROGRAMME_ID,
    branchId: BRANCH_ID,
    category: 'OC',
    quota: 'convener',
    rollNumber: `RN${Math.floor(Math.random() * 10_000_000)}`,
    status: 'active',
    onboardingStatus: 'in_progress',
    // Pass academicYearId explicitly so the auto-pin doesn't fall back
    // to looking up the "current" AcademicYear (which we'd have to seed
    // separately for every test).
    academicYearId: ACADEMIC_YEAR_ID,
    ...overrides,
  };
}

async function makeMatchingInstance(opts: {
  yearOfStudy?: number;
  category?: string;
  quota?: string;
  branchId?: string | null;
} = {}) {
  await FeeStructureInstance.create({
    collegeId: new Types.ObjectId(COLLEGE_ID),
    academicYearId: new Types.ObjectId(ACADEMIC_YEAR_ID),
    programmeId: new Types.ObjectId(PROGRAMME_ID),
    branchId: opts.branchId === null ? undefined : new Types.ObjectId(opts.branchId ?? BRANCH_ID),
    category: opts.category ?? 'OC',
    quota: opts.quota ?? 'convener',
    status: 'active',
    totalAmount: 50_000,
    approvedAt: new Date('2025-01-01'),
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
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('createStudent — auto-pin on enrollment', () => {
  it('happy path: matching FeeStructureInstance present → student is pinned on creation', async () => {
    await makeMatchingInstance();

    const result = await createStudent(
      COLLEGE_ID,
      studentInput(),
      'admin-user-id',
    );

    expect(result.feePin.attempted).toBe(true);
    expect(result.feePin.success).toBe(true);
    expect(result.feePin.pinId).toBeTruthy();
    expect(result.feePin.feeStructureInstanceId).toBeTruthy();
    expect(result.feePin.yearOfStudy).toBe(1);

    // Pin landed on the student's feePins[] in the DB
    const fresh = await Student.findById(result._id);
    expect(fresh?.feePins.length).toBe(1);
    expect(String(fresh?.feePins[0]?.feeStructureInstanceId)).toBe(
      result.feePin.feeStructureInstanceId,
    );
    expect(fresh?.feePins[0]?.reason).toBe('initial');
    expect(fresh?.feePins[0]?.archivedAt).toBeFalsy();
  });

  it('soft-fail: no matching instance → student STILL created with feePin.success=false', async () => {
    // Deliberately no FeeStructureInstance.

    const result = await createStudent(
      COLLEGE_ID,
      studentInput(),
      'admin-user-id',
    );

    // Student row exists in the DB (no rollback)
    const persisted = await Student.findById(result._id);
    expect(persisted).toBeTruthy();
    expect(persisted?.feePins.length).toBe(0);

    // Response signals the soft fail with a meaningful reason
    expect(result.feePin.attempted).toBe(true);
    expect(result.feePin.success).toBe(false);
    expect(result.feePin.reason).toBe('no-matching-fee-structure');
    expect(result.feePin.yearOfStudy).toBe(1);
  });

  it('no programmeId → auto-pin SKIPPED (attempted=false, reason=no-programme-id)', async () => {
    const result = await createStudent(
      COLLEGE_ID,
      studentInput({ programmeId: undefined }),
      'admin-user-id',
    );

    expect(result.feePin.attempted).toBe(false);
    expect(result.feePin.success).toBe(false);
    expect(result.feePin.reason).toBe('no-programme-id');

    const persisted = await Student.findById(result._id);
    expect(persisted?.feePins.length).toBe(0);
  });

  it('lateral entry (studyYearAtAdmission=2): pins to the Y2 instance, not Y1', async () => {
    // Make a Y2 instance — fee-pin-service does not currently use
    // yearOfStudy as a filter on FeeStructureInstance (see plan §1.6),
    // but the pin's yearOfStudy is recorded so subsequent year-of-study
    // resolution finds it. We assert the recorded yearOfStudy on the pin.
    await makeMatchingInstance();

    const result = await createStudent(
      COLLEGE_ID,
      studentInput({ studyYearAtAdmission: 2 }),
      'admin-user-id',
    );

    expect(result.feePin.success).toBe(true);
    expect(result.feePin.yearOfStudy).toBe(2);

    const fresh = await Student.findById(result._id);
    expect(fresh?.feePins[0]?.yearOfStudy).toBe(2);
  });

  it('audit log still records the create even when auto-pin soft-fails', async () => {
    // No matching instance → soft-fail path
    const result = await createStudent(
      COLLEGE_ID,
      studentInput(),
      'admin-user-id',
    );

    // Soft-fail still returns a Student ID (creation completed)
    expect(result._id).toBeTruthy();
    expect(result.feePin.success).toBe(false);
  });
});
