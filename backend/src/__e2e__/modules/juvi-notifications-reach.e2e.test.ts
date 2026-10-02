import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import supertest from 'supertest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround } from '../factories/notification.factory';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { drainOutbox } from '../../shared/outbox';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const A = '/api/juvi-app/admin/notices';
const fake = new FakePushTransport();

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

/**
 * A faculty publisher and one course whose six students each end in a different
 * delivery state for an Important acknowledgement notice.
 */
async function scenario() {
  const fac = await provisionTestFaculty(fx);
  await activateAccount(String(fac.account._id));
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  const enrol = (studentId: unknown) => createTestEnrollment(fx.collegeId, { studentId: String(studentId), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });

  const sent = await studentOnJuvi(app, fx, { pushToken: 'tok-sent' });
  const delivered = await studentOnJuvi(app, fx, { pushToken: 'tok-delivered' });
  const noDevice = await studentOnJuvi(app, fx);
  const tierOff = await studentOnJuvi(app, fx, { pushToken: 'tok-tier-off' });
  await JuviAccount.updateOne({ _id: tierOff.account._id }, { $set: { 'settings.tiers.important': false } });
  const held = await studentOnJuvi(app, fx, { pushToken: 'tok-held' });
  await JuviAccount.updateOne({ _id: held.account._id }, { $set: { 'settings.quietHours': quietHoursAround(new Date()) } });
  const offJuvi = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  for (const s of [sent, delivered, noDevice, tierOff, held, offJuvi]) await enrol(s.student._id);

  const notice = await publishTestNotice(fx, {
    title: 'Lab safety', priority: 'important', ackRequired: true,
    audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] },
  }, erpRef(fac.user));
  const { data } = fake.sent.find((m) => m.tokens.includes('tok-delivered'))!.message;
  await supertest(app).post(`${V1}/notifications/receipts`)
    .send({ items: [{ deliveryId: data.deliveryId, receipt: data.receipt, event: 'delivered', at: new Date().toISOString() }] }).expect(200);
  const facToken = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'device-fac');
  const expected = new Map([
    [sent.person.name, 'not_delivered'], [delivered.person.name, 'delivered'], [noDevice.person.name, 'no_device'],
    [tierOff.person.name, 'tier_off'], [held.person.name, 'scheduled'], [offJuvi.person.name, 'none'],
  ]);
  return { notice, facToken, expected, delivered };
}

const DELIVERY = { scheduled: 1, sent: 1, delivered: 1, opened: 0, failed: 0, cancelled: 0, suppressed: { muted: 0, tierOff: 1, noDevice: 1 } };
const byName = (items: { name: string; delivery: string }[]) => new Map(items.map((p) => [p.name, p.delivery]));

describe('Reach delivery diagnostics (notifications spec §7.4, NTF-05)', () => {
  it('mobile: the reach block counts the published notification by status, and each pending member carries a delivery state', async () => {
    const { notice, facToken, expected } = await scenario();
    const reach = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    expect(reach.body.delivery).toEqual(DELIVERY);
    const pending = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending`).expect(200);
    expect(byName(pending.body.items)).toEqual(expected);
    expect(JSON.stringify(pending.body)).not.toMatch(/tok-|deliveryId|pushToken/);
  });

  it('admin: the same block, the same pending column, and a Delivery column in the CSV', async () => {
    const { notice, expected, delivered } = await scenario();
    expect((await api.as(fx.admin.token).get(`${A}/${notice._id}/reach`).expect(200)).body.delivery).toEqual(DELIVERY);
    expect(byName((await api.as(fx.admin.token).get(`${A}/${notice._id}/reach/pending`).expect(200)).body.items)).toEqual(expected);
    const csv = (await api.as(fx.admin.token).get(`${A}/${notice._id}/reach.csv`).expect(200)).text.trim().split('\n');
    expect(csv[0]!.endsWith(',Delivery')).toBe(true);
    expect(csv.find((l) => l.startsWith(delivered.person.name))!.endsWith(',Delivered')).toBe(true);
  });

  it('reminder rows are not counted', async () => {
    const { notice, facToken } = await scenario();
    await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200);
    await drainOutbox();
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200)).body.delivery).toEqual(DELIVERY);
  });
});
