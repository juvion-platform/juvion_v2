import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
// Import models that updateStudent → getStudent populates, to register their schemas.
import '../../../models/academic-structure/Programme';
import '../../../models/academic-structure/Branch';
import '../../../models/academic-structure/Batch';
import '../../../models/academic-structure/Regulation';
import '../../../models/people/Parent';

// Mock the BullMQ enqueue used by fee-pin-service when seeding pins.
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import * as svc from '../service';
import * as feePinService from '../../finance/fee-pin-service';

/**
 * Task 11 — updateStudent stale-pin detection + programme-change rejection.
 *
 * 7. PATCH student.branchId → active pin gets staleSince populated.
 * 8. PATCH student.quota → same.
 * 9. PATCH student.category → same.
 * 10. PATCH student.programmeId → 403/400; student unchanged.
 */

const oid = () => new mongoose.Types.ObjectId();

async function seedStudentWithPin(opts?: {
  quota?: string;
  category?: string;
}) {
  const collegeId = oid();
  const programmeId = oid();
  const branchId = oid();
  const academicYearId = oid();

  await FeeStructureInstance.create({
    collegeId,
    programmeId,
    branchId,
    academicYearId,
    quota: opts?.quota ?? 'convener',
    category: opts?.category ?? 'OC',
    status: 'active',
    totalAmount: 100000,
    approvedAt: new Date(),
  });

  const person = await Person.create({
    collegeId,
    name: 'Test Student',
    phone: '9999999999',
  });

  const student = await Student.create({
    collegeId,
    personId: person._id,
    admissionYear: 2025,
    programmeId,
    branchId,
    quota: opts?.quota ?? 'convener',
    category: opts?.category ?? 'OC',
    status: 'active',
  });

  await feePinService.pinYear(String(student._id), 1, {
    pinnedBy: 'system:admission',
    academicYearId,
  });

  return { collegeId: String(collegeId), student, programmeId, branchId, academicYearId };
}

describe('updateStudent — stale pin detection', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });

  // ── 7 ──────────────────────────────────────────────────────────────
  it('branchId change → active pin staleSince populated', async () => {
    const { collegeId, student } = await seedStudentWithPin();
    const newBranchId = oid();

    await svc.updateStudent(
      collegeId,
      String(student._id),
      { branchId: String(newBranchId) },
      'user-admin',
    );

    const reloaded = await Student.findById(student._id);
    const active = reloaded!.feePins.find(
      (p) => p.yearOfStudy === 1 && !p.archivedAt,
    );
    expect(active).toBeTruthy();
    expect(active!.staleSince).toBeTruthy();
  });

  // ── 8 ──────────────────────────────────────────────────────────────
  it('quota change → active pin staleSince populated', async () => {
    const { collegeId, student } = await seedStudentWithPin({ quota: 'convener' });

    await svc.updateStudent(
      collegeId,
      String(student._id),
      { quota: 'management' },
      'user-admin',
    );

    const reloaded = await Student.findById(student._id);
    const active = reloaded!.feePins.find(
      (p) => p.yearOfStudy === 1 && !p.archivedAt,
    );
    expect(active).toBeTruthy();
    expect(active!.staleSince).toBeTruthy();
  });

  // ── 9 ──────────────────────────────────────────────────────────────
  it('category change → active pin staleSince populated', async () => {
    const { collegeId, student } = await seedStudentWithPin({ category: 'OC' });

    await svc.updateStudent(
      collegeId,
      String(student._id),
      { category: 'BC' },
      'user-admin',
    );

    const reloaded = await Student.findById(student._id);
    const active = reloaded!.feePins.find(
      (p) => p.yearOfStudy === 1 && !p.archivedAt,
    );
    expect(active).toBeTruthy();
    expect(active!.staleSince).toBeTruthy();
  });

  // ── 10 ─────────────────────────────────────────────────────────────
  it('programmeId change is rejected; student unchanged', async () => {
    const { collegeId, student, programmeId } = await seedStudentWithPin();
    const newProgrammeId = oid();

    await expect(
      svc.updateStudent(
        collegeId,
        String(student._id),
        { programmeId: String(newProgrammeId) },
        'user-admin',
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    const reloaded = await Student.findById(student._id);
    expect(String(reloaded!.programmeId)).toBe(String(programmeId));
  });
});
