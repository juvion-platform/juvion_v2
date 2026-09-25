import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, TEST_DEVICE } from '../factories/juvi.factory';
import { createFaculty } from '../../modules/people/service';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { createSession } from '../../modules/juvi-app/accounts/session-service';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { User } from '../../models/User';
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Applicant } from '../../models/admissions/Applicant';
import { Admission } from '../../models/admissions/Admission';
import { WorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { executeWorkflowStepHandler } from '../../shared/workflow/StepHandlers';
// Side-effect: registers provision_m12 (and the other W01 steps) into the step-handler registry.
import '../../modules/admissions/workflow.handlers';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

const facultyPayload = (n: number) => ({ name: `Hook Faculty ${n}`, phone: `93000000${n}${n}`, email: `hook${n}@test.com`, employeeCode: `HK${n}`, designation: 'Assistant Professor', departmentId: String(fx.cse._id) });

describe('createFaculty hook', () => {
  it('provisions a Juvi account with a stored credential when Juvi is enabled', async () => {
    await enableJuvi(fx.collegeId);
    const f = await createFaculty(fx.collegeId, facultyPayload(1), 'hr');
    const account = await JuviAccount.findOne({ collegeId: fx.collegeId, personId: f.personId }).lean();
    expect(account).toMatchObject({ kind: 'faculty', status: 'onboarding' });
    expect(account?.transitions[0]).toMatchObject({ source: 'workflow', by: 'hr' });
    expect((await User.findById(account!.userId).lean())?.mustChangePassword).toBe(true);
    expect(await JuviProvisionedCredential.countDocuments({ accountId: account!._id, source: 'workflow' })).toBe(1);
  });

  it('does nothing when Juvi is disabled', async () => {
    const f = await createFaculty(fx.collegeId, facultyPayload(2), 'hr');
    expect(await JuviAccount.countDocuments({ personId: f.personId })).toBe(0);
    expect(await User.countDocuments({ personId: f.personId })).toBe(0);
  });
});

// Instance setup mirrors the W01 provisioning fixture used in
// src/__e2e__/modules/fee-configuration.e2e.test.ts (Applicant -> Admission ->
// Student -> WorkflowInstance at a provisioning step), swapping the target
// step to provision_m12 so the handler under test in this file runs.
/** Applicant -> Admission -> Student -> WorkflowInstance at provision_m12. `withPersonId` mirrors the
 *  real W01 flow, whose person step writes `metadata.personId` (the cancel steps read it). */
async function w01Fixture(opts: { withPersonId?: boolean } = {}) {
  const person = await Person.create({
    collegeId: fx.collegeId,
    name: 'Hook Student One',
    phone: '9600000001',
  });

  const applicant = await Applicant.create({
    collegeId: fx.collegeId,
    applicationNumber: `APP-HOOK-${Date.now()}`,
    name: 'Hook Student One',
    phone: '9600000001',
    email: 'hookstudent1@test.com',
    quota: 'convener',
    category: 'OC',
    admissionType: 'fresh',
  });

  const student = await Student.create({
    collegeId: fx.collegeId,
    personId: person._id,
    admissionYear: 2024,
    category: 'OC',
    quota: 'convener',
    regulationId: fx.regulation._id,
    programmeId: fx.btech._id,
    branchId: fx.cseBranch._id,
    batchId: fx.batch._id,
    rollNumber: 'HOOK-24-000001',
    status: 'active',
    onboardingStatus: 'in_progress',
  });

  const admission = await Admission.create({
    collegeId: fx.collegeId,
    applicantId: applicant._id,
    studentId: student._id,
    admissionDate: new Date('2024-07-15'),
    admittedBy: 'admin',
    admissionType: 'fresh',
    academicYearId: fx.ay._id,
  });

  const instance = await WorkflowInstance.create({
    collegeId: fx.collegeId,
    workflowId: 'W01',
    workflowVersion: 1,
    entityType: 'Applicant',
    entityId: applicant._id,
    status: 'active',
    currentPhase: 'provisioning',
    currentStep: 'provision_m12',
    initiatedBy: 'admin',
    metadata: {
      applicantId: String(applicant._id),
      admissionId: String(admission._id),
      studentId: String(student._id),
      academicYearId: String(fx.ay._id),
      ...(opts.withPersonId ? { personId: String(person._id) } : {}),
    },
  });
  return { person, instance };
}

const runStep = (instance: InstanceType<typeof WorkflowInstance>, stepId: string) =>
  executeWorkflowStepHandler('W01', stepId, {
    instance,
    task: { _id: new Types.ObjectId(), stepId } as any,
    result: {},
    completedBy: 'admin',
  });

// Instance setup mirrors the W01 provisioning fixture used in
// src/__e2e__/modules/fee-configuration.e2e.test.ts (Applicant -> Admission ->
// Student -> WorkflowInstance at a provisioning step), swapping the target
// step to provision_m12 so the handler under test in this file runs.
describe('W01 provision_m12 hook', () => {
  it('provisions a Juvi student account and surfaces juviAccountId/juviCredentialId when Juvi is enabled', async () => {
    await enableJuvi(fx.collegeId);
    const { person, instance } = await w01Fixture();

    const outcome = await runStep(instance, 'provision_m12');
    const result = outcome?.result;

    const account = await JuviAccount.findOne({ collegeId: fx.collegeId, personId: person._id }).lean();
    expect(account).toMatchObject({ kind: 'student', status: 'onboarding' });

    expect(
      await JuviProvisionedCredential.countDocuments({ collegeId: fx.collegeId, accountId: account!._id }),
    ).toBe(1);

    expect(result?.juviAccountId).toBe(String(account!._id));
    expect(result?.juviCredentialId).toBeDefined();
    expect(result?.initialPassword).toBeUndefined();
  });
});

describe('W01 cancel_m12 hook', () => {
  it('deactivates the Juvi account, revokes its sessions and drops its memberships', async () => {
    await enableJuvi(fx.collegeId);
    const { person, instance } = await w01Fixture({ withPersonId: true });
    await runStep(instance, 'provision_m12');
    const account = await JuviAccount.findOne({ collegeId: fx.collegeId, personId: person._id }).lean();
    expect(account).toBeTruthy();

    const { tokens } = await createSession({
      collegeId: fx.collegeId, accountId: String(account!._id), userId: String(account!.userId),
      role: 'student', kind: 'student', device: TEST_DEVICE,
    });
    expect(tokens.accessToken).toBeTypeOf('string');
    await ChannelMembership.create({
      collegeId: fx.collegeId, channelId: new Types.ObjectId(), accountId: account!._id, role: 'member', joinedVia: 'rule',
    });

    const outcome = await runStep(instance, 'cancel_m12');
    expect(outcome?.result?.accountStatus).toBe('deactivated');

    const after = await JuviAccount.findOne({ collegeId: fx.collegeId, _id: account!._id }).lean();
    expect(after?.status).toBe('deactivated');
    expect(after?.transitions.at(-1)).toMatchObject({ to: 'deactivated', source: 'workflow', by: 'admin' });
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId, accountId: account!._id, revokedAt: null })).toBe(0);
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId, accountId: account!._id, revokedReason: 'deactivated' })).toBe(1);
    expect(await ChannelMembership.countDocuments({ collegeId: fx.collegeId, accountId: account!._id })).toBe(0);
    expect((await User.findOne({ collegeId: fx.collegeId, _id: account!.userId }).lean())?.isActive).toBe(false);
  });

  it('still deactivates the ERP login when the person has no Juvi account', async () => {
    const { person, instance } = await w01Fixture({ withPersonId: true });
    await runStep(instance, 'provision_m12');
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId, personId: person._id })).toBe(0);

    const outcome = await runStep(instance, 'cancel_m12');
    expect(outcome?.result?.accountStatus).toBe('deactivated');
    expect((await User.findOne({ collegeId: fx.collegeId, personId: person._id }).lean())?.isActive).toBe(false);
  });
});
