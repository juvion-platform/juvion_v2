import { Types } from 'mongoose';
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { Channel, Course, CourseOffering, Enrollment, Faculty, Person, Student, TimetableSlot } from '../../models';
import { ClassException } from '../../models/academic-ops/ClassException';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { drainOutbox, emit } from '../../shared/outbox';
import { CLASS_CHANGE_EVENT } from '../../modules/juvi-app/notifications/class-change';
import { runSender } from '../../modules/juvi-app/notifications/sender';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let fx: BaseFixtures;
const fake = new FakePushTransport();

const oid = () => new Types.ObjectId();
// Pin the clock. The send legs re-check start instants against `Date.now()`, so the service's clock
// has to match the fixture's, not merely agree on the date. FIXED is a Tuesday, so these offsets
// land on Tue/Wed/Sun — and `TimetableSlot.day`'s enum has no 'sunday' member (TimetableSlot.ts:14),
// which is why `seedPushWorld` clamps a Sunday-derived weekday to Monday.
// `toFake: ['Date']` only, exactly as in this task's first file. R87.
const FIXED = new Date('2026-11-10T04:00:00.000Z'); // 09:30 IST, Tuesday
const istDate = (offsetDays = 0) => new Date(FIXED.getTime() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

// This suite drives the outbox + sender directly, so it never holds the Express app;
// `getTestApp()` runs only for its side effect — it mounts the routes that register the
// notification consumers.
beforeAll(async () => { await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

interface PushWorld {
  offeringId: string;
  slotId: string;
  facultyAccountId: string;
  facultyAccountUserId: string;
  studentAccountIds: string[];
  exceptionDate: string; // the date the legs' slots and exceptions are built on
}

/**
 * One offering with two enrolled students and one teaching faculty, all on Juvi,
 * a slot and its course channel. `offsetDays` places the slot's weekday and the
 * legs' exception date (0 = college-tz today, 1 = tomorrow; the send legs use 1
 * so the send-time re-check can never see a start that has already passed).
 */
async function seedPushWorld(offsetDays: number, startTime = '14:00'): Promise<PushWorld> {
  const collegeId = fx.collegeId;
  const course = await Course.create({
    collegeId, code: 'PJ201', name: 'Push Subject',
    regulationId: oid(), departmentId: oid(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Push', phone: '9100000001', gender: 'male' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: 'FACPSH1',
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: oid(), sectionId: fx.cseSection._id,
    facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 2, status: 'active',
  });
  const exceptionDate = istDate(offsetDays);
  // `TimetableSlot.day`'s enum has no 'sunday' (TimetableSlot.ts:14), and the §8 gate reads only the
  // exception's `date` — never the slot's weekday — so a Sunday-derived day is clamped to Monday
  // rather than failing the fixture. Offset 5 is Sunday under this file's pinned Tuesday clock.
  const slotDay = dow(exceptionDate);
  const slot = await TimetableSlot.create({
    collegeId, timetableId: oid(), day: slotDay === 'sunday' ? 'monday' : slotDay, period: 2,
    startTime, endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id,
  });
  const studentAccountIds: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const p = await Person.create({ collegeId, name: `Push Student ${i}`, phone: `910000001${i}`, gender: 'female' });
    const st = await Student.create({ collegeId, personId: p._id, admissionYear: 2026, rollNumber: `26PW${i}`, status: 'active', onboardingStatus: 'not_started' });
    await Enrollment.create({ collegeId, studentId: st._id, courseOfferingId: offering._id, semesterId: oid(), status: 'enrolled', enrolledAt: new Date() });
    const acc = await JuviAccount.create({ collegeId, personId: p._id, userId: oid(), kind: 'student', studentId: st._id, status: 'active', provisionedBy: 'test' });
    studentAccountIds.push(String(acc._id));
  }
  const fAcc = await JuviAccount.create({ collegeId, personId: fPerson._id, userId: oid(), kind: 'faculty', facultyId: faculty._id, status: 'active', provisionedBy: 'test' });
  await Channel.create({
    collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
    scopeId: offering._id, name: 'PJ201', about: 'Course discussion',
    postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
  });
  return {
    offeringId: String(offering._id), slotId: String(slot._id),
    facultyAccountId: String(fAcc._id), facultyAccountUserId: String(fAcc.userId),
    studentAccountIds, exceptionDate,
  };
}

async function deviceFor(accountId: string, userId: string, token: string): Promise<void> {
  await MobileSession.create({
    collegeId: fx.collegeId, accountId: new Types.ObjectId(accountId), userId: new Types.ObjectId(userId),
    deviceId: `dev-${token}`, deviceName: 'Test Phone', platform: 'android',
    appVersion: '1.0.0', osVersion: '14', refreshTokenHash: `rh-${token}`,
    refreshExpiresAt: new Date(Date.now() + 86_400_000), pushToken: token,
  });
}

/** A ClassException placed directly (clock-independent), then its event through the real outbox. */
async function classChange(w: PushWorld, action: 'created' | 'revoked', patch: Partial<{ date: string; type: string; actorUserId: string; revoked: boolean }> = {}): Promise<string> {
  const doc = await ClassException.create({
    collegeId: fx.collegeId,
    timetableSlotId: new Types.ObjectId(w.slotId),
    courseOfferingId: new Types.ObjectId(w.offeringId),
    date: patch.date ?? w.exceptionDate,
    type: patch.type ?? 'cancelled',
    ...(patch.type === 'rescheduled' ? { newDate: istDate(2), newStartTime: '15:00', newEndTime: '16:00' } : {}), // Task 1's pre-validate requires the new* trio on a reschedule
    reason: 'Venue flooded',
    createdBy: patch.actorUserId && !patch.revoked ? new Types.ObjectId(patch.actorUserId) : oid(),
    ...(patch.revoked ? { revokedAt: new Date(), revokedBy: oid() } : {}),
  });
  const exceptionId = String(doc._id);
  await emit(CLASS_CHANGE_EVENT, { collegeId: fx.collegeId, exceptionId, action }, `class-exception:${exceptionId}:${action}`);
  // Events only — the legs' explicit runSender(new Date(), fake) is the only send pass.
  await drainOutbox({ afterEvents: false });
  return exceptionId;
}

const rowsFor = (exceptionId: string) =>
  NotificationDelivery.find({ collegeId: fx.collegeId, 'source.type': 'class_change', 'source.id': new Types.ObjectId(exceptionId) }).lean();

describe('class_change push through the real pipeline (Today&Teaching §8)', () => {
  it('a created cancellation on a today date schedules a row per eligible account', async () => {
    const w = await seedPushWorld(0); // start 14:00 IST today: inside the gate, tier important (no device send here)
    const exceptionId = await classChange(w, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source.kind === 'created' && r.status === 'scheduled')).toBe(true);
    expect(rows.every((r) => r.groupKey === `class:${w.offeringId}` && r.batchKey === 'class')).toBe(true);
    await drainOutbox(); // a re-drain must not double-write
    expect(await NotificationDelivery.countDocuments({ collegeId: fx.collegeId, 'source.type': 'class_change' })).toBe(3);
  });

  it('a reschedule fires on either affected date; an exception beyond tomorrow never fires', async () => {
    const w = await seedPushWorld(5); // beyond the window...
    const beyond = await classChange(w, 'created', { date: istDate(5) });
    expect(await rowsFor(beyond)).toHaveLength(0);
    const rescheduled = await classChange(w, 'created', { date: istDate(0), type: 'rescheduled' }); // original today, new date istDate(2) — still fires
    expect(await rowsFor(rescheduled)).toHaveLength(3);
  });

  it('the send carries the §8 payload: variant, office, when, and never the reason (NFR-05)', async () => {
    const w = await seedPushWorld(1, '10:00'); // tomorrow 10:00 IST: always a future start at send time
    const exceptionId = await classChange(w, 'created');
    await deviceFor(w.studentAccountIds[0]!, oid().toString(), 'tok-c1');
    await deviceFor(w.studentAccountIds[1]!, oid().toString(), 'tok-c2');
    await NotificationDelivery.updateMany({ collegeId: fx.collegeId, 'source.type': 'class_change' }, { $set: { sendAfter: new Date(Date.now() - 1_000) } });
    await runSender(new Date(), fake);
    expect(fake.sent).toHaveLength(2);
    const { tokens, message } = fake.sent[0]!;
    expect(tokens.length).toBeGreaterThan(0);
    const row = (await rowsFor(exceptionId)).find((r) => message.data.deliveryId === String(r._id))!;
    expect(message).toMatchObject({
      data: {
        deliveryId: String(row._id), kind: 'class_change', exceptionId, tier: 'important',
        groupKey: `class:${w.offeringId}`, office: 'PJ201', variant: 'cancelled',
      },
      priority: 'high', collapseKey: `class:${w.offeringId}`,
    });
    expect(message.data.when).toBeTypeOf('string');
    expect(message.data.newWhen).toBeUndefined();        // a cancellation has no new date
    expect(JSON.stringify(fake.sent)).not.toContain('Venue flooded');
    expect(await rowsFor(exceptionId)).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'sent' })]));
  });

  it('a revoke sends restored and cancels the stale created rows as superseded (R20 + re-check)', async () => {
    const w = await seedPushWorld(1, '10:00');
    const exceptionId = await classChange(w, 'created');
    await ClassException.updateOne({ _id: new Types.ObjectId(exceptionId) }, { $set: { revokedAt: new Date(), revokedBy: oid() } });
    await classChange(w, 'revoked', { revoked: true });
    await deviceFor(w.studentAccountIds[0]!, oid().toString(), 'tok-r1');
    await NotificationDelivery.updateMany({ collegeId: fx.collegeId, 'source.type': 'class_change' }, { $set: { sendAfter: new Date(Date.now() - 1_000) } });
    await runSender(new Date(), fake);
    expect(fake.sent.map((m) => m.message.data.variant)).toEqual(['restored']);
    const rows = await rowsFor(exceptionId);
    expect(rows.filter((r) => r.source.kind === 'created').every((r) => r.status === 'cancelled' && r.reason === 'superseded')).toBe(true);
  });

  it('the acting user\'s account is excluded', async () => {
    const w = await seedPushWorld(0);
    const exceptionId = await classChange(w, 'created', { actorUserId: w.facultyAccountUserId });
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => String(r.accountId) === w.facultyAccountId)).toBe(false);
  });
});
