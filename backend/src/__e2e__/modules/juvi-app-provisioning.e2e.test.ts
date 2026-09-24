import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestStudent } from '../factories/student.factory';
import { createTestFaculty } from '../factories/academic.factory';
import { Person, Student, Department } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { MobileSession } from '../../models/juvi/MobileSession';
import { AuditLog } from '../../shared/audit';
import { provisionPerson, deactivateAccount, placeholderEmail } from '../../modules/juvi-app/accounts/provisioning-service';
import { revealLatestForAccount } from '../../modules/juvi-app/accounts/credential-store';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('provisionPerson', () => {
  it('builds a placeholder email in the reserved .invalid TLD', () => {
    expect(placeholderEmail('21CS1042', 'JIT')).toBe('21cs1042@no-email.jit.juvion.invalid');
  });

  it('creates a User and account for a student with no login, stores a credential, audits', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'No Login', phone: '9111111111' });
    const student = await Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: '24JIT9001', status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id });
    const r = await provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'student', source: 'bulk', performedBy: 'admin' });
    expect(r.created).toBe(true);
    expect(r.userCreated).toBe(true);
    expect(r.account.status).toBe('onboarding');
    expect(String(r.account.studentId)).toBe(String(student._id));
    const credRow = await JuviProvisionedCredential.findOne({ accountId: r.account._id }).lean();
    expect(String(credRow?.departmentId)).toBe(String(fx.cse._id));
    const user = await User.findById(r.account.userId).lean();
    expect(user?.email).toBe('24jit9001@no-email.jit-test.juvion.invalid');
    expect(user?.role).toBe('student');
    expect(user?.personaType).toBe('L-STU');
    expect(user?.mustChangePassword).toBe(true);
    const cred = await revealLatestForAccount(fx.collegeId, String(r.account._id));
    expect(cred?.password).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
    expect(await bcrypt.compare(cred!.password, user!.password)).toBe(true);
    const audit = await AuditLog.findOne({ entityType: 'JuviAccount', entityId: String(r.account._id) }).lean();
    expect(audit?.action).toBe('create');
    expect(r.account.transitions).toEqual([expect.objectContaining({ from: null, to: 'onboarding', source: 'bulk', by: 'admin' })]);
  });

  it('links an existing User, resets its password by default, and is idempotent', async () => {
    const s = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const first = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    expect(first.userCreated).toBe(false);
    expect(String(first.account.userId)).toBe(String(s.user._id));
    const user = await User.findById(s.user._id).lean();
    expect(await bcrypt.compare('test123', user!.password)).toBe(false);
    expect(user?.mustChangePassword).toBe(true);

    const second = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    expect(second.created).toBe(false);
    expect(String(second.account._id)).toBe(String(first.account._id));
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(1);
    expect(await JuviProvisionedCredential.countDocuments({ accountId: first.account._id })).toBe(1);
  });

  it('keeps the existing password when resetPassword is false', async () => {
    const s = await createTestStudent(fx.collegeId);
    await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin', resetPassword: false });
    const user = await User.findById(s.user._id).lean();
    expect(await bcrypt.compare('test123', user!.password)).toBe(true);
    expect(user?.mustChangePassword).toBe(false);
  });

  it('assigns hod role when the faculty heads a department', async () => {
    const f = await createTestFaculty(fx.collegeId, { departmentId: String(fx.cse._id) });
    await User.deleteOne({ _id: f.user._id });
    await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: f.faculty._id } });
    const r = await provisionPerson({ collegeId: fx.collegeId, personId: String(f.person._id), kind: 'faculty', source: 'workflow', performedBy: 'hr' });
    const user = await User.findById(r.account.userId).lean();
    expect(user?.role).toBe('hod');
    expect(user?.personaType).toBe('F-HOD');
    expect(String(r.account.facultyId)).toBe(String(f.faculty._id));
  });

  it('refuses a person that has no row of the requested kind', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'Ghost', phone: '9222222222' });
    await expect(provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'faculty', source: 'admin', performedBy: 'x' }))
      .rejects.toThrow(/no faculty record/i);
  });
});

describe('deactivateAccount', () => {
  it('sets deactivated, disables the User, revokes sessions, drops memberships, audits', async () => {
    const s = await createTestStudent(fx.collegeId);
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    await MobileSession.create({ collegeId: fx.collegeId, accountId: account._id, userId: account.userId, deviceId: 'd', deviceName: 'n', platform: 'android', appVersion: '1', osVersion: '1', refreshTokenHash: 'h1', refreshExpiresAt: new Date(Date.now() + 1000) });
    await ChannelMembership.create({ collegeId: fx.collegeId, channelId: fx.batch._id, accountId: account._id });

    const out = await deactivateAccount(fx.collegeId, String(account._id), 'admin', 'admin');
    expect(out.status).toBe('deactivated');
    expect(out.transitions.at(-1)).toMatchObject({ from: 'onboarding', to: 'deactivated', source: 'admin' });
    expect((await User.findById(account.userId).lean())?.isActive).toBe(false);
    expect((await MobileSession.findOne({ accountId: account._id }).lean())?.revokedReason).toBe('deactivated');
    expect(await ChannelMembership.countDocuments({ accountId: account._id })).toBe(0);
    expect(await AuditLog.countDocuments({ entityType: 'JuviAccount', entityId: String(account._id), action: 'update' })).toBe(1);
  });

  it('is a 404 for another college', async () => {
    const s = await createTestStudent(fx.collegeId);
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    await expect(deactivateAccount('000000000000000000000099', String(account._id), 'admin', 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
