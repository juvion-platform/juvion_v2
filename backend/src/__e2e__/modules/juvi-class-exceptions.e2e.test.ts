import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestCourse, createTestCourseOffering, createTestFaculty } from '../factories/academic.factory';
import { createTestUser } from '../factories/user.factory';
import { Timetable, TimetableSlot } from '../../models';
import { ClassException } from '../../models/academic-ops/ClassException';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/academics';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterEach(async () => { process.env.RBAC_ENFORCE = 'false'; });
afterAll(async () => { await cleanupTestApp(); });

/** The next date at least `minAhead` days out (0 = today allowed) that is a Monday, in Asia/Kolkata. */
function nextMonday(minAhead = 0): string {
  for (let add = minAhead; add < minAhead + 7; add++) {
    const probe = new Date(Date.now() + add * 86_400_000);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(probe);
    if (day === 'Mon') return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(probe);
  }
  return '';
}

async function classWorld() {
  const course = await createTestCourse(fx.collegeId, {
    regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CSX01',
  });
  const owner = await createTestFaculty(fx.collegeId, { name: 'Prof. Owner' });
  const other = await createTestFaculty(fx.collegeId, { name: 'Prof. Other' });
  const offering = await createTestCourseOffering(fx.collegeId, {
    courseId: String(course._id), semesterId: String(fx.sem1._id),
    sectionId: String(fx.cseSection._id), facultyId: String(owner.faculty._id),
  });
  const tt = await Timetable.create({
    collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id,
    version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  });
  const slot = await TimetableSlot.create({
    collegeId: fx.collegeId, timetableId: tt._id, day: 'monday', period: 1,
    startTime: '10:00', endTime: '11:00', courseOfferingId: offering._id,
  });
  // ≥+2d so the preview test's pushTier: 'none' pin can't flake into 'urgent' when today is a Monday
  return { course, owner, other, offering, slot, date: nextMonday(2) };
}

function cancelBody(slotId: string, date: string) {
  return { timetableSlotId: slotId, date, type: 'cancelled', reason: 'Faculty attending a workshop' };
}

describe('class exception permissions (§5.1/§11)', () => {
  it('office can change any class', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const res = await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    expect(res.body.type).toBe('cancelled');
    expect(res.body.timetableSlotId).toBe(String(w.slot._id));
  });

  it('a faculty member can change their own class, and no one else\'s', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const mine = await api.as(w.owner.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    expect(mine.body.date).toBe(w.date);
    const stranger = await api.as(w.other.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(403);
    expect(stranger.body).toEqual({ error: 'You can change only your own classes' });
  });

  it('a student gets 403', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    const student = await createTestUser({
      collegeId: fx.collegeId, role: 'student', personaType: 'L-STD',
      name: 'Test Student', email: 'students@test.com',
    });
    const res = await api.as(student.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(403);
    expect(res.body).toEqual({ error: 'You can change only your own classes' });
  });

  it('the overlap check surfaces through HTTP as a 400 with the detail', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    await TimetableSlot.create({
      collegeId: fx.collegeId, timetableId: w.slot.timetableId, day: 'monday', period: 2,
      startTime: '10:30', endTime: '11:30', courseOfferingId: w.offering._id,
    });
    const res = await api.as(w.owner.token).post(`${A}/class-exceptions`).send({
      timetableSlotId: String(w.slot._id), date: w.date, type: 'rescheduled',
      newDate: w.date, newStartTime: '11:00', newEndTime: '12:00', reason: 'Room maintenance pending',
    }).expect(400);
    expect(res.body.error).toMatch(/Reschedule conflicts/);
  });

  it('DELETE revokes, returns the row and writes the archive audit entry', async () => {
    const w = await classWorld();
    const created = await api.as(w.owner.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    const del = await api.as(fx.admin.token).delete(`${A}/class-exceptions/${String(created.body._id)}`).expect(200);
    expect(del.body.revokedAt).toBeTruthy();
    expect(await ClassException.countDocuments({
      collegeId: fx.collegeId, timetableSlotId: String(w.slot._id), revokedAt: { $ne: null },
    })).toBe(1);
    const archive = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'ClassException', action: 'archive' }).lean();
    expect(archive).toBeTruthy();
    const create = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'ClassException', action: 'create' }).lean();
    expect(String(create?.performedBy ?? '')).toBeTruthy();
  });

  it('preview returns counts, faculty names and the tier', async () => {
    const w = await classWorld();
    const res = await api.as(w.owner.token)
      .get(`${A}/class-exceptions/preview?slotId=${String(w.slot._id)}&date=${w.date}`).expect(200);
    expect(res.body).toMatchObject({ affectedStudents: 0, faculty: ['Prof. Owner'], pushTier: 'none' });
  });

  it('the list is scoped: a teaching caller sees only their own classes', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    const asOwner = await api.as(w.owner.token).get(`${A}/class-exceptions`).expect(200);
    expect(Array.isArray(asOwner.body)).toBe(true);
    expect(asOwner.body).toHaveLength(1);
    const asOther = await api.as(w.other.token).get(`${A}/class-exceptions`).expect(200);
    expect(asOther.body).toHaveLength(0);
    const asAdmin = await api.as(fx.admin.token).get(`${A}/class-exceptions`).expect(200);
    expect(asAdmin.body).toHaveLength(1);
  });

  it('a read-only office persona holding academics:read but not update sees the full list, not an empty one (R88)', async () => {
    const w = await classWorld();
    process.env.RBAC_ENFORCE = 'true';
    await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send(cancelBody(String(w.slot._id), w.date)).expect(201);
    // The Registrar (ST-REG) holds `academics:read` without `academics:update`
    // and has no Faculty row — the persona the old `update`-keyed viewer stranded.
    const registrar = await createTestUser({
      collegeId: fx.collegeId, role: 'staff', personaType: 'ST-REG',
      name: 'Registrar', email: 'registrar@college.test',
    });
    const res = await api.as(registrar.token).get(`${A}/class-exceptions`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].timetableSlotId).toBe(String(w.slot._id));
  });
});
