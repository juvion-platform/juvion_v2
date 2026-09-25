import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { Enrollment, Timetable, TimetableSlot } from '../../models';
import { Channel } from '../../models/juvi/Channel';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { nextOccurrence } from '../../modules/juvi-app/spaces/next-class';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

async function tokenFor(identifier: string, password: string, deviceId = TEST_DEVICE.id) {
  const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  const mk = async (code: string, name: string) => {
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code, name });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    return off;
  };
  const dbms = await mk('CS201', 'DBMS'); const os = await mk('CS202', 'OS');
  const tt = await Timetable.create({ collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id, status: 'published', effectiveFrom: new Date() });
  // OS is always sooner than DBMS: OS every day at 08:00, DBMS every day at 17:00.
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    await TimetableSlot.create({ collegeId: fx.collegeId, timetableId: tt._id, day, period: 1, startTime: '08:00', endTime: '09:00', courseOfferingId: os._id });
    await TimetableSlot.create({ collegeId: fx.collegeId, timetableId: tt._id, day, period: 8, startTime: '17:00', endTime: '18:00', courseOfferingId: dbms._id });
  }
  await reconcileCollege(fx.collegeId);
  return { stu, fac, dbms, os };
}

describe('GET /spaces', () => {
  it('groups in student order, orders courses by next class, and includes an emptyHint only for courses', async () => {
    const { stu, os, dbms } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.map((g: any) => g.key)).toEqual(['college', 'department', 'batch', 'courses']);
    const courses = res.body.groups[3];
    expect(courses.title).toBe('My Courses');
    // Ruling R3: wall-clock independent — derive the expected order/label from the
    // server's own `asOf` rather than hard-coding OS-before-DBMS or "08:00".
    const DAYS6 = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const asOf = new Date(res.body.asOf); // the server's clock for this response
    const TZ = 'Asia/Kolkata'; // the seeded college's Juvi timezone (see config/institution-config.ts)
    const osNext = nextOccurrence(DAYS6.map((day) => ({ day, startTime: '08:00' })), asOf, TZ)!;
    const dbmsNext = nextOccurrence(DAYS6.map((day) => ({ day, startTime: '17:00' })), asOf, TZ)!;
    const osFirst = osNext.getTime() <= dbmsNext.getTime();
    const expectedOrder = osFirst ? ['CS202 OS · A', 'CS201 DBMS · A'] : ['CS201 DBMS · A', 'CS202 OS · A'];
    expect(courses.channels.map((c: any) => c.name)).toEqual(expectedOrder);
    for (const c of courses.channels) {
      expect(c.nextClassLabel).toMatch(/^Next: (Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat) \d{2}:\d{2}$/);
    }
    const firstOffering = osFirst ? os : dbms;
    expect(courses.channels[0].id).toBe(String((await Channel.findOne({ collegeId: fx.collegeId, scopeId: firstOffering._id }).lean())!._id));
    expect(res.body.groups[0].channels[0]).toMatchObject({ name: 'JIT Test College', muted: false, archived: false, role: 'member' });
    expect(res.body.asOf).toBeTypeOf('string');
  });

  it('faculty order starts with My Courses and roles are publisher', async () => {
    const { fac } = await scenario();
    const t = await tokenFor(fac.faculty.employeeCode, fac.tempPassword, 'device-f');
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.map((g: any) => g.key)).toEqual(['courses', 'department', 'college']);
    expect(res.body.groups[0].channels.every((c: any) => c.role === 'publisher')).toBe(true);
  });

  it('a student with no registrations sees the courses group with a hint', async () => {
    await scenario();
    const other = await provisionTestStudent(fx);
    const t = await tokenFor(other.student.rollNumber, other.tempPassword, 'device-o');
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    const courses = res.body.groups.find((g: any) => g.key === 'courses');
    expect(courses.channels).toEqual([]);
    expect(courses.emptyHint).toMatch(/registrations/i);
  });

  it('reflects an ERP drop on the next refresh without a college pass', async () => {
    const { stu, dbms } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    // A second student stays enrolled in DBMS so the offering's live enrollment
    // count doesn't drop to zero when `stu` is dropped below — otherwise the
    // "empty roster" fallback in strategies.ts re-admits `stu` by section roster,
    // masking the ERP-drop path this test exercises.
    const stu2 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await createTestEnrollment(fx.collegeId, { studentId: String(stu2.student._id), courseOfferingId: String(dbms._id), semesterId: String(fx.sem1._id) });
    await Enrollment.updateOne({ collegeId: fx.collegeId, studentId: stu.student._id, courseOfferingId: dbms._id }, { $set: { status: 'dropped' } });
    // Force staleness so the inline account reconcile runs.
    const { JuviAccount } = await import('../../models/juvi/JuviAccount');
    await JuviAccount.updateOne({ _id: stu.account._id, collegeId: fx.collegeId }, { $set: { lastReconciledAt: new Date(Date.now() - 120_000) } });
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.find((g: any) => g.key === 'courses').channels.map((c: any) => c.name)).toEqual(['CS202 OS · A']);
  });

  it('archived channels collapse into an Archived group', async () => {
    const { stu } = await scenario();
    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    await reconcileCollege(fx.collegeId);
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    const archived = res.body.groups.at(-1);
    expect(archived.key).toBe('archived');
    expect(archived.channels).toHaveLength(2);
    expect(archived.channels[0].archived).toBe(true);
  });
});

describe('channel detail, mute, read', () => {
  it('returns About for a member and 404 for a non-member or another college', async () => {
    const { stu, fac, dbms } = await scenario();
    const ch = (await Channel.findOne({ collegeId: fx.collegeId, scopeId: dbms._id }).lean())!;
    const ts = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const detail = await mobileClient(app, ts).get(`${V1}/channels/${ch._id}`).expect(200);
    expect(detail.body).toMatchObject({ id: String(ch._id), name: 'CS201 DBMS · A', memberCount: 2, canPost: false, canReply: true, replyRule: 'allowed', whoCanPost: 'Course faculty', linkedObject: { type: 'course_offering', id: String(dbms._id) } });
    const tf = await tokenFor(fac.faculty.employeeCode, fac.tempPassword, 'device-f');
    expect((await mobileClient(app, tf).get(`${V1}/channels/${ch._id}`).expect(200)).body.canPost).toBe(true);

    const outsider = await provisionTestStudent(fx);
    const to = await tokenFor(outsider.student.rollNumber, outsider.tempPassword, 'device-o');
    const nf = await mobileClient(app, to).get(`${V1}/channels/${ch._id}`).expect(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    await mobileClient(app, ts).get(`${V1}/channels/000000000000000000000001`).expect(404);
    await mobileClient(app, ts).get(`${V1}/channels/not-an-id`).expect(400);
  });

  it('mute and unmute persist; mark-read stamps lastReadAt', async () => {
    const { stu, dbms } = await scenario();
    const ch = (await Channel.findOne({ collegeId: fx.collegeId, scopeId: dbms._id }).lean())!;
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    expect((await mobileClient(app, t).put(`${V1}/channels/${ch._id}/mute`).expect(200)).body).toEqual({ muted: true });
    expect((await mobileClient(app, t).get(`${V1}/spaces`)).body.groups.find((g: any) => g.key === 'courses').channels.find((c: any) => c.id === String(ch._id)).muted).toBe(true);
    expect((await mobileClient(app, t).delete(`${V1}/channels/${ch._id}/mute`).expect(200)).body).toEqual({ muted: false });
    const read = await mobileClient(app, t).post(`${V1}/channels/${ch._id}/read`).expect(200);
    expect(read.body.lastReadAt).toBeTypeOf('string');
    expect((await ChannelMembership.findOne({ collegeId: fx.collegeId, channelId: ch._id, accountId: stu.account._id }).lean())?.lastReadAt).toBeInstanceOf(Date);
  });

  it('no create, join, leave or discover routes exist', async () => {
    const { stu } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    for (const path of ['/channels', '/channels/discover']) await mobileClient(app, t).post(`${V1}${path}`).send({}).expect(404);
    await mobileClient(app, t).post(`${V1}/channels/000000000000000000000001/join`).expect(404);
    await mobileClient(app, t).delete(`${V1}/channels/000000000000000000000001`).expect(404);
  });
});
