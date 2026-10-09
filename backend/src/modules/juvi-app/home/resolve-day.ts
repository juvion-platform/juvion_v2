import { Types } from 'mongoose';

import { activeExceptionsFor } from '../../academics/class-exception-service';
import {
  activeSemesterIds,
  getLiveTimetables,
  liveSlotsForDay,
  type LeanTimetableSlot,
} from '../../academics/live-timetable';
import { addDays, hhmmToMinutes, startOfDay } from '../../academics/timetable-date';
import { AcademicCalendar } from '../../../models/academic-ops/AcademicCalendar';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Section } from '../../../models/academic-structure/Section';
import { Building } from '../../../models/campus/Building';
import { Room } from '../../../models/campus/Room';
import { Person } from '../../../models/people/Person';
import { Faculty } from '../../../models/people/Faculty';
import { Channel } from '../../../models/juvi/Channel';

export type DayViewer = { kind: 'student'; studentId: string } | { kind: 'faculty'; facultyId: string };

export interface DayClass {
  offeringId: string;
  courseCode: string;
  title: string;
  section: string;
  start: string;
  end: string;
  slotType: string;
  status: 'cancelled' | 'rescheduled' | 'scheduled';
  room?: string;
  faculty?: string;
  channelId?: string;
  registered?: number;
  movedFrom?: { date: string; start: string };
}

export interface DayView {
  date: string;
  holiday?: string;
  classes: DayClass[];
}

interface EffEntry {
  offeringId: string;
  start: string;
  end: string;
  slotType: string;
  roomId: string | undefined;
  status: 'cancelled' | 'rescheduled' | 'scheduled';
  subFacultyId: string | undefined;
  movedFrom?: { date: string; start: string };
}

const asObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

/** §6: the published holiday covering this date, if any. */
async function holidayCovering(collegeId: string, date: string, timezone: string): Promise<string | undefined> {
  const dayStart = startOfDay(date, timezone);
  const dayEnd = startOfDay(addDays(date, 1), timezone);
  // findOne, not find: `find()` returns an array, and `.lean<T>()` then mangles the
  // type into a single doc — so `doc?.title` would be `undefined` at runtime and this
  // gate would never fire. Task 19's reader uses the same findOne shape.
  const doc = await AcademicCalendar.findOne({
    collegeId,
    status: 'published',
    isHoliday: true,
    startDate: { $lte: dayEnd },
    endDate: { $gte: dayStart },
  }).sort({ startDate: -1 }).lean<{ title: string } | null>();
  return doc?.title;
}

/** §6 reader for one date. Spec writes resolveDay(ctx, date); callers pass timezone from the college config. */
export async function resolveDay(
  collegeId: string,
  viewer: DayViewer,
  date: string,
  timezone: string,
): Promise<DayView> {
  const at = startOfDay(date, timezone);

  // The holiday gate runs FIRST (Review Focus #4): a published holiday hides
  // regular slots and move-ins alike.
  const holiday = await holidayCovering(collegeId, date, timezone);
  if (holiday) return { date, holiday, classes: [] };

  const active = await activeSemesterIds(collegeId);
  const poolOfferingIds = new Set<string>();
  let slotPool: LeanTimetableSlot[] = [];

  if (viewer.kind === 'student') {
    // Student classes = active-semester enrollments → offerings → the live
    // timetable slots of their sections.
    if (active.length === 0) return { date, classes: [] };
    const enrollments = await Enrollment.find({
      collegeId, studentId: viewer.studentId, status: 'enrolled', semesterId: { $in: active },
    }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
    const enrolledIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
    if (enrolledIds.length === 0) return { date, classes: [] };
    const offered = await CourseOffering.find({
      collegeId, _id: { $in: enrolledIds.map(asObjectId) },
    }).select('_id sectionId').lean<{ _id: Types.ObjectId; sectionId: Types.ObjectId }[]>();
    for (const o of offered) poolOfferingIds.add(String(o._id));
    const sectionIds = [...new Set(offered.map((o) => String(o.sectionId)))];
    const slots = await liveSlotsForDay(collegeId, sectionIds, at, timezone);
    slotPool = slots.filter((s) => poolOfferingIds.has(String(s.courseOfferingId)));
  } else {
    // Faculty classes = owned offerings' slots across ALL live sections, plus
    // slots substituting for them, minus slots they were replaced out of.
    if (active.length > 0) {
      const owned = await CourseOffering.find({
        collegeId,
        $or: [
          { facultyId: asObjectId(viewer.facultyId) },
          { coFacultyIds: asObjectId(viewer.facultyId) },
        ],
        semesterId: { $in: active },
      }).select('_id').lean<{ _id: Types.ObjectId }[]>();
      for (const o of owned) poolOfferingIds.add(String(o._id));
    }
    const live = await getLiveTimetables(collegeId, at, timezone);
    const slots = await liveSlotsForDay(collegeId, [...live.keys()], at, timezone);
    slotPool = slots.filter((s) =>
      (poolOfferingIds.has(String(s.courseOfferingId)) || String(s.substituteFacultyId ?? '') === viewer.facultyId)
      && String(s.originalFacultyId ?? '') !== viewer.facultyId);
  }

  // Exceptions for the pool: rows dated today OR moved into today (R38).
  const exceptions = poolOfferingIds.size > 0
    ? await activeExceptionsFor(collegeId, { offeringIds: [...poolOfferingIds], dates: [date] })
    : [];
  const cancellations = new Map<string, boolean>();
  const rescheduledAway = new Set<string>();
  for (const row of exceptions) {
    if (row.date === date) {
      if (row.type === 'cancelled') cancellations.set(String(row.timetableSlotId), true);
      else rescheduledAway.add(String(row.timetableSlotId));
    }
  }
  const moveIns = exceptions.filter((row) => row.type === 'rescheduled' && row.newDate === date);

  const bySlotId = new Map(slotPool.map((s) => [String(s._id), s]));
  const missingOrigins = [...new Set(moveIns
    .map((row) => String(row.timetableSlotId))
    .filter((id) => !bySlotId.has(id)))];
  const fetched = missingOrigins.length > 0
    ? await TimetableSlot.find({ collegeId, _id: { $in: missingOrigins.map(asObjectId) } })
        .select('_id courseOfferingId startTime endTime roomId slotType substituteFacultyId').lean<LeanTimetableSlot[]>()
    : [];
  for (const s of fetched) bySlotId.set(String(s._id), s);

  const effEntries: EffEntry[] = [];
  for (const slot of slotPool) {
    const sid = String(slot._id);
    if (rescheduledAway.has(sid)) continue; // vacated by a reschedule dated today
    effEntries.push({
      offeringId: String(slot.courseOfferingId),
      start: slot.startTime,
      end: slot.endTime,
      slotType: slot.slotType,
      roomId: slot.roomId ? String(slot.roomId) : undefined,
      status: cancellations.has(sid) ? 'cancelled' : 'scheduled',
      subFacultyId: slot.substituteFacultyId ? String(slot.substituteFacultyId) : undefined,
    });
  }
  for (const row of moveIns) {
    const origin = bySlotId.get(String(row.timetableSlotId));
    if (!origin) continue; // origin slot no longer exists — nothing to move in
    effEntries.push({
      offeringId: String(row.courseOfferingId),
      start: row.newStartTime ?? origin.startTime,
      end: row.newEndTime ?? origin.endTime,
      slotType: origin.slotType,
      roomId: row.newRoomId ? String(row.newRoomId) : (origin.roomId ? String(origin.roomId) : undefined),
      status: 'rescheduled',
      subFacultyId: origin.substituteFacultyId ? String(origin.substituteFacultyId) : undefined,
      movedFrom: { date: row.date, start: origin.startTime },
    });
  }
  if (effEntries.length === 0) return { date, classes: [] };
  effEntries.sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start));

  // Batch decoration: offerings → courses → sections → faculty names → rooms → channels.
  const offeringIds = [...new Set(effEntries.map((e) => e.offeringId))];
  const offerings = await CourseOffering.find({ collegeId, _id: { $in: offeringIds.map(asObjectId) } })
    .select('_id courseId sectionId facultyId enrolledCount')
    .lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; sectionId: Types.ObjectId; facultyId: Types.ObjectId; enrolledCount?: number }[]>();
  const offeringById = new Map(offerings.map((o) => [String(o._id), o]));
  const courses = await Course.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.courseId)))].map(asObjectId) } })
    .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const sections = await Section.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.sectionId)))].map(asObjectId) } })
    .select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const sectionById = new Map(sections.map((s) => [String(s._id), s]));

  const facultyIds = new Set<string>();
  for (const e of effEntries) {
    if (e.subFacultyId) facultyIds.add(e.subFacultyId);
    if (offeringById.has(e.offeringId)) facultyIds.add(String(offeringById.get(e.offeringId)!.facultyId));
  }
  const faculties = facultyIds.size > 0
    ? await Faculty.find({ collegeId, _id: { $in: [...facultyIds].map(asObjectId) } })
        .select('personId').lean<{ _id: Types.ObjectId; personId: Types.ObjectId }[]>()
    : [];
  const personIds = [...new Set(faculties.map((f) => String(f.personId)))];
  const persons = personIds.length > 0
    ? await Person.find({ _id: { $in: personIds.map(asObjectId) } }).select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const nameByFaculty = new Map<string, string>();
  const nameByPerson = new Map(persons.map((p) => [String(p._id), p.name]));
  for (const f of faculties) {
    const name = nameByPerson.get(String(f.personId));
    if (name) nameByFaculty.set(String(f._id), name);
  }

  const roomIds = [...new Set(effEntries.map((e) => e.roomId).filter((r): r is string => Boolean(r)))];
  const rooms = roomIds.length > 0
    ? await Room.find({ collegeId, _id: { $in: roomIds.map(asObjectId) } })
        .select('roomNumber buildingId').lean<{ _id: Types.ObjectId; roomNumber: string; buildingId: Types.ObjectId }[]>()
    : [];
  const roomById = new Map(rooms.map((r) => [String(r._id), r]));
  const buildingIds = [...new Set(rooms.map((r) => String(r.buildingId)))];
  const buildings = buildingIds.length > 0
    ? await Building.find({ collegeId, _id: { $in: buildingIds.map(asObjectId) } })
        .select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const buildingById = new Map(buildings.map((b) => [String(b._id), b.name]));

  const channels = poolOfferingIds.size > 0
    ? await Channel.find({
        collegeId, scopeType: 'course_offering', scopeId: { $in: offeringIds.map(asObjectId) }, status: 'active',
      }).select('scopeId').lean<{ _id: Types.ObjectId; scopeId: Types.ObjectId }[]>()
    : [];
  const channelByOffering = new Map(channels.map((c) => [String(c.scopeId), String(c._id)]));

  const classes: DayClass[] = [];
  for (const e of effEntries) {
    const offering = offeringById.get(e.offeringId);
    if (!offering) continue; // offering vanished between pool and decoration
    const course = courseById.get(String(offering.courseId));
    const section = sectionById.get(String(offering.sectionId));
    const cls: DayClass = {
      offeringId: e.offeringId,
      courseCode: course?.code ?? '',
      title: course?.name ?? '',
      section: section?.name ?? '',
      start: e.start,
      end: e.end,
      slotType: e.slotType,
      status: e.status,
    };
    if (e.roomId) {
      const room = roomById.get(e.roomId);
      const roomLabel = room
        ? (buildingById.has(String(room.buildingId)) ? `${room.roomNumber}, ${buildingById.get(String(room.buildingId))}` : room.roomNumber)
        : undefined;
      if (roomLabel) cls.room = roomLabel;
    }
    const facultyName = e.subFacultyId ? nameByFaculty.get(e.subFacultyId) : nameByFaculty.get(String(offering.facultyId));
    if (facultyName) cls.faculty = facultyName;
    const channelId = channelByOffering.get(e.offeringId);
    if (channelId) cls.channelId = channelId;
    if (e.status === 'rescheduled' && e.movedFrom) cls.movedFrom = e.movedFrom;
    if (viewer.kind === 'faculty') cls.registered = offering.enrolledCount ?? 0;
    classes.push(cls);
  }
  return { date, classes };
}

/** §6/§7.2: the first day strictly after `date` (within 14 days) that has classes. */
export async function nextTeachingDay(
  collegeId: string,
  viewer: DayViewer,
  date: string,
  timezone: string,
): Promise<DayView | undefined> {
  for (let i = 1; i <= 14; i++) {
    const view = await resolveDay(collegeId, viewer, addDays(date, i), timezone);
    if (view.classes.length > 0) return view;
  }
  return undefined;
}
