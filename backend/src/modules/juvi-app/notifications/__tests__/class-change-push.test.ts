// backend/src/modules/juvi-app/notifications/__tests__/class-change-push.test.ts
// Today&Teaching §8: the class.exception.changed consumer, audience expansion,
// tier decision and send-time re-check.
//
// There is no College doc in this suite, so getJuviConfig falls back to the
// module default Asia/Kolkata — the fixed clocks are chosen in IST terms to pin
// the gate:
//   BASE  2026-11-10T04:00:00Z = 09:30 IST on Nov 10 (the normal case)
//   LATE  2026-11-09T20:00:00Z = 01:30 IST on Nov 10 (UTC is still on Nov 9: a
//         gate that reads the UTC day would miss IST-tomorrow Nov 11 — the RF#1 pin)
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { Course } from '../../../../models/academic-ops/Course';
import { CourseOffering } from '../../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../../models/academic-ops/Enrollment';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { Channel } from '../../../../models/juvi/Channel';
import { Faculty } from '../../../../models/people/Faculty';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../../models/juvi/ChannelMembership';
import { NotificationDelivery } from '../../../../models/juvi/NotificationDelivery';
import { drainOutbox, emit } from '../../../../shared/outbox';
import type { PushTransport } from '../transport';
import { CLASS_CHANGE_EVENT } from '../class-change';
import { registerNotificationConsumers } from '../index';
import { runSender } from '../sender';

const BASE = new Date('2026-11-10T04:00:00.000Z');
const LATE = new Date('2026-11-09T20:00:00.000Z');
const istDate = (at: Date) => new Date(at.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const datePlus = (at: Date, days: number) => new Date(at.getTime() + days * 86_400_000);
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
const oid = () => new Types.ObjectId();
const tokenTransport: PushTransport = { name: 'fake', send: async (tokens) => tokens.map((token) => ({ token, ok: true })) };

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  offeringId: string;
  slotId: string;
  /** The teaching faculty's account id and its userId — the actor-exclusion test's actor. */
  facultyAccountId: string;
  facultyAccountUserId: string;
  studentAccountIds: string[];
  channelId: string;
}

/** `toFake: ['Date']` only — faking Mongo driver timers would hang the suite. */
function useClock(at: Date): void {
  vi.useFakeTimers({ now: at, toFake: ['Date'], shouldAdvanceTime: true });
}

async function seedWorld(now: Date): Promise<World> {
  seq += 1;
  const s = seq;
  collegeId = new Types.ObjectId();
  const course = await Course.create({
    collegeId, code: `CS10${s}`, name: 'Object Oriented Programming',
    regulationId: oid(), departmentId: oid(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Push', phone: `90000${s}`, gender: 'male' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACPC${s}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: oid(), sectionId: oid(),
    facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 2, status: 'active',
  });
  const slot = await TimetableSlot.create({
    collegeId, timetableId: oid(), day: dow(istDate(now)), period: 2,
    startTime: '14:00', endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id,
  });
  const studentAccountIds: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const p = await Person.create({ collegeId, name: `Push Student ${i}`, phone: `91${s}${i}`, gender: 'female' });
    const st = await Student.create({ collegeId, personId: p._id, admissionYear: 2026, rollNumber: `26PC${s}${i}`, status: 'active', onboardingStatus: 'not_started' });
    await Enrollment.create({ collegeId, studentId: st._id, courseOfferingId: offering._id, semesterId: oid(), status: 'enrolled', enrolledAt: now });
    const acc = await JuviAccount.create({ collegeId, personId: p._id, userId: oid(), kind: 'student', studentId: st._id, status: 'active', provisionedBy: 'test' });
    studentAccountIds.push(String(acc._id));
  }
  const fAcc = await JuviAccount.create({ collegeId, personId: fPerson._id, userId: oid(), kind: 'faculty', facultyId: faculty._id, status: 'active', provisionedBy: 'test' });
  const channel = await Channel.create({
    collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
    scopeId: offering._id, name: `CS10${s}`, about: 'Course discussion',
    postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
  });
  return {
    offeringId: String(offering._id), slotId: String(slot._id),
    facultyAccountId: String(fAcc._id), facultyAccountUserId: String(fAcc.userId),
    studentAccountIds, channelId: String(channel._id),
  };
}

interface ExceptionPatch {
  date?: string;
  type?: 'cancelled' | 'rescheduled';
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  /** A slot id other than the world's main slot (e.g. the early-morning one). */
  slotId?: string;
  /** The acting user id (createdBy, or revokedBy when revoked) — that user's account must be excluded. */
  actorUserId?: string;
  revoked?: boolean;
}

/** A ClassException placed directly: the service's own validations are clock-relative, the tests set the clock. */
async function makeException(w: World, now: Date, patch: ExceptionPatch = {}): Promise<string> {
  const doc = await ClassException.create({
    collegeId,
    timetableSlotId: new Types.ObjectId(patch.slotId ?? w.slotId),
    courseOfferingId: new Types.ObjectId(w.offeringId),
    date: patch.date ?? istDate(now),
    type: patch.type ?? 'cancelled',
    ...(patch.newDate ? { newDate: patch.newDate, newStartTime: patch.newStartTime ?? '15:00', newEndTime: patch.newEndTime ?? '16:00' } : {}),
    reason: 'Venue flooded',
    createdBy: patch.actorUserId && !patch.revoked ? new Types.ObjectId(patch.actorUserId) : oid(),
    ...(patch.revoked ? { revokedAt: now, revokedBy: patch.actorUserId ? new Types.ObjectId(patch.actorUserId) : oid() } : {}),
  });
  return String(doc._id);
}

/** The event Task 4 emits, written through the real outbox and drained. */
async function pipeline(exceptionId: string, action: 'created' | 'revoked'): Promise<void> {
  await emit(CLASS_CHANGE_EVENT, { collegeId: collegeId.toString(), exceptionId, action }, `class-exception:${exceptionId}:${action}`);
  // Drain events without the sender pass: each test's explicit runSender is the only send pass.
  await drainOutbox({ afterEvents: false });
}

const rowsFor = (exceptionId: string) =>
  NotificationDelivery.find({ collegeId, 'source.type': 'class_change', 'source.id': new Types.ObjectId(exceptionId) }).lean();

describe('class-change push (Today&Teaching §8)', () => {
  beforeAll(async () => {
    await setupMongo();
    registerNotificationConsumers();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await clearCollections();
  });
  afterAll(async () => { await teardownMongo(); });

  it('a created cancellation inside the window schedules one row per eligible account, dedupe held on re-drain', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE);
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3); // two enrolled students + the teaching faculty
    expect(new Set(rows.map((r) => String(r.accountId))).size).toBe(3);
    expect(rows.every((r) => r.tier === 'important')).toBe(true); // the 14:00 start is ~4.5 h away (> 2 h)
    expect(rows.every((r) => r.status === 'scheduled' && r.reason === null)).toBe(true);
    expect(rows.every((r) => r.batchKey === 'class' && r.groupKey === `class:${w.offeringId}`)).toBe(true);
    await pipeline(exceptionId, 'created'); // the event's dedupe key: a re-drain writes nothing new
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('an exception whose only affected date is beyond tomorrow schedules nothing', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { date: istDate(datePlus(BASE, 5)) });
    await pipeline(exceptionId, 'created');
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(0);
  });

  it('a reschedule is affected by either date — original today, new date beyond tomorrow still fires', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { type: 'rescheduled', newDate: istDate(datePlus(BASE, 5)) });
    await pipeline(exceptionId, 'created');
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('the tier is urgent when the original start is today and within 2 hours, and urgent bypasses a channel mute', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    await ChannelMembership.create({ collegeId, channelId: new Types.ObjectId(w.channelId), accountId: new Types.ObjectId(w.studentAccountIds[0]!), mutedAt: BASE });
    const early = await TimetableSlot.create({
      collegeId, timetableId: oid(), day: dow(istDate(BASE)), period: 1,
      startTime: '10:30', endTime: '11:30', slotType: 'lecture', courseOfferingId: new Types.ObjectId(w.offeringId),
    });
    const exceptionId = await makeException(w, BASE, { slotId: String(early._id) }); // 10:30 IST = 05:00Z, 1 h after the clock
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.tier === 'urgent')).toBe(true);
    expect(rows.find((r) => String(r.accountId) === w.studentAccountIds[0])!.status).toBe('scheduled');
  });

  it('the acting user\'s own account is excluded from the audience', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { actorUserId: w.facultyAccountUserId });
    await pipeline(exceptionId, 'created');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(2); // the students only
    expect(rows.some((r) => String(r.accountId) === w.facultyAccountId)).toBe(false);
  });

  it('a revoked change schedules important restored rows for the same audience', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE, { revoked: true });
    await pipeline(exceptionId, 'revoked');
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source.kind === 'revoked' && r.tier === 'important' && r.status === 'scheduled')).toBe(true);
    expect(await NotificationDelivery.countDocuments({ collegeId })).toBe(3);
  });

  it('the gate reads the college timezone, not UTC (RF#1)', async () => {
    useClock(LATE); // 01:30 IST Nov 10; UTC is still on Nov 9
    const w = await seedWorld(LATE);
    // Derivation: LATE = 2026-11-09T20:00Z → IST Nov 10 01:30. IST today =
    // '2026-11-10', IST tomorrow = '2026-11-11'; a naive-UTC gate would read
    // today '2026-11-09' and tomorrow '2026-11-10'.
    const istTomorrow = istDate(datePlus(LATE, 1));  // '2026-11-11': inside the IST window, outside the naive-UTC one
    const beyond = istDate(datePlus(LATE, 2));       // '2026-11-12': the first date outside the IST window
    const fires = await makeException(w, LATE, { date: istTomorrow });
    const silent = await makeException(w, LATE, { date: beyond });
    await pipeline(fires, 'created');
    await pipeline(silent, 'created');
    expect(await rowsFor(fires)).toHaveLength(3);    // IST-tomorrow fires; a UTC-reading gate would drop it
    expect(await rowsFor(silent)).toHaveLength(0);   // nothing outside the window, even at the +2d boundary
  });

  it('the sender cancels a created row as superseded once its exception is revoked', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const exceptionId = await makeException(w, BASE);
    await pipeline(exceptionId, 'created');
    await ClassException.updateOne({ _id: new Types.ObjectId(exceptionId) }, { $set: { revokedAt: new Date(), revokedBy: oid() } });
    await runSender(new Date(), tokenTransport);
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'cancelled' && r.reason === 'superseded')).toBe(true);
  });

  it('the sender cancels a row as already_started once the original start has passed', async () => {
    useClock(BASE);
    const w = await seedWorld(BASE);
    const early = await TimetableSlot.create({
      collegeId, timetableId: oid(), day: dow(istDate(BASE)), period: 1,
      startTime: '09:00', endTime: '10:00', slotType: 'lecture', courseOfferingId: new Types.ObjectId(w.offeringId),
    });
    const exceptionId = await makeException(w, BASE, { slotId: String(early._id) }); // 09:00 IST = 03:30Z, before the clock
    await pipeline(exceptionId, 'created');
    await runSender(new Date(), tokenTransport);
    const rows = await rowsFor(exceptionId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'cancelled' && r.reason === 'already_started')).toBe(true);
  });
});
