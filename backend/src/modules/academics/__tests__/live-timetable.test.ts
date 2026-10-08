import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Semester } from '../../../models/academic-structure/Semester';
import { getLiveTimetable, getLiveTimetables, liveSlotsForDay, activeSemesterIds } from '../live-timetable';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const cid = '000000000000000000000001';
const cidO = () => new Types.ObjectId(cid);
const semId = new Types.ObjectId();
const secId = new Types.ObjectId();
const offerId = new Types.ObjectId();

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

function createTimetable(version: number, opts: { from?: string; to?: string; status?: 'draft' | 'published' | 'archived' } = {}) {
  return Timetable.create({
    collegeId: cidO(), semesterId: semId, sectionId: secId,
    version,
    status: opts.status ?? 'published',
    effectiveFrom: opts.from ? new Date(`${opts.from}T00:00:00Z`) : new Date('2026-10-01T00:00:00Z'),
    ...(opts.to ? { effectiveTo: new Date(`${opts.to}T00:00:00Z`) } : {}),
  });
}

describe('getLiveTimetable', () => {
  it('picks the highest version among published coverings', async () => {
    await createTimetable(1);
    const v2 = await createTimetable(2);
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(v2._id));
  });

  it('falls back to the earlier covering when the newer one has not started', async () => {
    const v1 = await createTimetable(1, { from: '2026-10-01' });
    await createTimetable(2, { from: '2026-10-20' });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(v1._id));
  });

  it('excludes drafts, archived versions and expired windows', async () => {
    await createTimetable(1, { from: '2026-09-01', to: '2026-09-30' });
    await createTimetable(2, { from: '2026-10-01', to: '2026-10-31', status: 'draft' });
    await createTimetable(3, { from: '2026-10-01', status: 'archived' });
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC')).toBeNull();
  });

  it('treats window boundaries as inclusive', async () => {
    const t = await createTimetable(1, { from: '2026-10-01', to: '2026-10-10' });
    const atStart = await getLiveTimetable(cid, String(secId), new Date('2026-10-01T00:00:00Z'), 'UTC');
    const atEnd = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T03:39:00Z'), 'UTC');
    expect(String(atStart!._id)).toBe(String(t._id));
    expect(String(atEnd!._id)).toBe(String(t._id));
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-11T00:00:00Z'), 'UTC')).toBeNull();
  });

  it('breaks equal versions by newest updatedAt', async () => {
    await createTimetable(3);
    await new Promise((r) => setTimeout(r, 20));
    const newer = await createTimetable(3);
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(newer._id));
  });

  it('breaks equal versions by newest updatedAt, not by _id order', async () => {
    // The winner by `updatedAt` is inserted FIRST, so it carries the SMALLER _id: a sort
    // keyed on _id picks the other row. This test and the one above pin DIFFERENT
    // regressions — the one above catches a deleted tie-break, this one catches a
    // tie-break substituted for _id order. Keep both (R55).
    const newest = await createTimetable(3);
    await new Promise((r) => setTimeout(r, 20));
    await createTimetable(3);
    // Raw driver: bypasses Mongoose's timestamp plugin, so the bump is deterministic.
    await Timetable.collection.updateOne({ _id: newest._id }, { $currentDate: { updatedAt: true } });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(String(out!._id)).toBe(String(newest._id));
  });

  it('judges the window on the college-local day, not the instant\'s UTC day', async () => {
    // The term starts 2026-10-13 (stored at UTC midnight). Local midnight of that
    // date in IST is 2026-10-12T18:30Z, whose UTC date is the 12th — an instant-day
    // comparison would drop the term's first day; the local-day rule keeps it live. R53.
    const t = await createTimetable(1, { from: '2026-10-13' });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-12T18:30:00Z'), 'Asia/Kolkata');
    expect(String(out!._id)).toBe(String(t._id));
  });

  it('keeps the window live through its last local day and not the day after', async () => {
    // The window ends 2026-11-08, stored at UTC midnight, so its last covered LOCAL day in
    // IST is 2026-11-08. Local midnight of 11-09 in IST is 2026-11-08T18:30Z, whose UTC date
    // is still 11-08 — a UTC-day rule would keep this timetable live into 11-09 and show
    // classes the day after the term ended. The last day stays live. R53/R56.
    const t = await createTimetable(1, { from: '2026-10-01', to: '2026-11-08' });
    const lastDay = await getLiveTimetable(cid, String(secId), new Date('2026-11-07T18:30:00Z'), 'Asia/Kolkata');
    expect(String(lastDay!._id)).toBe(String(t._id));
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-11-08T18:30:00Z'), 'Asia/Kolkata')).toBeNull();
  });

  it('builds each day bound from the local day, so a DST transition cannot stretch the range', async () => {
    // 2026-03-08 is the US spring-forward day in America/New_York: local midnight of 03-08 is
    // 2026-03-08T05:00Z (EST) and of 03-09 is 2026-03-09T04:00Z (EDT) — a 23-hour local day. A
    // range built as `dayStart + 86_400_000` would put this window's dayEnd at 05:00Z and
    // wrongly cover 03-08; deriving it with `startOfDay(addDays(day, 1), timezone)` gives
    // 04:00Z and excludes it. R57.
    // The probe instant is the local EVENING of 03-08 (22:00 EDT = 02:00Z on 03-09), so its UTC
    // date (03-09) is NOT its local date (03-08). That is what makes the ANCHOR — not only the
    // step — observable here, so this test also fails if `dayStart` reverts to a UTC midnight
    // (a UTC-anchored day resolves 03-09 and wrongly covers this timetable). A probe at local
    // midnight would have UTC date == local date and hide the anchor entirely. R59.
    const t = await Timetable.create({
      collegeId: cidO(), semesterId: semId, sectionId: secId,
      version: 1, status: 'published',
      effectiveFrom: new Date('2026-03-09T04:30:00Z'), // 30 min into the local day 03-09
    });
    const dayBefore = await getLiveTimetable(cid, String(secId), new Date('2026-03-09T02:00:00Z'), 'America/New_York');
    expect(dayBefore).toBeNull();
    const firstDay = await getLiveTimetable(cid, String(secId), new Date('2026-03-09T04:00:00Z'), 'America/New_York');
    expect(String(firstDay!._id)).toBe(String(t._id));
  });
});

describe('liveSlotsForDay', () => {
  it('returns only that weekday\'s real slots of the live timetable, sorted', async () => {
    const t = await createTimetable(1);
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 1, startTime: '11:00', endTime: '12:00', courseOfferingId: offerId });
    const early = await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 2, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'tuesday', period: 1, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 3, startTime: '12:00', endTime: '13:00', courseOfferingId: offerId, slotType: 'free' });

    // 2026-10-12 is a Monday; 06:00Z is 11:30 IST.
    const slots = await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata');
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '11:00']);
    expect(String(slots[0]!._id)).toBe(String(early._id));
  });

  it('breaks equal start times by period', async () => {
    const t = await createTimetable(1);
    await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 5, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    const p2 = await TimetableSlot.create({ collegeId: cidO(), timetableId: t._id, day: 'monday', period: 2, startTime: '09:00', endTime: '10:00', courseOfferingId: offerId });
    const slots = await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata');
    expect(slots.map((s) => s.period)).toEqual([2, 5]);
    expect(String(slots[0]!._id)).toBe(String(p2._id));
  });

  it('returns nothing for a section with no live timetable', async () => {
    expect(await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata')).toEqual([]);
  });
});

describe('getLiveTimetables / activeSemesterIds', () => {
  it('maps one live timetable per section and lists only active semesters', async () => {
    await createTimetable(1);
    const map = await getLiveTimetables(cid, new Date('2026-10-10T06:00:00Z'), 'UTC');
    expect(map.size).toBe(1);

    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 1, year: 2026, startDate: new Date(), endDate: new Date(), status: 'active' });
    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 2, year: 2026, startDate: new Date(), endDate: new Date(), status: 'upcoming' });
    const ids = await activeSemesterIds(cid);
    expect(ids).toHaveLength(1);
  });
});
