import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { AuditLog } from '../../../shared/audit';

// Mock the BullMQ enqueue BEFORE importing the service-under-test.
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import * as svc from '../fee-pin-service';
import { enqueueFeeCommitmentJob } from '../../../workers/fee-commitment.worker';

/**
 * Task 5 — fee-pin-service unit tests (10 scenarios per tasks.md AC).
 */

const oid = () => new mongoose.Types.ObjectId();

interface SeedOpts {
  collegeId?: mongoose.Types.ObjectId;
  programmeId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId | null;
  academicYearId?: mongoose.Types.ObjectId;
  quota?: string;
  category?: string;
  yearOfStudy?: number;
  status?: string;
  approvedAt?: Date;
  totalAmount?: number;
}

async function makeStructure(opts: SeedOpts = {}) {
  const payload: Record<string, unknown> = {
    collegeId: opts.collegeId ?? oid(),
    academicYearId: opts.academicYearId ?? oid(),
    programmeId: opts.programmeId ?? oid(),
    quota: opts.quota ?? 'convener',
    status: opts.status ?? 'active',
    totalAmount: opts.totalAmount ?? 100000,
    approvedAt: opts.approvedAt ?? new Date(),
  };
  if (opts.branchId !== null) payload.branchId = opts.branchId ?? oid();
  if (opts.category !== undefined) payload.category = opts.category;
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

describe('fee-pin-service', () => {
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
    vi.mocked(enqueueFeeCommitmentJob).mockClear();
  });

  // ── 1 ──────────────────────────────────────────────────────────────
  it('pinYear — matching structure → pin pushed, commitment job enqueued', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    const fsi = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
      yearOfStudy: 1,
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    const pin = await svc.pinYear(String(student._id), 1, {
      pinnedBy: 'system:admission',
      academicYearId,
    });

    expect(pin).toBeTruthy();
    expect(String(pin.feeStructureInstanceId)).toBe(String(fsi._id));
    expect(pin.yearOfStudy).toBe(1);
    expect(pin.reason).toBe('initial');
    expect(pin.archivedAt).toBeFalsy();

    const reloaded = await Student.findById(student._id);
    expect(reloaded!.feePins.length).toBe(1);

    expect(enqueueFeeCommitmentJob).toHaveBeenCalledTimes(1);
    expect(enqueueFeeCommitmentJob).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: String(student._id) }),
    );

    // audit entry
    const audit = await AuditLog.findOne({ entityType: 'Student', action: 'create' });
    expect(audit).toBeTruthy();
  });

  // ── 2 ──────────────────────────────────────────────────────────────
  it('pinYear — no matching structure → throws FeeStructureNotFoundError with full combo', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const academicYearId = oid();
    const student = await makeStudent({
      collegeId,
      programmeId,
      branchId: oid(),
      quota: 'convener',
      category: 'OC',
    });

    await expect(
      svc.pinYear(String(student._id), 1, {
        pinnedBy: 'system:admission',
        academicYearId,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    let captured: Error | null = null;
    try {
      await svc.pinYear(String(student._id), 1, {
        pinnedBy: 'system:admission',
        academicYearId,
      });
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).toBeInstanceOf(svc.FeeStructureNotFoundError);
    // message references programme / quota / category / year
    expect(captured!.message).toContain(String(programmeId));
    expect(captured!.message.toLowerCase()).toContain('convener');
    expect(captured!.message).toContain('OC');
    expect(captured!.message).toMatch(/year\s*1/i);

    // no pin created
    const reloaded = await Student.findById(student._id);
    expect(reloaded!.feePins.length).toBe(0);
  });

  // ── 3 ──────────────────────────────────────────────────────────────
  it('rePin — archives current active pin and adds a new one', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    const fsi1 = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    const fsi2 = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
      approvedAt: new Date(Date.now() + 1000),
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    const first = await svc.pinYear(String(student._id), 1, {
      pinnedBy: 'system:admission',
      academicYearId,
    });
    expect(String(first.feeStructureInstanceId)).toBeTruthy();

    const next = await svc.rePin(String(student._id), 1, {
      targetFeeStructureInstanceId: fsi2._id,
      reason: 'admin_override',
      pinnedBy: 'user-principal',
      remarks: 'manual',
    });

    expect(String(next.feeStructureInstanceId)).toBe(String(fsi2._id));
    expect(next.archivedAt).toBeFalsy();

    const reloaded = await Student.findById(student._id);
    expect(reloaded!.feePins.length).toBe(2);
    const archived = reloaded!.feePins.find(
      (p) => String(p._id) === String(first._id),
    );
    expect(archived).toBeTruthy();
    expect(archived!.archivedAt).toBeTruthy();
    expect(archived!.archiveReason).toBe('replaced');

    // suppress unused-var warning
    expect(String(fsi1._id)).toBeTruthy();
  });

  // ── 4 ──────────────────────────────────────────────────────────────
  it('resolveActivePin — returns latest non-archived entry for yearOfStudy', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    const fsi2 = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
      approvedAt: new Date(Date.now() + 1000),
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    await svc.pinYear(String(student._id), 1, {
      pinnedBy: 'system:admission',
      academicYearId,
    });
    const latest = await svc.rePin(String(student._id), 1, {
      targetFeeStructureInstanceId: fsi2._id,
      reason: 'data_correction',
      pinnedBy: 'user-x',
    });

    const active = await svc.resolveActivePin(String(student._id), 1);
    expect(active).toBeTruthy();
    expect(String(active!._id)).toBe(String(latest._id));
    expect(String(active!.feeStructureInstanceId)).toBe(String(fsi2._id));

    const noneForY2 = await svc.resolveActivePin(String(student._id), 2);
    expect(noneForY2).toBeNull();
  });

  // ── 5 ──────────────────────────────────────────────────────────────
  it('checkPinValidity — detects branch mismatch after student.branchId change', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchA = oid();
    const branchB = oid();
    const academicYearId = oid();
    // only branchA structure exists
    await makeStructure({
      collegeId,
      programmeId,
      branchId: branchA,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    const student = await makeStudent({ collegeId, programmeId, branchId: branchA });

    await svc.pinYear(String(student._id), 1, {
      pinnedBy: 'system:admission',
      academicYearId,
    });

    // admin changes the branch
    student.branchId = branchB as unknown as typeof student.branchId;
    await student.save();

    const validity = await svc.checkPinValidity(String(student._id), 1);
    expect(validity.valid).toBe(false);
    expect(validity.reason).toBe('branch_mismatch');
    expect(validity.currentPin).toBeTruthy();
  });

  // ── 6 ──────────────────────────────────────────────────────────────
  it('resolveMatchingFeeStructureInstance — prefers exact-branch over null-branch fallback', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();

    // null-branch (wildcard) record
    const fsiNullBranch = await makeStructure({
      collegeId,
      programmeId,
      branchId: null,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    // exact-branch record
    const fsiExact = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });

    const student = await makeStudent({ collegeId, programmeId, branchId });

    const winner = await svc.resolveMatchingFeeStructureInstance(student, 1, {
      academicYearId,
    });
    expect(winner).toBeTruthy();
    expect(String(winner!._id)).toBe(String(fsiExact._id));
    expect(String(winner!._id)).not.toBe(String(fsiNullBranch._id));
  });

  // ── 7 ──────────────────────────────────────────────────────────────
  it('Cross-year pins do not interfere — Year 1 pin unaffected by Year 2 pin', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    const y1 = await svc.pinYear(String(student._id), 1, {
      pinnedBy: 'system:admission',
      academicYearId,
    });
    const y2 = await svc.pinYear(String(student._id), 2, {
      pinnedBy: 'system:promotion',
      academicYearId,
    });

    const activeY1 = await svc.resolveActivePin(String(student._id), 1);
    const activeY2 = await svc.resolveActivePin(String(student._id), 2);

    expect(activeY1).toBeTruthy();
    expect(activeY2).toBeTruthy();
    expect(String(activeY1!._id)).toBe(String(y1._id));
    expect(String(activeY2!._id)).toBe(String(y2._id));
    expect(activeY1!.archivedAt).toBeFalsy();
    expect(activeY2!.archivedAt).toBeFalsy();
  });

  // ── 8 ──────────────────────────────────────────────────────────────
  it('Quota mismatch drops candidate (no fallback on quota)', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    // only a "management" quota structure exists
    await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'management',
      category: 'OC',
    });
    // student is convener quota — NO match expected
    const student = await makeStudent({
      collegeId,
      programmeId,
      branchId,
      quota: 'convener',
      category: 'OC',
    });

    const match = await svc.resolveMatchingFeeStructureInstance(student, 1, {
      academicYearId,
    });
    expect(match).toBeNull();

    await expect(
      svc.pinYear(String(student._id), 1, {
        pinnedBy: 'system:admission',
        academicYearId,
      }),
    ).rejects.toBeInstanceOf(svc.FeeStructureNotFoundError);
  });

  // ── 9 ──────────────────────────────────────────────────────────────
  it('Preference tie-break by most recent approvedAt', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    const older = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
      approvedAt: new Date('2025-01-01'),
    });
    const newer = await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
      approvedAt: new Date('2025-06-01'),
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    const winner = await svc.resolveMatchingFeeStructureInstance(student, 1, {
      academicYearId,
    });
    expect(winner).toBeTruthy();
    expect(String(winner!._id)).toBe(String(newer._id));
    expect(String(winner!._id)).not.toBe(String(older._id));
  });

  // ── 10 ─────────────────────────────────────────────────────────────
  it('Two concurrent pinYear calls for same (student, year) → second archives first', async () => {
    const collegeId = oid();
    const programmeId = oid();
    const branchId = oid();
    const academicYearId = oid();
    await makeStructure({
      collegeId,
      programmeId,
      branchId,
      academicYearId,
      quota: 'convener',
      category: 'OC',
    });
    const student = await makeStudent({ collegeId, programmeId, branchId });

    const [a, b] = await Promise.all([
      svc.pinYear(String(student._id), 1, {
        pinnedBy: 'caller-A',
        academicYearId,
      }),
      svc.pinYear(String(student._id), 1, {
        pinnedBy: 'caller-B',
        academicYearId,
      }),
    ]);

    const reloaded = await Student.findById(student._id);
    expect(reloaded!.feePins.length).toBe(2);
    const active = reloaded!.feePins.filter((p) => !p.archivedAt);
    expect(active.length).toBe(1);
    // Either a or b is the survivor; the other is archived.
    const survivorId = String(active[0]!._id);
    const allIds = [String(a._id), String(b._id)];
    expect(allIds).toContain(survivorId);
  });
});
