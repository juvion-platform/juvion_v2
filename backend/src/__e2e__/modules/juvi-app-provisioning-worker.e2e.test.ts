import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestStudent } from '../factories/student.factory';
import { createTestFaculty } from '../factories/academic.factory';
import { Person, Student, Batch } from '../../models';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisioningRun } from '../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { runProvisioningJob } from '../../modules/juvi-app/accounts/provisioning-worker';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function studentWithoutUser(roll: string, batchId: unknown, status = 'active') {
  const person = await Person.create({ collegeId: fx.collegeId, name: `S ${roll}`, phone: `9${roll.padStart(9, '0')}` });
  return Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: roll, status, batchId, branchId: fx.cseBranch._id, programmeId: fx.btech._id });
}

describe('runProvisioningJob', () => {
  it('provisions active students in the filter, counts created vs linked, expires credentials in 7 days', async () => {
    const otherBatch = await Batch.create({ collegeId: fx.collegeId, code: '2023', name: '2023 Batch', admissionYear: 2023, programmeId: fx.btech._id, regulationId: fx.regulation._id });
    await studentWithoutUser('24A001', fx.batch._id);
    await studentWithoutUser('24A002', fx.batch._id);
    await studentWithoutUser('24A003', fx.batch._id, 'exited');          // not active → not scanned
    await studentWithoutUser('23A001', otherBatch._id);                  // wrong batch → not scanned
    await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id) }); // has a User → existingLinked
    await createTestFaculty(fx.collegeId);                               // kind not requested

    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'], batchIds: [fx.batch._id] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const done = await runProvisioningJob(String(run._id));
    expect(done.status).toBe('completed');
    expect(done.counts).toEqual({ scanned: 3, created: 2, existingLinked: 1, skipped: 0, failed: 0 });
    expect(done.startedAt).toBeInstanceOf(Date); expect(done.finishedAt).toBeInstanceOf(Date);
    expect(done.credentialsExpireAt!.getTime() - done.startedAt!.getTime()).toBeCloseTo(7 * 86_400_000, -4);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(3);
    expect(await JuviProvisionedCredential.countDocuments({ runId: run._id })).toBe(3);
  });

  it('re-running skips existing accounts and records per-person failures as partial', async () => {
    await studentWithoutUser('24B001', fx.batch._id);
    const broken = await studentWithoutUser('24B002', fx.batch._id);
    await Person.deleteOne({ _id: broken.personId });                    // orphaned student → provisionPerson throws
    const run1 = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const r1 = await runProvisioningJob(String(run1._id));
    expect(r1.status).toBe('partial');
    expect(r1.counts).toMatchObject({ scanned: 2, created: 1, failed: 1 });
    expect(r1.errors[0]).toMatchObject({ personId: broken.personId, reason: expect.stringMatching(/Person not found/) });

    const run2 = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const r2 = await runProvisioningJob(String(run2._id));
    expect(r2.counts).toMatchObject({ scanned: 2, created: 0, skipped: 1, failed: 1 });
  });

  it('provisions faculty by department', async () => {
    const f = await createTestFaculty(fx.collegeId, { departmentId: String(fx.cse._id) });
    await createTestFaculty(fx.collegeId, { departmentId: String(fx.ece._id) });
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['faculty'], departmentIds: [fx.cse._id] }, options: { resetExistingPasswords: false }, performedBy: 'admin' });
    const done = await runProvisioningJob(String(run._id));
    expect(done.counts).toMatchObject({ scanned: 1, existingLinked: 1 });
    expect(await JuviAccount.countDocuments({ facultyId: f.faculty._id })).toBe(1);
    expect(await JuviProvisionedCredential.countDocuments({ runId: run._id })).toBe(0);   // no reset → no credential
  });
});
