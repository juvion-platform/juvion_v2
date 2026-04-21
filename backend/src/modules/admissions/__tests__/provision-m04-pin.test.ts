import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

// Mock BOTH fee-pin-service and the BullMQ enqueue BEFORE importing
// workflow.handlers (which registers provision_m04 as a side-effect of
// module load).

vi.mock('../../finance/fee-pin-service', async () => {
  // Preserve the FeeStructureNotFoundError export; mock the async APIs.
  const actual: any = await vi.importActual('../../finance/fee-pin-service');
  return {
    ...actual,
    pinYear: vi.fn(),
    resolveActivePin: vi.fn(),
  };
});

vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { Admission } from '../../../models/admissions/Admission';
import { Applicant } from '../../../models/admissions/Applicant';
import { AcademicYear } from '../../../models/academic-structure/AcademicYear';
import { Batch } from '../../../models/academic-structure/Batch';
import { Branch } from '../../../models/academic-structure/Branch';
import { Programme } from '../../../models/academic-structure/Programme';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { Student } from '../../../models/people/Student';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { WorkflowInstance } from '../../../models/workflow/WorkflowInstance';

import { executeWorkflowStepHandler } from '../../../shared/workflow/StepHandlers';
// Importing workflow.handlers triggers registerWorkflowStepHandler() calls.
import '../workflow.handlers';

import * as feePinService from '../../finance/fee-pin-service';
import { FeeStructureNotFoundError } from '../../finance/fee-pin-service';

const oid = () => new mongoose.Types.ObjectId();

/**
 * Seed the minimal upstream graph that provision_m04 depends on.
 */
async function seedProvisioningContext() {
  const collegeId = oid();
  const academicYearId = oid();
  const programmeId = oid();
  const branchId = oid();
  const regulationId = oid();

  await AcademicYear.create({
    _id: academicYearId,
    collegeId,
    code: 'AY-2025-26',
    label: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isCurrent: true,
  });

  await Regulation.create({
    _id: regulationId,
    collegeId,
    code: 'R20',
    name: 'Regulation 2020',
    maxYears: 8,
    totalCredits: 160,
    effectiveFromYear: 2020,
  });

  await Programme.create({
    _id: programmeId,
    collegeId,
    code: 'BTECH',
    name: 'B.Tech',
    level: 'UG',
    durationYears: 4,
    regulationId,
  });

  await Branch.create({
    _id: branchId,
    collegeId,
    code: 'CSE',
    name: 'Computer Science',
    programmeId,
    intake: 60,
  });

  const batch = await Batch.create({
    collegeId,
    code: 'BTECH-2025',
    name: 'B.Tech 2025',
    admissionYear: 2025,
    programmeId,
    regulationId,
    isActive: true,
  });

  const applicant = await Applicant.create({
    collegeId,
    applicationNumber: 'APP-0001',
    name: 'Test Applicant',
    phone: '9999999999',
    quota: 'convener',
    category: 'OC',
    admissionType: 'fresh',
  });

  const student = await Student.create({
    collegeId,
    personId: oid(),
    admissionYear: 2025,
    category: 'OC',
    quota: 'convener',
    regulationId,
    programmeId,
    branchId,
    batchId: batch._id,
    rollNumber: 'CSE-25-000001',
    status: 'active',
    onboardingStatus: 'in_progress',
  });

  const admission = await Admission.create({
    collegeId,
    applicantId: applicant._id,
    studentId: student._id,
    admissionDate: new Date('2025-07-15'),
    admittedBy: 'admin',
    admissionType: 'fresh',
    academicYearId,
  });

  const instance = await WorkflowInstance.create({
    collegeId,
    workflowId: 'W01',
    workflowVersion: 1,
    entityType: 'Applicant',
    entityId: applicant._id,
    status: 'active',
    currentPhase: 'provisioning',
    currentStep: 'provision_m04',
    initiatedBy: 'admin',
    metadata: {
      applicantId: String(applicant._id),
      admissionId: String(admission._id),
      studentId: String(student._id),
      academicYearId: String(academicYearId),
      programmeId: String(programmeId),
      branchId: String(branchId),
      batchId: String(batch._id),
      regulationId: String(regulationId),
    },
  });

  // WorkflowTask is not read by provision_m04; a minimal stub suffices.
  const task = { _id: oid(), stepId: 'provision_m04' } as any;

  return {
    collegeId,
    academicYearId,
    programmeId,
    branchId,
    regulationId,
    batchId: batch._id,
    applicant,
    student,
    admission,
    instance,
    task,
  };
}

async function seedActiveStructure(
  collegeId: mongoose.Types.ObjectId,
  academicYearId: mongoose.Types.ObjectId,
  programmeId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  opts: { totalAmount?: number; status?: string } = {},
) {
  return FeeStructureInstance.create({
    collegeId,
    academicYearId,
    programmeId,
    branchId,
    quota: 'convener',
    category: 'OC',
    status: opts.status ?? 'active',
    totalAmount: opts.totalAmount ?? 120_000,
    approvedAt: new Date(),
  });
}

describe('provision_m04 — fee pin integration (Task 8)', () => {
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
    vi.mocked(feePinService.resolveActivePin).mockReset();
  });

  // ── 1 ──────────────────────────────────────────────────────────────
  it('happy path: calls pinYear(student._id, 1, ...) then seeds SFA from resolved pin', { timeout: 30_000 }, async () => {
    const ctx = await seedProvisioningContext();
    const fsi = await seedActiveStructure(ctx.collegeId, ctx.academicYearId, ctx.programmeId, ctx.branchId);

    const fakePin: any = {
      _id: oid(),
      yearOfStudy: 1,
      feeStructureInstanceId: fsi._id,
      pinnedAt: new Date(),
      pinnedBy: 'system:admission',
      reason: 'initial',
    };

    vi.mocked(feePinService.pinYear).mockResolvedValue(fakePin);
    vi.mocked(feePinService.resolveActivePin).mockResolvedValue(fakePin);

    await executeWorkflowStepHandler('W01', 'provision_m04', {
      instance: ctx.instance,
      task: ctx.task,
      result: {},
      completedBy: 'admin',
    });

    expect(feePinService.pinYear).toHaveBeenCalledTimes(1);
    const [studentIdArg, yearArg, optsArg] = vi.mocked(feePinService.pinYear).mock.calls[0]!;
    expect(String(studentIdArg)).toBe(String(ctx.student._id));
    expect(yearArg).toBe(1);
    expect(optsArg).toMatchObject({
      pinnedBy: 'system:admission',
      reason: 'initial',
    });

    // SFA created and balance matches pinned structure total (120_000).
    const sfa = await StudentFeeAccount.findOne({ studentId: ctx.student._id });
    expect(sfa).toBeTruthy();
    expect(sfa!.totalDue).toBe(120_000);

    // Student still exists (not rolled back).
    const persisted = await Student.findById(ctx.student._id);
    expect(persisted).toBeTruthy();
  });

  // ── 2 ──────────────────────────────────────────────────────────────
  it('FeeStructureNotFoundError → provision_m04 throws 422 with "coordinate with Finance"; student is rolled back', { timeout: 30_000 }, async () => {
    const ctx = await seedProvisioningContext();

    vi.mocked(feePinService.pinYear).mockRejectedValue(
      new FeeStructureNotFoundError({
        programmeId: String(ctx.programmeId),
        branchId: String(ctx.branchId),
        quota: 'convener',
        category: 'OC',
        yearOfStudy: 1,
        academicYearId: String(ctx.academicYearId),
      }),
    );

    await expect(
      executeWorkflowStepHandler('W01', 'provision_m04', {
        instance: ctx.instance,
        task: ctx.task,
        result: {},
        completedBy: 'admin',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/coordinate with Finance/i),
    });

    // Student must NOT remain.
    const persisted = await Student.findById(ctx.student._id);
    expect(persisted).toBeNull();

    // No SFA either.
    const sfa = await StudentFeeAccount.findOne({ studentId: ctx.student._id });
    expect(sfa).toBeNull();
  });

  // ── 3 ──────────────────────────────────────────────────────────────
  it('non-FeeStructureNotFoundError (generic failure) propagates; student rolled back', { timeout: 30_000 }, async () => {
    const ctx = await seedProvisioningContext();

    vi.mocked(feePinService.pinYear).mockRejectedValue(new Error('DB blew up'));

    await expect(
      executeWorkflowStepHandler('W01', 'provision_m04', {
        instance: ctx.instance,
        task: ctx.task,
        result: {},
        completedBy: 'admin',
      }),
    ).rejects.toThrow(/DB blew up/);

    const persisted = await Student.findById(ctx.student._id);
    expect(persisted).toBeNull();
  });

  // ── 4 ──────────────────────────────────────────────────────────────
  it('passes academicYearId from admission/provisioning context into pinYear', { timeout: 30_000 }, async () => {
    const ctx = await seedProvisioningContext();
    const fsi = await seedActiveStructure(ctx.collegeId, ctx.academicYearId, ctx.programmeId, ctx.branchId);

    const fakePin: any = {
      _id: oid(),
      yearOfStudy: 1,
      feeStructureInstanceId: fsi._id,
    };
    vi.mocked(feePinService.pinYear).mockResolvedValue(fakePin);
    vi.mocked(feePinService.resolveActivePin).mockResolvedValue(fakePin);

    await executeWorkflowStepHandler('W01', 'provision_m04', {
      instance: ctx.instance,
      task: ctx.task,
      result: {},
      completedBy: 'admin',
    });

    const [, , optsArg] = vi.mocked(feePinService.pinYear).mock.calls[0]!;
    expect(String(optsArg.academicYearId)).toBe(String(ctx.academicYearId));
  });

  // ── 5 ──────────────────────────────────────────────────────────────
  it('idempotent re-run: provision_m04 called twice does not create a 2nd SFA (and pinYear is a no-op on idempotent replay)', { timeout: 30_000 }, async () => {
    const ctx = await seedProvisioningContext();
    const fsi = await seedActiveStructure(ctx.collegeId, ctx.academicYearId, ctx.programmeId, ctx.branchId);

    const fakePin: any = {
      _id: oid(),
      yearOfStudy: 1,
      feeStructureInstanceId: fsi._id,
    };
    vi.mocked(feePinService.pinYear).mockResolvedValue(fakePin);
    vi.mocked(feePinService.resolveActivePin).mockResolvedValue(fakePin);

    // First run.
    await executeWorkflowStepHandler('W01', 'provision_m04', {
      instance: ctx.instance,
      task: ctx.task,
      result: {},
      completedBy: 'admin',
    });

    // Re-run.
    await executeWorkflowStepHandler('W01', 'provision_m04', {
      instance: ctx.instance,
      task: ctx.task,
      result: {},
      completedBy: 'admin',
    });

    const sfaCount = await StudentFeeAccount.countDocuments({ studentId: ctx.student._id });
    expect(sfaCount).toBe(1);

    // pinYear may be called twice, but the service (unit-tested separately in T5)
    // is responsible for idempotent pin state. Here we only guard against SFA duplication.
    expect(vi.mocked(feePinService.pinYear).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
