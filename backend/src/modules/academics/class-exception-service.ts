/**
 * Class exceptions (Today&Teaching §4/§5). One active row per (slot, date).
 * Changes are revoke-then-create — rows are never edited or deleted. CUD writes
 * audit logs and emits `class.exception.changed` over the outbox so the Juvi
 * notification pipeline (plan task 16) reacts. Section/room conflict checks live
 * here (checkRescheduleConflicts). Permission (R6) and the §5.5 list viewer live
 * here; the controllers stay thin.
 */
import { Document, Types } from 'mongoose';
import { ClassException, LeanClassException, IClassException, ClassExceptionType } from '../../models/academic-ops/ClassException';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Room } from '../../models/campus/Room';
import { User } from '../../models/User';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { evaluateAccess } from '../../shared/rbac/engine';
import { personaCodesOf } from '../../shared/rbac/persona-registry';
import { emit } from '../../shared/outbox/outbox';
import { getJuviConfig } from '../juvi-app/config/institution-config';
import { getLiveTimetables } from './live-timetable';
import { ymd, dayEnumOf, diffDays, hhmmToMinutes, instantOf, overlaps } from './timetable-date';
import { classifyExceptionPushTier, ClassChangePushTier } from './push-tier';

export const CLASS_EVENTS = { CHANGED: 'class.exception.changed' } as const;
export type ClassChangeAction = 'created' | 'revoked';
export const classExceptionEventKey = {
  changed: (exceptionId: string, action: ClassChangeAction): string => `class-exception:${exceptionId}:${action}`,
};

export async function collegeTimezone(collegeId: string): Promise<string> {
  const cfg = await getJuviConfig(collegeId);
  return cfg?.timezone ?? 'Asia/Kolkata';
}

export interface ClassExceptionInput {
  timetableSlotId: string;
  date: string;
  type: ClassExceptionType;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  newRoomId?: string;
  reason: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LeanSlot = Omit<InstanceType<typeof TimetableSlot>, keyof Document> & { _id: Types.ObjectId };
type LeanTimetableOfSlot = Omit<InstanceType<typeof Timetable>, keyof Document> & { _id: Types.ObjectId };

/**
 * The validation steps run in the order the brief's numbered list gives:
 * slot → date shape → weekday → past → window → duplicate → reschedule.
 */
export async function createClassException(
  collegeId: string, input: ClassExceptionInput, performingUserId: string,
): Promise<LeanClassException> {
  const slot = await TimetableSlot.findOne({ _id: input.timetableSlotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');

  if (!DATE_RE.test(input.date)) throw new AppError(400, 'date must be YYYY-MM-DD');

  const timezone = await collegeTimezone(collegeId);
  const today = ymd(new Date(), timezone);

  if (dayEnumOf(input.date) !== slot.day) {
    throw new AppError(400, `Class date does not fall on the slot's weekday (${slot.day})`);
  }
  if (diffDays(input.date, today) < 0) throw new AppError(400, 'Class date is in the past');

  // The exception pins a specific slot, so the window check uses the slot's own
  // timetable; the live-winner rule governs reads (task 3), not this validation.
  const timetable = await Timetable.findOne({ _id: slot.timetableId, collegeId }).lean<LeanTimetableOfSlot | null>();
  if (!timetable || timetable.status !== 'published') throw new AppError(404, 'Class slot not found');

  const fromDate = ymd(timetable.effectiveFrom, timezone);
  const toDate = timetable.effectiveTo ? ymd(timetable.effectiveTo, timezone) : null;
  if (fromDate > input.date || (toDate !== null && input.date > toDate)) {
    throw new AppError(400, 'Class date lies outside the live timetable window');
  }

  const dup = await ClassException.findOne({ collegeId, timetableSlotId: input.timetableSlotId, date: input.date, revokedAt: null }).lean();
  if (dup) throw new AppError(409, 'This class already has an active exception for that date');

  let patch: Partial<IClassException> = {};
  if (input.type === 'rescheduled') {
    if (!input.newDate || !input.newStartTime || !input.newEndTime) {
      throw new AppError(400, 'A reschedule requires newDate, newStartTime and newEndTime');
    }
    if (!DATE_RE.test(input.newDate)) throw new AppError(400, 'newDate must be YYYY-MM-DD');
    if (diffDays(input.newDate, today) < 0) throw new AppError(400, 'Reschedule target date is in the past');
    if (diffDays(input.newDate, today) > 14) throw new AppError(400, 'Reschedule target must be within 14 days of today');
    if (hhmmToMinutes(input.newStartTime) >= hhmmToMinutes(input.newEndTime)) {
      throw new AppError(400, 'newStartTime must be before newEndTime');
    }
    const conflicts = await checkRescheduleConflicts(collegeId, slot, {
      date: input.date, newDate: input.newDate, newStartTime: input.newStartTime, newEndTime: input.newEndTime,
      newRoomId: input.newRoomId,
    }, timezone);
    if (conflicts.length > 0) {
      throw new AppError(400, `Reschedule conflicts: ${conflicts.map((c) => c.detail).join('; ')}`);
    }
    patch = {
      newDate: input.newDate,
      newStartTime: input.newStartTime,
      newEndTime: input.newEndTime,
      newRoomId: input.newRoomId ? new Types.ObjectId(input.newRoomId) : undefined,
    };
  }

  const doc = await ClassException.create({
    collegeId: new Types.ObjectId(collegeId),
    timetableSlotId: slot._id,
    courseOfferingId: slot.courseOfferingId,
    date: input.date,
    type: input.type,
    ...patch,
    reason: input.reason,
    createdBy: new Types.ObjectId(performingUserId),
  });

  await createAuditLog({
    collegeId,
    entityType: 'ClassException',
    entityId: String(doc._id),
    entityName: await entityName(collegeId, String(slot.courseOfferingId), input.date),
    action: 'create',
    changes: [],
    performedBy: performingUserId,
  });

  await emit(
    CLASS_EVENTS.CHANGED,
    { collegeId, exceptionId: String(doc._id), action: 'created' },
    classExceptionEventKey.changed(String(doc._id), 'created'),
  );

  return doc.toObject() as unknown as LeanClassException;
}

async function entityName(collegeId: string, offeringId: string, date: string): Promise<string> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId }).select('courseId').lean<{ courseId: Types.ObjectId } | null>();
  if (!offering) return `${offeringId} on ${date}`;
  // Scoped by collegeId: `course.code` lands in AuditLog.entityName, a collection
  // shared across colleges. `findOne({ _id, collegeId })` — not `findById(id,
  // collegeId)`, whose second argument is a projection and would filter nothing.
  const course = await Course.findOne({ _id: offering.courseId, collegeId }).lean<{ code: string } | null>();
  return `${course ? course.code : offeringId} on ${date}`;
}

export async function revokeClassException(
  collegeId: string, id: string, performingUserId: string,
): Promise<LeanClassException> {
  const doc = await ClassException.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Class exception not found');
  if (doc.revokedAt) throw new AppError(409, 'Class exception already revoked');
  doc.set({ revokedAt: new Date(), revokedBy: new Types.ObjectId(performingUserId) });
  await doc.save();
  const lean = doc.toObject() as unknown as LeanClassException;

  await createAuditLog({
    collegeId, entityType: 'ClassException', entityId: String(doc._id),
    entityName: `exception on ${doc.date}`, action: 'archive', changes: [], performedBy: performingUserId,
  });
  await emit(
    CLASS_EVENTS.CHANGED,
    { collegeId, exceptionId: String(doc._id), action: 'revoked' },
    classExceptionEventKey.changed(String(doc._id), 'revoked'),
  );
  return lean;
}

export async function getClassException(collegeId: string, id: string): Promise<LeanClassException> {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'Class exception not found');
  const row = await ClassException.findOne({ _id: id, collegeId }).lean<LeanClassException | null>();
  if (!row) throw new AppError(404, 'Class exception not found');
  return row;
}

export async function listClassExceptions(
  collegeId: string,
  filter: { offeringId?: string; slotId?: string; from?: string; to?: string; viewerFacultyId?: string },
): Promise<ClassExceptionRow[]> {
  const where: Record<string, unknown> = { collegeId };
  if (filter.offeringId) where.courseOfferingId = filter.offeringId;
  if (filter.slotId) where.timetableSlotId = filter.slotId;
  if (filter.from || filter.to) {
    const range: Record<string, unknown> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    where.date = range;
  }
  if (filter.viewerFacultyId) {
    const ownOfferings = await CourseOffering.find({
      collegeId,
      $or: [{ facultyId: filter.viewerFacultyId }, { coFacultyIds: filter.viewerFacultyId }],
    }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    const ownSlots = await TimetableSlot.find({
      collegeId, substituteFacultyId: filter.viewerFacultyId,
    }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    if (ownOfferings.length === 0 && ownSlots.length === 0) return []; // theirs only, and they own nothing
    where.$or = [
      { courseOfferingId: { $in: ownOfferings.map((o) => o._id) } },
      { timetableSlotId: { $in: ownSlots.map((s) => s._id) } },
    ];
  }
  const rows = await ClassException.find(where).sort({ date: -1, createdAt: -1 }).limit(200)
    .lean<LeanClassException[]>();
  return decorateClassExceptions(collegeId, rows);
}

export type ClassChangeActor = { id: string; role: string; personaType?: string; personas?: string[] };
export type ClassChangeBasis = 'faculty' | 'office';

/** The caller's Faculty row (ERP User → Person → Faculty), or null when they are not a teaching person. */
async function actingFacultyId(collegeId: string, actor: ClassChangeActor): Promise<string | null> {
  const user = await User.findOne({ _id: actor.id, collegeId }).select('personId').lean<{ personId?: Types.ObjectId } | null>();
  if (!user?.personId) return null;
  const faculty = await Faculty.findOne({ collegeId, personId: user.personId }).select('_id').lean<{ _id: Types.ObjectId } | null>();
  return faculty ? String(faculty._id) : null;
}

/** True when the faculty member owns the class: the offering's faculty, a co-faculty, or the slot's substitute. */
async function ownsOfferingOrSlot(
  collegeId: string, offeringId: string, fid: string, slotId?: string,
): Promise<boolean> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId })
    .select('facultyId coFacultyIds').lean<{ facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>();
  if (!offering) return false;
  if (String(offering.facultyId) === fid || (offering.coFacultyIds ?? []).some((id) => String(id) === fid)) return true;
  if (!slotId) return false;
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId })
    .select('substituteFacultyId').lean<{ substituteFacultyId?: Types.ObjectId } | null>();
  return Boolean(slot?.substituteFacultyId && String(slot.substituteFacultyId) === fid);
}

/**
 * §5.1 permission (R6: RBAC off → office; teaching callers are decided by
 * ownership alone — their default academics:update policy does not widen it;
 * non-teaching callers fall to the academics:update policy; anything else 403).
 */
export async function assertClassChangePermission(
  collegeId: string, actor: ClassChangeActor, offeringId: string, slotId?: string,
): Promise<ClassChangeBasis> {
  if (process.env.RBAC_ENFORCE === 'false') return 'office'; // dev bypass, matches authorize()
  const fid = await actingFacultyId(collegeId, actor);
  if (fid !== null) {
    const own = await ownsOfferingOrSlot(collegeId, offeringId, fid, slotId);
    if (own) return 'faculty';
    throw new AppError(403, 'You can change only your own classes');
  }
  const policy = await evaluateAccess(collegeId, actor.role, personaCodesOf(actor), 'academics', 'update');
  if (policy) return 'office';
  throw new AppError(403, 'You can change only your own classes');
}

/** Create-path variant: resolve the slot first, then decide on it; 404 for an unknown slot. */
export interface SlotChangeCheck { slot: LeanSlot; basis: ClassChangeBasis }
export async function assertClassChangePermissionForSlot(
  collegeId: string, actor: ClassChangeActor, slotId: string,
): Promise<SlotChangeCheck> {
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');
  const basis = await assertClassChangePermission(collegeId, actor, String(slot.courseOfferingId), slotId);
  return { slot, basis };
}

export interface ClassExceptionViewer { isOffice: boolean; facultyId?: string }

/** List scoping (§5.5): teaching callers see only their own classes; office callers see everything. */
export async function listClassExceptionViewer(collegeId: string, actor: ClassChangeActor): Promise<ClassExceptionViewer> {
  if (process.env.RBAC_ENFORCE === 'false') return { isOffice: true };
  const fid = await actingFacultyId(collegeId, actor);
  if (fid) return { isOffice: false, facultyId: fid };
  const policy = await evaluateAccess(collegeId, actor.role, personaCodesOf(actor), 'academics', 'update');
  return policy ? { isOffice: true } : { isOffice: false };
}

export interface ClassExceptionRow extends LeanClassException {
  courseCode: string;
  courseName: string;
  createdByName: string;
}

/** §5.5 list decoration: course code/name and who made each change. */
async function decorateClassExceptions(collegeId: string, rows: LeanClassException[]): Promise<ClassExceptionRow[]> {
  const offeringIds = [...new Set(rows.map((r) => String(r.courseOfferingId)))];
  const offerings = offeringIds.length === 0 ? [] : await CourseOffering.find({ _id: { $in: offeringIds }, collegeId })
    .select('courseId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];
  const courses = courseIds.length === 0 ? [] : await Course.find({ _id: { $in: courseIds }, collegeId })
    .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseByOffering = new Map(offerings.map((o) => [String(o._id), String(o.courseId)]));
  const byCourse = new Map(courses.map((c) => [String(c._id), c]));
  const users = rows.length === 0 ? [] : await User.find({ _id: { $in: rows.map((r) => r.createdBy) }, collegeId })
    .select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const nameByUser = new Map(users.map((u) => [String(u._id), u.name]));
  return rows.map((r) => {
    const courseId = courseByOffering.get(String(r.courseOfferingId));
    const course = courseId ? byCourse.get(courseId) : undefined;
    return {
      ...r,
      courseCode: course?.code ?? 'Unknown',
      courseName: course?.name ?? 'Unknown',
      createdByName: nameByUser.get(String(r.createdBy)) ?? 'Unknown',
    };
  });
}

export async function activeExceptionsFor(
  collegeId: string, selector: { slotIds?: string[]; offeringIds?: string[]; dates?: string[] },
): Promise<LeanClassException[]> {
  const where: Record<string, unknown> = { collegeId, revokedAt: null };
  const clauses: Record<string, unknown>[] = [];
  if (selector.slotIds?.length) clauses.push({ timetableSlotId: { $in: selector.slotIds } });
  if (selector.dates?.length) clauses.push({ $or: [{ date: { $in: selector.dates } }, { newDate: { $in: selector.dates } }] });
  if (selector.offeringIds?.length) clauses.push({ courseOfferingId: { $in: selector.offeringIds } });
  if (clauses.length > 0) where.$and = clauses;
  return ClassException.find(where).sort({ date: 1 }).limit(500).lean<LeanClassException[]>();
}

export interface RescheduleConflict { kind: 'section_overlap' | 'room_occupied'; detail: string }

/** courseId → course code, for conflict detail strings. */
async function offeringCodes(collegeId: string, offeringIds: string[]): Promise<Map<string, string>> {
  if (offeringIds.length === 0) return new Map();
  const offerings = await CourseOffering.find({ _id: { $in: offeringIds }, collegeId }).select('courseId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];
  const courses = await Course.find({ _id: { $in: courseIds }, collegeId }).select('code').lean<{ _id: Types.ObjectId; code: string }[]>();
  const codeByCourse = new Map(courses.map((c) => [String(c._id), c.code]));
  const out = new Map<string, string>();
  for (const o of offerings) out.set(String(o._id), codeByCourse.get(String(o.courseId)) ?? 'another class');
  return out;
}

async function sectionOf(collegeId: string, slot: LeanSlot): Promise<string | null> {
  const tt = await Timetable.findOne({ _id: slot.timetableId, collegeId }).select('sectionId').lean<{ sectionId: Types.ObjectId } | null>();
  return tt ? String(tt.sectionId) : null;
}

/**
 * The real conflict check the `detectTimetableConflicts` route placeholder stood
 * for (R2). Rescheduling into `newDate`/[newStartTime, newEndTime): no other
 * class of the same section overlaps, and the target room (newRoomId ?? the
 * slot's room) is free of every other class on that day. That day's own
 * exceptions apply — cancellations and moves-away vacate, moves-in occupy. The
 * moving slot's own occurrence is excluded everywhere (R28).
 */
export async function checkRescheduleConflicts(
  collegeId: string, slot: LeanSlot,
  r: { date: string; newDate: string; newStartTime: string; newEndTime: string; newRoomId?: string },
  timezone: string,
): Promise<RescheduleConflict[]> {
  const weekday = dayEnumOf(r.newDate);
  const at = instantOf(r.newDate, '09:00', timezone); // any instant inside that zoned day
  const live = await getLiveTimetables(collegeId, at, timezone);
  const winnerIds = [...live.values()].map((t) => String(t._id));
  const daySlots = winnerIds.length === 0
    ? []
    : await TimetableSlot.find({
        collegeId, timetableId: { $in: winnerIds }, day: weekday, slotType: { $ne: 'free' },
      }).lean<LeanSlot[]>();

  const exceptions = await activeExceptionsFor(collegeId, { dates: [r.newDate] });
  const vacated = new Set(exceptions.map((e) => String(e.timetableSlotId)));

  type Occ = { occSlotId: string; roomId: string | null; start: string; end: string; code: string; offeringId: string };
  const occs: Occ[] = [];
  for (const s of daySlots) {
    if (vacated.has(String(s._id))) continue;          // cancelled on newDate, or moved away
    if (String(s._id) === String(slot._id)) continue;  // the moving slot's own occurrence (R28)
    occs.push({ occSlotId: String(s._id), roomId: s.roomId ? String(s.roomId) : null, start: s.startTime, end: s.endTime, code: '', offeringId: String(s.courseOfferingId) });
  }
  for (const e of exceptions) {
    // `dates` matches `date` OR `newDate` (R38), so this set also holds rows that moved
    // AWAY to a different day — only a row landing on the analysed day is a move-in. R47.
    if (e.type !== 'rescheduled' || e.newDate !== r.newDate || !e.newStartTime || !e.newEndTime) continue;
    const occSlot = daySlots.find((s) => String(s._id) === String(e.timetableSlotId));
    // `daySlots` holds ONE weekday across the live timetables, so a row moved in from another
    // weekday has no entry there — and neither does one whose timetable is no longer the live
    // winner. Its room must then come from the stored slot itself; leaving the fallback to
    // resolve to null would let the row occupy no room and block nothing (R28).
    let originRoomId: string | null = occSlot?.roomId ? String(occSlot.roomId) : null;
    if (!originRoomId) {
      const origin = await TimetableSlot.findOne({ _id: e.timetableSlotId, collegeId })
        .select('roomId').lean<{ roomId?: Types.ObjectId } | null>();
      originRoomId = origin?.roomId ? String(origin.roomId) : null;
    }
    occs.push({
      occSlotId: String(e.timetableSlotId),
      roomId: e.newRoomId ? String(e.newRoomId) : originRoomId,
      start: e.newStartTime, end: e.newEndTime, code: '', offeringId: String(e.courseOfferingId),
    });
  }
  const codes = await offeringCodes(collegeId, [...new Set(occs.map((o) => o.offeringId))]);
  for (const occ of occs) occ.code = codes.get(occ.offeringId) ?? 'another class';

  const conflicts: RescheduleConflict[] = [];

  // 1. Same-section overlap: the moving slot's section's live slots. Move-ins from
  //    other sections are room-wide, not section-wise.
  const sectionId = await sectionOf(collegeId, slot);
  const sectionWinner = sectionId ? live.get(sectionId) : undefined;
  if (sectionWinner) {
    const sectionSlotIds = new Set(
      daySlots.filter((s) => String(s.timetableId) === String(sectionWinner._id)).map((s) => String(s._id)),
    );
    for (const occ of occs) {
      if (!sectionSlotIds.has(occ.occSlotId)) continue;
      if (overlaps(r.newStartTime, r.newEndTime, occ.start, occ.end)) {
        conflicts.push({ kind: 'section_overlap', detail: `${occ.code} ${occ.start}–${occ.end} (same section)` });
      }
    }
  }

  // 2. Room occupancy across sections; no target room → nothing to check.
  const roomId = r.newRoomId ?? (slot.roomId ? String(slot.roomId) : null);
  if (roomId) {
    const busy = await Room.findOne({ _id: roomId, collegeId }).select('roomNumber').lean<{ roomNumber: string } | null>();
    const roomNumber = busy?.roomNumber ?? 'another room';
    for (const occ of occs) {
      if (occ.roomId === roomId && overlaps(r.newStartTime, r.newEndTime, occ.start, occ.end)) {
        conflicts.push({ kind: 'room_occupied', detail: `Room ${roomNumber} is taken by ${occ.code} ${occ.start}–${occ.end}` });
      }
    }
  }
  return conflicts;
}

export interface ClassExceptionPreview {
  slotId: string;
  date: string;
  newDate?: string;
  affectedStudents: number;
  faculty: string[];
  pushTier: ClassChangePushTier;
}

/** §5.1 dialog preview: how many students, which faculty, and what push tier the change triggers. */
export async function previewClassException(
  collegeId: string, slotId: string, date: string, now: Date = new Date(), newDate?: string,
): Promise<ClassExceptionPreview> {
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId }).lean<LeanSlot | null>();
  if (!slot) throw new AppError(404, 'Class slot not found');
  const timezone = await collegeTimezone(collegeId);

  const [affectedStudents, faculty] = await Promise.all([
    Enrollment.countDocuments({ collegeId, courseOfferingId: slot.courseOfferingId, status: 'enrolled' }),
    facultyNames(collegeId, slot),
  ]);

  return {
    slotId, date,
    ...(newDate ? { newDate } : {}),
    affectedStudents,
    faculty,
    pushTier: classifyExceptionPushTier(date, slot.startTime, newDate ? [date, newDate] : [date], now, timezone),
  };
}

/** Display names for the occurrence's faculty: the substitution first, then the offering's. */
async function facultyNames(collegeId: string, slot: LeanSlot): Promise<string[]> {
  const offering = await CourseOffering.findOne({ _id: slot.courseOfferingId, collegeId }).select('facultyId coFacultyIds').lean<{ facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] } | null>();
  const ids: string[] = [];
  if (slot.substituteFacultyId) ids.push(String(slot.substituteFacultyId));
  if (offering) ids.push(String(offering.facultyId), ...(offering.coFacultyIds ?? []).map(String));
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await Faculty.find({ _id: { $in: unique }, collegeId }).select('personId').lean<{ _id: Types.ObjectId; personId: Types.ObjectId }[]>();
  const people = await Person.find({ _id: { $in: rows.map((r) => r.personId) }, collegeId }).select('name').lean<{ _id: Types.ObjectId; name: string }[]>();
  const nameByPerson = new Map(people.map((p) => [String(p._id), p.name]));
  const personByFaculty = new Map(rows.map((r) => [String(r._id), String(r.personId)]));
  return unique
    .map((fid) => {
      const pid = personByFaculty.get(fid);
      return pid ? nameByPerson.get(pid) ?? '' : '';
    })
    .filter((name) => name.length > 0);
}
