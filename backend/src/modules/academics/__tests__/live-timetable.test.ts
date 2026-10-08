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
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'));
    expect(String(out!._id)).toBe(String(v2._id));
  });

  it('falls back to the earlier covering when the newer one has not started', async () => {
    const v1 = await createTimetable(1, { from: '2026-10-01' });
    await createTimetable(2, { from: '2026-10-20' });
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'));
    expect(String(out!._id)).toBe(String(v1._id));
  });

  it('excludes drafts, archived versions and expired windows', async () => {
    await createTimetable(1, { from: '2026-09-01', to: '2026-09-30' });
    await createTimetable(2, { from: '2026-10-01', to: '2026-10-31', status: 'draft' });
    await createTimetable(3, { from: '2026-10-01', status: 'archived' });
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'))).toBeNull();
  });

  it('treats window boundaries as inclusive', async () => {
    const t = await createTimetable(1, { from: '2026-10-01', to: '2026-10-10' });
    const atStart = await getLiveTimetable(cid, String(secId), new Date('2026-10-01T00:00:00Z'));
    const atEnd = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T03:39:00Z'));
    expect(String(atStart!._id)).toBe(String(t._id));
    expect(String(atEnd!._id)).toBe(String(t._id));
    expect(await getLiveTimetable(cid, String(secId), new Date('2026-10-11T00:00:00Z'))).toBeNull();
  });

  it('breaks equal versions by newest updatedAt', async () => {
    await createTimetable(3);
    await new Promise((r) => setTimeout(r, 20));
    const newer = await createTimetable(3);
    const out = await getLiveTimetable(cid, String(secId), new Date('2026-10-10T06:00:00Z'));
    expect(String(out!._id)).toBe(String(newer._id));
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

  it('returns nothing for a section with no live timetable', async () => {
    expect(await liveSlotsForDay(cid, [String(secId)], new Date('2026-10-12T06:00:00Z'), 'Asia/Kolkata')).toEqual([]);
  });
});

describe('getLiveTimetables / activeSemesterIds', () => {
  it('maps one live timetable per section and lists only active semesters', async () => {
    await createTimetable(1);
    const map = await getLiveTimetables(cid, new Date('2026-10-10T06:00:00Z'));
    expect(map.size).toBe(1);

    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 1, year: 2026, startDate: new Date(), endDate: new Date(), status: 'active' });
    await Semester.create({ collegeId: cidO(), academicYearId: new Types.ObjectId(), number: 2, year: 2026, startDate: new Date(), endDate: new Date(), status: 'upcoming' });
    const ids = await activeSemesterIds(cid);
    expect(ids).toHaveLength(1);
  });
});
