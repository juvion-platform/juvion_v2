/**
 * The live-timetable read rule (Today&Teaching §5.3 / R3): a Timetable that is
 * `status:'published'` and whose effective window covers the date; the highest
 * version wins, newest `updatedAt` on ties. Readers resolve per section;
 * nothing here mutates.
 */
import { Document, Types } from 'mongoose';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { Semester } from '../../models/academic-structure/Semester';
import { dayEnumOf, ymd } from './timetable-date';

export type LeanTimetable = Omit<InstanceType<typeof Timetable>, keyof Document> & { _id: Types.ObjectId };
export type LeanTimetableSlot = Omit<InstanceType<typeof TimetableSlot>, keyof Document> & { _id: Types.ObjectId };

/**
 * The live window is compared at DATE granularity, never by instant (R3/§5.3:
 * `effectiveFrom ≤ date ≤ (effectiveTo ?? ∞)`). A timetable whose `effectiveTo`
 * is 2026-10-10 stays live for the whole of 2026-10-10 — an instant comparison
 * would drop it from midnight onward and contradict this module's own boundary
 * test. Bounds are stored as calendar days, so a half-open day range on `at`'s
 * day is the exact test. R45.
 */
const covering = (at: Date) => {
  const dayStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  return {
    status: 'published' as const,
    effectiveFrom: { $lt: dayEnd },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: dayStart } }],
  };
};

export async function getLiveTimetable(collegeId: string, sectionId: string, at: Date): Promise<LeanTimetable | null> {
  const rows = await Timetable.find({
    collegeId, sectionId, ...covering(at),
  }).sort({ version: -1, updatedAt: -1 }).limit(1).lean<LeanTimetable[]>();
  return rows[0] ?? null;
}

export async function getLiveTimetables(collegeId: string, at: Date): Promise<Map<string, LeanTimetable>> {
  const rows = await Timetable.find({ collegeId, ...covering(at) })
    .sort({ version: -1, updatedAt: -1 })
    .lean<LeanTimetable[]>();
  // Sorted version-desc, so the FIRST row seen per section is the winner.
  const bySection = new Map<string, LeanTimetable>();
  for (const t of rows) {
    const key = String(t.sectionId);
    if (!bySection.has(key)) bySection.set(key, t);
  }
  return bySection;
}

/** Real slots (never `free`) for the sections on `at`'s zoned weekday, start-sorted, period tiebreak. */
export async function liveSlotsForDay(
  collegeId: string, sectionIds: string[], at: Date, timezone: string,
): Promise<LeanTimetableSlot[]> {
  const live = await getLiveTimetables(collegeId, at);
  const timetableIds: string[] = [];
  for (const sectionId of sectionIds) {
    const t = live.get(sectionId);
    if (t) timetableIds.push(String(t._id));
  }
  if (timetableIds.length === 0) return [];
  const slots = await TimetableSlot.find({
    collegeId, timetableId: { $in: timetableIds }, day: dayEnumOf(ymd(at, timezone)), slotType: { $ne: 'free' },
  }).lean<LeanTimetableSlot[]>();
  return slots.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.period - b.period;
  });
}

/** Ids of the college's active semesters; readers scope schedules to the current term. */
export async function activeSemesterIds(collegeId: string): Promise<string[]> {
  const rows = await Semester.find({ collegeId, status: 'active' }).select('_id').lean<{ _id: Types.ObjectId }[]>();
  return rows.map((r) => String(r._id));
}
