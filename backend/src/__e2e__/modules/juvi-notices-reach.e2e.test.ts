import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';
import { archiveNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const GROUP = '2024 Batch · Section A';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

/**
 * A faculty publisher on Juvi and a course with four students:
 * s1, s2, s3 on Juvi (signed in), s4 still onboarding (Not on Juvi).
 */
async function scenario() {
  const fac = await provisionTestFaculty(fx);
  await activateAccount(String(fac.account._id));
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  type S = Awaited<ReturnType<typeof provisionTestStudent>> & { token: string };
  const students: S[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await createTestEnrollment(fx.collegeId, { studentId: String(s.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    if (i <= 3) await activateAccount(String(s.account._id));
    students.push({ ...s, token: i <= 3 ? await signInAs(app, fx, s.student.rollNumber, s.tempPassword, `device-s${i}`) : '' });
  }
  const notice = await publishTestNotice(fx, {
    title: 'Lab safety', ackRequired: true, ackCommentAllowed: true, ackDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] },
  }, erpRef(fac.user));
  const facToken = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'device-fac');
  const [s1, s2, s3, s4] = students as [S, S, S, S];
  return { fac, facToken, off, notice, s1, s2, s3, s4 };
}

describe('GET /notices/:id/reach (US-4.1, US-4.3, spec §6.5)', () => {
  it('reconciles acknowledged + seen + not seen + Not on Juvi to the snapshot and lists late, comments and added later separately', async () => {
    const { facToken, notice, s1, s2 } = await scenario();
    const past = new Date(Date.now() - 60_000);
    await Notice.updateOne({ _id: notice._id }, { $set: { ackDeadline: past } });
    await NoticeRecipient.updateMany({ noticeId: notice._id }, { $set: { deadline: past } });
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold', comment: 'Done' }).expect(200);
    await mobileClient(app, s2.token).post(`${V1}/notices/${notice._id}/seen`).expect(200);
    // A member who matched after publish (Task 10 creates these; inserted directly here).
    const s5 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s5.account._id));
    await NoticeRecipient.create({
      collegeId: fx.collegeId, noticeId: notice._id, personId: s5.person._id, accountId: s5.account._id, kind: 'student',
      labels: { batch: '2024 Batch', section: 'A' }, addedLater: true, ackRequired: true, deadline: past, receivedAt: new Date(), seenAt: new Date(),
    });

    const res = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    const r = res.body;
    expect(r).toMatchObject({ noticeId: String(notice._id), title: 'Lab safety', status: 'published', ackRequired: true, audience: 4, acknowledged: 1, seen: 1, notSeen: 1, notOnJuvi: 1, late: 1, reminders: { used: 0, max: 2, lastAt: null } });
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi).toBe(r.audience);
    expect(r.audience).toBe((await Notice.findById(notice._id).lean())!.counts.audience);
    expect(r.groups).toEqual([{ label: GROUP, total: 4, acknowledged: 1, seen: 1, notSeen: 1, notOnJuvi: 1 }]);
    expect(r.lateAcks).toEqual([{ name: s1.person.name, identifier: s1.student.rollNumber, group: GROUP, at: expect.any(String) }]);
    expect(r.comments).toEqual([{ name: s1.person.name, identifier: s1.student.rollNumber, group: GROUP, at: expect.any(String), comment: 'Done', late: true }]);
    expect(r.addedLater).toEqual({ total: 1, acknowledged: 0, seen: 1, items: [{ name: s5.person.name, identifier: s5.student.rollNumber, group: GROUP, at: expect.any(String), state: 'seen' }] });
    expect(r.sparkline).toHaveLength(24);
    expect(r.sparkline[23]).toBe(1);
    for (const s of [s1, s2, s5]) expect(JSON.stringify(r)).not.toContain(String(s.person._id));
  });
});

describe('GET /notices/:id/reach/pending (US-4.2)', () => {
  it('lists pending members grouped, searchable and paged, with last-seen-in-app', async () => {
    const { facToken, notice, s1, s2, s3, s4 } = await scenario();
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(200);
    await mobileClient(app, s2.token).post(`${V1}/notices/${notice._id}/seen`).expect(200);

    const all = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending`).expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.groups).toEqual([{ label: GROUP, count: 3 }]);
    const byName = new Map(all.body.items.map((p: { name: string }) => [p.name, p]));
    expect(byName.get(s2.person.name)).toMatchObject({ identifier: s2.student.rollNumber, group: GROUP, state: 'seen', lastSeenInApp: expect.any(String) });
    expect(byName.get(s3.person.name)).toMatchObject({ state: 'not_seen', lastSeenInApp: expect.any(String) });
    expect(byName.get(s4.person.name)).toMatchObject({ state: 'not_on_juvi', lastSeenInApp: null });
    expect(byName.has(s1.person.name)).toBe(false);
    expect(JSON.stringify(all.body)).not.toContain(String(s3.person._id));

    const search = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?q=${s3.student.rollNumber}`).expect(200);
    expect(search.body.items.map((p: { name: string }) => p.name)).toEqual([s3.person.name]);
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?group=${encodeURIComponent(GROUP)}`)).body.total).toBe(3);
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?group=Nobody`)).body.items).toEqual([]);

    const p1 = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?limit=2`).expect(200);
    const p2 = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?limit=2&cursor=${p1.body.nextCursor}`).expect(200);
    expect([...p1.body.items, ...p2.body.items]).toEqual(all.body.items);
    expect(p2.body.nextCursor).toBeNull();
  });
});

describe('POST /notices/:id/remind (NTC-08, US-4.4)', () => {
  it('allows two reminders, refuses a third with a reason, and stamps remindedAt on pending rows only', async () => {
    const { facToken, notice, s1 } = await scenario();
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(200);
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200)).body.reminders).toMatchObject({ used: 1, max: 2 });
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200)).body.reminders).toMatchObject({ used: 2, max: 2, lastAt: expect.any(String) });
    const third = await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(409);
    expect(third.body.error).toMatchObject({ code: 'REMINDER_LIMIT', message: expect.stringMatching(/two reminders/) });
    expect((await Notice.findById(notice._id).lean())!.reminders).toHaveLength(2);

    await drainOutbox();
    const rows = await NoticeRecipient.find({ noticeId: notice._id }).lean();
    const acked = rows.find((r) => String(r.personId) === String(s1.person._id))!;
    expect(acked.remindedAt).toBeNull();
    expect(rows.filter((r) => r.remindedAt).length).toBe(3);
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'update' })).toBe(2);
  });
});

describe('reach is for the publisher only (RCH-01, RCH-02, US-4.5)', () => {
  it('a student calling reach, pending or remind gets 403 NOT_PUBLISHER and each attempt is audited', async () => {
    const { notice, s1 } = await scenario();
    for (const [method, path] of [['get', 'reach'], ['get', 'reach/pending'], ['post', 'remind']] as const) {
      const res = await mobileClient(app, s1.token)[method](`${V1}/notices/${notice._id}/${path}`).expect(403);
      expect(res.body.error.code).toBe('NOT_PUBLISHER');
    }
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: String(notice._id), action: 'access_denied' }).lean();
    expect(audit).toHaveLength(3);
    expect(audit[0]).toMatchObject({ performedBy: s1.person.name });
    expect(audit.map((a) => (a.changes[0]!.newValue as { action: string; via: string }).action).sort()).toEqual(['reach', 'reach', 'remind']);
    expect((audit[0]!.changes[0]!.newValue as { via: string; role: string })).toMatchObject({ via: 'mobile', role: 'student' });
    // The role is checked first: a missing notice is refused (and audited) the same way.
    expect((await mobileClient(app, s1.token).get(`${V1}/notices/000000000000000000000000/reach`).expect(403)).body.error.code).toBe('NOT_PUBLISHER');
  });
});

describe('archive (NTC-09, US-2.6, spec §11)', () => {
  it('archives for the publisher or an admin, mirrors onto rows, keeps reach, and makes the notice read-only', async () => {
    const { fac, facToken, notice, s3 } = await scenario();
    const other = await provisionTestFaculty(fx);
    await expect(archiveNotice(erpActor(fx.collegeId, { id: String(other.user._id), name: 'Other', role: 'faculty' }), String(notice._id))).rejects.toMatchObject({ statusCode: 403 });
    const res = await archiveNotice(erpActor(fx.collegeId, { id: String(fac.user._id), name: 'Publisher', role: 'faculty' }), String(notice._id));
    expect(res.status).toBe('archived');
    await expect(archiveNotice(erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' }), String(notice._id))).rejects.toMatchObject({ statusCode: 409, code: 'NOTICE_ARCHIVED' });

    await drainOutbox();
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, archived: false })).toBe(0);
    expect((await mobileClient(app, s3.token).get(`${V1}/attention`)).body.dueCount).toBe(0);
    expect((await mobileClient(app, s3.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    const reach = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    expect(reach.body).toMatchObject({ status: 'archived', audience: 4, notSeen: 3, notOnJuvi: 1 });
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'archive' })).toBe(1);
  });
});
