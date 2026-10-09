// ERP↔Juvi parity (§11): the ERP write surface and the Juvi read surface share one truth.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestCourse, createTestCourseOffering, createTestFaculty } from '../factories/academic.factory';
import { enableJuvi, mobileClient, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, signInAs } from '../factories/notice.factory';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { Timetable, TimetableSlot } from '../../models';
import { Invoice } from '../../models/finance/Invoice';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/academics';
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
// Pin the clock. `parityWorld()` puts its slot on tomorrow's weekday and `TimetableSlot.day`'s enum
// has no 'sunday' member (TimetableSlot.ts:14), so a Saturday run creates a 'sunday' slot and throws;
// the service under test resolves /v1/today from `Date.now()`, so fixture and service must share one
// clock. FIXED is a Tuesday. `toFake: ['Date']` only. R87.
const FIXED = new Date('2026-11-10T04:00:00.000Z'); // 09:30 IST, Tuesday
beforeEach(async () => { vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterEach(() => { vi.useRealTimers(); });
afterAll(async () => { await cleanupTestApp(); });

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const tomorrowDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(FIXED.getTime() + 86_400_000));
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** One offering taught to fx.cseSection, one live timetable, and one slot dated tomorrow. */
async function parityWorld() {
  const studentFixture = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(studentFixture.account._id));
  const studentToken = await signInAs(app, fx, studentFixture.student.rollNumber, studentFixture.tempPassword);
  const course = await createTestCourse(fx.collegeId, {
    regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CSX01',
  });
  const faculty = (await createTestFaculty(fx.collegeId, { name: 'Prof. Parity' }));
  const offering = await createTestCourseOffering(fx.collegeId, {
    courseId: String(course._id), semesterId: String(fx.sem1._id),
    sectionId: String(fx.cseSection._id), facultyId: String(faculty.faculty._id),
  });
  const tomorrow = tomorrowDate();
  const tt = await Timetable.create({
    collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id,
    version: 1, status: 'published', effectiveFrom: new Date(Date.now() - 86_400_000),
  });
  const slot = await TimetableSlot.create({
    collegeId: fx.collegeId, timetableId: tt._id, day: dow(tomorrow), period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  await Enrollment.create({
    collegeId: fx.collegeId, studentId: String(studentFixture.student._id),
    courseOfferingId: String(offering._id), semesterId: String(fx.sem1._id), status: 'enrolled',
  });
  return { studentFixture, studentToken, offering, slot, tomorrow };
}

describe('ERP ↔ Juvi parity (§11)', () => {
  it('a class cancelled in the ERP is cancelled on /v1/today and a class_change attention item; revoke restores it', async () => {
    const w = await parityWorld();

    const before = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(before.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id))?.status).toBe('scheduled');

    const created = await api.as(fx.admin.token).post(`${A}/class-exceptions`)
      .send({ timetableSlotId: String(w.slot._id), date: w.tomorrow, type: 'cancelled', reason: 'Parity check: workshop day' })
      .expect(201);

    const after = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    const cancelled = after.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id));
    expect(cancelled?.status).toBe('cancelled');

    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    const item = attention.body.items.find((i: { kind: string }) => i.kind === 'class_change');
    expect(item?.id).toBe(String(created.body._id));
    expect(item?.type).toBe('cancelled');
    expect(item?.courseCode).toBe('CSX01');
    expect(item?.date).toBe(w.tomorrow);

    await api.as(fx.admin.token).delete(`${A}/class-exceptions/${String(created.body._id)}`).expect(200);
    const restored = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(restored.body.tomorrow.classes.find((c: { offeringId: string }) => c.offeringId === String(w.offering._id))?.status).toBe('scheduled');
    const attentionAfter = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    expect(attentionAfter.body.items.some((i: { kind: string; id: string }) => i.kind === 'class_change' && i.id === String(created.body._id))).toBe(false);
  });

  it('an open invoice is a fee_due attention item and a dues row on me/academics', async () => {
    const w = await parityWorld();
    const invoice = await Invoice.create({
      collegeId: fx.collegeId, studentId: String(w.studentFixture.student._id),
      invoiceNumber: 'JUVI-PARITY-1', type: 'fee', totalAmount: 15000,
      dueDate: new Date(Date.now() + 86_400_000), status: 'sent',
    });
    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    const fee = attention.body.items.find((i: { kind: string }) => i.kind === 'fee_due');
    expect(fee?.invoiceNumber).toBe('JUVI-PARITY-1');
    expect(fee?.id).toBe(String(invoice._id));
    expect(fee?.overdue).toBe(false);
    expect(fee?.amount).toBe(1500000); // 15000 ₹ in paise (R1)
    const academics = await mobileClient(app, w.studentToken).get(`${V1}/me/academics`).expect(200);
    expect(academics.body.dues.invoices.map((i: { number: string }) => i.number)).toContain('JUVI-PARITY-1');
    expect(academics.body.dues.totalOutstanding).toBe(1500000); // 15000 ₹ in paise (R1)
  });

  it('a scheduled assessment is the glance nextAssessment and an assessment attention item', async () => {
    const w = await parityWorld();
    await InternalAssessment.create({
      collegeId: fx.collegeId, courseOfferingId: String(w.offering._id), name: 'Mid-1 Parity Check', type: 'mid1',
      maxMarks: 30, weightage: 10, date: new Date(Date.now() + 36 * 60 * 60 * 1000), status: 'scheduled',
    });
    const today = await mobileClient(app, w.studentToken).get(`${V1}/today`).expect(200);
    expect(today.body.glance.nextAssessment?.courseCode).toBe('CSX01');
    const attention = await mobileClient(app, w.studentToken).get(`${V1}/attention?kinds=all`).expect(200);
    expect(attention.body.items.some((i: { kind: string; courseCode?: string }) => i.kind === 'assessment' && i.courseCode === 'CSX01')).toBe(true);
  });
});
