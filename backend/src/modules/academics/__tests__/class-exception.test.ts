import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { AuditLog } from '../../../shared/audit';
import { OutboxEvent } from '../../../shared/outbox';
import {
  createClassException, revokeClassException, listClassExceptions, activeExceptionsFor,
  CLASS_EVENTS, classExceptionEventKey,
} from '../class-exception-service';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const CID = '000000000000000000000001';
const USER = '000000000000000000000002';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

/** A published timetable (open-ended unless `from`/`to` given) with one Monday 09:00-10:00 slot. */
async function seedSlot(opts: { from?: string; to?: string; day?: string } = {}) {
  const course = await Course.create({
    collegeId: new Types.ObjectId(CID), code: 'CS301', name: 'Databases',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 3, lectureHrs: 2, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId: new Types.ObjectId(CID), courseId: course._id, semesterId: new Types.ObjectId(),
    sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(), maxEnrollment: 60, enrolledCount: 40,
  });
  const timetable = await Timetable.create({
    collegeId: new Types.ObjectId(CID), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
    version: 1, status: 'published',
    effectiveFrom: opts.from ? new Date(`${opts.from}T00:00:00+05:30`) : new Date(),
    ...(opts.to ? { effectiveTo: new Date(`${opts.to}T00:00:00+05:30`) } : {}),
  });
  const slot = await TimetableSlot.create({
    collegeId: new Types.ObjectId(CID), timetableId: timetable._id, day: opts.day ?? 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  return { course, offering, timetable, slot };
}

/** First date ≥ today+minDays that is a `weekday` ('monday'…), in Asia/Kolkata. */
function upcoming(day: string, minDays = 2): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const want = day.slice(0, 3);
  for (let i = minDays; i < minDays + 8; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    if (weekday.format(d).toLowerCase() === want) return fmt.format(d);
  }
  throw new Error('no upcoming date');
}

describe('createClassException', () => {
  it('creates a cancellation, writes audit and emits the outbox event', async () => {
    const { slot, course, offering } = await seedSlot();
    const date = upcoming('monday');
    const row = await createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);
    expect(row.type).toBe('cancelled');
    expect(row.revokedAt).toBeNull();
    expect(String(row.courseOfferingId)).toBe(String(offering._id));

    const audits = await AuditLog.find({ entityType: 'ClassException', entityId: String(row._id) }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('create');
    expect(audits[0]!.entityName).toBe(`${course.code} on ${date}`);

    const events = await OutboxEvent.find({ type: CLASS_EVENTS.CHANGED }).lean();
    expect(events.map((e) => e.dedupeKey)).toContain(classExceptionEventKey.changed(String(row._id), 'created'));
  });

  it('rejects weekday mismatch, a 5-char-minimum reason, and duplicates, in order', async () => {
    const { slot } = await seedSlot();
    const reason = 'Faculty attending a workshop';
    const date = upcoming('monday');
    // 2026-01-01 is a Thursday; the slot is a Monday slot. Weekday fires before the past-date check.
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date: '2026-01-01', type: 'cancelled', reason,
    }, USER)).rejects.toThrow(/weekday/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason: 'nope',
    }, USER)).rejects.toThrow(/reason/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason,
    }, USER)).resolves.toBeTruthy();
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'cancelled', reason,
    }, USER)).rejects.toThrow(/already has an active exception/);
  });

  it('rejects a closed window (effectiveTo before the date)', async () => {
    const { slot } = await seedSlot({ from: '2026-01-10', to: '2026-01-20' });
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER)).rejects.toThrow(/outside the live timetable window/);
  });

  it('rejects reschedules beyond 14 days, in the past, or ending at their start', async () => {
    const { slot } = await seedSlot();
    const date = upcoming('monday');
    const tooFar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 16 * 86_400_000));
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: tooFar, newStartTime: '10:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/within 14 days/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: '2026-01-01', newStartTime: '10:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/Reschedule target date is in the past/);
    await expect(createClassException(CID, {
      timetableSlotId: String(slot._id), date, type: 'rescheduled', newDate: date, newStartTime: '11:00', newEndTime: '11:00', reason: 'Room maintenance pending',
    }, USER)).rejects.toThrow(/before newEndTime/);
  });

  it('404s for unknown slots', async () => {
    await expect(createClassException(CID, {
      timetableSlotId: new Types.ObjectId().toString(), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER)).rejects.toThrow(/not found/);
  });
});

describe('revokeClassException', () => {
  it('revokes, writes an archive audit, emits revoked; second revoke 409s', async () => {
    const { slot } = await seedSlot();
    const row = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday'), type: 'cancelled', reason: 'Faculty attending a workshop',
    }, USER);
    const revoked = await revokeClassException(CID, String(row._id), USER);
    expect(revoked.revokedAt).not.toBeNull();
    const events = await OutboxEvent.find({ type: CLASS_EVENTS.CHANGED }).lean();
    expect(events.map((e) => e.dedupeKey)).toContain(classExceptionEventKey.changed(String(row._id), 'revoked'));
    expect(await AuditLog.countDocuments({ entityId: String(row._id), action: 'archive' })).toBe(1);
    await expect(revokeClassException(CID, String(row._id), USER)).rejects.toThrow(/already revoked/);
  });

  it('404s for unknown ids', async () => {
    await expect(revokeClassException(CID, new Types.ObjectId().toString(), USER)).rejects.toThrow(/not found/);
  });
});

describe('listClassExceptions / activeExceptionsFor', () => {
  it('filters by offering/slot/range; active excludes revoked and matches date or newDate', async () => {
    const { slot, offering } = await seedSlot();
    const reason = 'Faculty attending a workshop';
    const a = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday', 2), type: 'cancelled', reason,
    }, USER);
    await revokeClassException(CID, String(a._id), USER);
    const b = await createClassException(CID, {
      timetableSlotId: String(slot._id), date: upcoming('monday', 9), type: 'rescheduled',
      newDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
      newStartTime: '14:00', newEndTime: '15:00', reason,
    }, USER);

    expect(await listClassExceptions(CID, { offeringId: String(offering._id) })).toHaveLength(2);
    expect(await listClassExceptions(CID, { slotId: String(slot._id) })).toHaveLength(2);

    const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const active = await activeExceptionsFor(CID, { dates: [todayIst] });
    // `a` is revoked; `b` matches via newDate. When today is itself a Monday this
    // still holds: the (slot, date) uniqueness is on the original date, and
    // upcoming(2,9) is never today.
    expect(active.map((x) => String(x._id))).toEqual([String(b._id)]);
    expect(await activeExceptionsFor(CID, { offeringIds: [String(offering._id)] })).toHaveLength(1);
  });
});
