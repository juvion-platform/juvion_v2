import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { User } from '../../models/User';
import { MobileSession } from '../../models/juvi/MobileSession';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin accounts', () => {
  it('lists with kind/status filters and free-text search over name, roll and employee code', async () => {
    const s = await provisionTestStudent(fx);
    const f = await provisionTestFaculty(fx);
    const all = await api.as(fx.admin.token).get(`${A}/accounts`).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toMatchObject({ kind: expect.any(String), status: 'onboarding', hasLiveCredential: true, onboardingComplete: false });
    const students = await api.as(fx.admin.token).get(`${A}/accounts?kind=student`).expect(200);
    expect(students.body.items).toHaveLength(1);
    expect(students.body.items[0]).toMatchObject({ name: s.person.name, identifier: s.student.rollNumber, email: s.person.email });
    const byRoll = await api.as(fx.admin.token).get(`${A}/accounts?q=${s.student.rollNumber.slice(0, 5)}`).expect(200);
    expect(byRoll.body.items.map((r: any) => r.id)).toEqual([String(s.account._id)]);
    const byCode = await api.as(fx.admin.token).get(`${A}/accounts?q=${f.faculty.employeeCode}`).expect(200);
    expect(byCode.body.items[0].identifier).toBe(f.faculty.employeeCode);
    const byName = await api.as(fx.admin.token).get(`${A}/accounts?q=${encodeURIComponent(f.person.name.split(' ')[0]!)}`).expect(200);
    expect(byName.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('deactivate flips status; list shows it; the mobile side is covered in Plan 1', async () => {
    const s = await provisionTestStudent(fx);
    const res = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/deactivate`).expect(200);
    expect(res.body.status).toBe('deactivated');
    const list = await api.as(fx.admin.token).get(`${A}/accounts?status=deactivated`).expect(200);
    expect(list.body.items[0].id).toBe(String(s.account._id));
    await api.as(fx.admin.token).post(`${A}/accounts/000000000000000000000001/deactivate`).expect(404);
  });

  it('reset-password stores a new credential, forces change, revokes sessions; reveal returns it once live and 410 when gone', async () => {
    const s = await provisionTestStudent(fx);
    await MobileSession.create({ collegeId: fx.collegeId, accountId: s.account._id, userId: s.account.userId, deviceId: 'd', deviceName: 'n', platform: 'android', appVersion: '1', osVersion: '1', refreshTokenHash: 'h', refreshExpiresAt: new Date(Date.now() + 1000) });
    const reset = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reset-password`).expect(200);
    expect(reset.body.credentialId).toBeTypeOf('string');
    expect(await JuviProvisionedCredential.countDocuments({ accountId: s.account._id })).toBe(2);
    const user = await User.findById(s.account.userId).lean();
    expect(user?.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(s.tempPassword, user!.password)).toBe(false);
    expect((await MobileSession.findOne({ accountId: s.account._id }).lean())?.revokedReason).toBe('admin');

    const reveal = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reveal-credential`).expect(200);
    expect(reveal.body).toMatchObject({ identifier: s.student.rollNumber, password: expect.stringMatching(/^[a-z]+-[a-z]+-\d{3}$/) });
    expect(await bcrypt.compare(reveal.body.password, user!.password)).toBe(true);
    expect(await AuditLog.countDocuments({ entityType: 'JuviAccount', entityId: String(s.account._id), 'changes.field': 'temporaryCredential' })).toBe(1);

    await JuviProvisionedCredential.deleteMany({ accountId: s.account._id });
    await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reveal-credential`).expect(410);
  });
});
