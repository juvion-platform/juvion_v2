import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { nextClassByOffering } from '../next-class';
import { ymd, addDays, dayEnumOf, instantOf } from '../../../academics/timetable-date';
import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';

const CID = '000000000000000000000001';
const cidO = () => new Types.ObjectId(CID);
const TZ = 'Asia/Kolkata';
const secId = new Types.ObjectId();
const offerId = new Types.ObjectId();
const userId = new Types.ObjectId('000000000000000000000002');

/**
 * Monday 2026-11-09T02:00Z = 2026-11-09 07:30 IST. Pinned so `today` is a Monday and
 * `today+14` (2026-11-23) is a Monday too — `seedSlot` hardcodes `day: 'monday'`, so without a
 * pinned clock the day+14 case would only hold on one weekday per week. 07:30 IST is chosen
 * deliberately: today's 09:00 is still AHEAD, so the R81 `at < nowMs` bound does not silently
 * skip it and tests 2-3 (which cancel/move today's occurrence) prove their point rather than
 * passing because the occurrence was already past.
 */
const FIXED = new Date('2026-11-09T02:00:00.000Z');

async function seedSlot(opts: { tt?: Partial<{ version: number; status: string; effectiveFrom: Date }> } = {}) {
  const tt = await Timetable.create({
    collegeId: cidO(), semesterId: new Types.ObjectId(), sectionId: secId,
    version: opts.tt?.version ?? 1, status: opts.tt?.status ?? 'published',
    effectiveFrom: opts.tt?.effectiveFrom ?? new Date('2026-01-01T00:00:00Z'),
  });
  const slot = await TimetableSlot.create({
    collegeId: cidO(), timetableId: tt._id, day: 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offerId,
  });
  return { tt, slot };
}

function nextMonday(): string {
  for (let add = 0; add < 7; add++) {
    const probe = new Date(Date.now() + add * 86_400_000);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(probe);
    if (day === 'Mon') return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(probe);
  }
  return '';
}

/**
 * The Monday whose 09:00 occurrence the reader must return for test 1: the earliest Monday
 * at-or-after now. The reader's horizon starts TODAY and it never returns a past occurrence
 * (R81), so on a Monday after 09:00 that is NEXT Monday, not today — `nextMonday()` above is
 * the "today or next Monday" query and is correct for tests 2-3, which cancel or move the
 * occurrence the reader would otherwise pick, but it is wrong for test 1.
 */
function nextMondayAfter(hhmm: string): string {
  let date = ymd(new Date(), TZ);
  for (let i = 0; i <= 7; i++) {
    if (dayEnumOf(date) === 'monday' && instantOf(date, hhmm, TZ).getTime() >= Date.now()) return date;
    date = addDays(date, 1);
  }
  return '';
}

beforeAll(async () => {
  // `toFake: ['Date']` only — faking the Mongo driver's timers hangs the suite.
  vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true });
  await setupMongo();
});
afterAll(async () => { await teardownMongo(); vi.useRealTimers(); });
afterEach(async () => { await clearCollections(); });

describe('nextClassByOffering on the live rule (§5.3)', () => {
  it('the highest-version published timetable covering today wins', async () => {
    // v1 also covers today AND carries its own Monday slot at 14:00, so a reader that picks the
    // wrong version cannot pass just by finding some slot: only v2's 09:00 slot satisfies the
    // assertion. (A v1 with no slots would only catch a reader that landed on an empty timetable.)
    await seedSlot({ tt: { version: 2 } });
    const v1 = await Timetable.create({
      collegeId: cidO(), semesterId: new Types.ObjectId(), sectionId: secId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    });
    await TimetableSlot.create({
      collegeId: cidO(), timetableId: v1._id, day: 'monday', period: 2,
      startTime: '14:00', endTime: '15:00', courseOfferingId: offerId,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(nextMondayAfter('09:00'), '09:00', TZ).toISOString());
  });

  it('a cancelled occurrence is skipped; the next meeting is the following week', async () => {
    const { slot } = await seedSlot();
    const mon = nextMonday();
    await ClassException.create({
      collegeId: cidO(), timetableSlotId: slot._id, courseOfferingId: offerId,
      date: mon, type: 'cancelled', reason: 'Faculty attending a workshop', createdBy: userId,
      revokedAt: null, revokedBy: null,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(addDays(mon, 7), '09:00', TZ).toISOString());
  });

  it('a rescheduled occurrence counts at its new time on its new date', async () => {
    const { slot } = await seedSlot();
    const mon = nextMonday();
    await ClassException.create({
      collegeId: cidO(), timetableSlotId: slot._id, courseOfferingId: offerId,
      date: mon, type: 'rescheduled', newDate: addDays(mon, 2), newStartTime: '11:00', newEndTime: '12:00',
      reason: 'Faculty on university duty', createdBy: userId, revokedAt: null, revokedBy: null,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(addDays(mon, 2), '11:00', TZ).toISOString());
  });

  it('draft timetables are never the source; nothing published means no entry', async () => {
    await seedSlot({ tt: { status: 'draft' } });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.has(String(offerId))).toBe(false);
  });

  // R92 boundary: the writer accepts a reschedule target through today+14 inclusive
  // (class-exception-service throws only when diffDays(newDate, today) > 14), so the reader's
  // horizon must reach that far. The timetable's effectiveFrom is midnight of today+14, so that
  // is the ONE horizon day it covers — on a 14-day horizon (today..today+13) the reader finds
  // nothing and returns an empty map, and this test fails; on 15 days it returns the 09:00 slot.
  it('a timetable whose window starts on today+14 is still inside the reader horizon', async () => {
    const target = addDays(ymd(new Date(), TZ), 14);
    const tt = await Timetable.create({
      collegeId: cidO(), semesterId: new Types.ObjectId(), sectionId: secId,
      version: 1, status: 'published', effectiveFrom: instantOf(target, '00:00', TZ),
    });
    await TimetableSlot.create({
      collegeId: cidO(), timetableId: tt._id, day: dayEnumOf(target), period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: offerId,
    });
    const out = await nextClassByOffering(CID, [String(offerId)], TZ);
    expect(out.get(String(offerId))?.toISOString()).toBe(instantOf(target, '09:00', TZ).toISOString());
  });
});
