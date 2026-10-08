/**
 * Class exceptions (Today&Teaching §4/§5). One active row per (slot, date).
 * Changes are revoke-then-create — rows are never edited or deleted. CUD writes
 * audit logs and emits `class.exception.changed` over the outbox so the Juvi
 * notification pipeline (plan task 16) reacts. Section/room conflict checks are
 * wired in by plan task 5.
 */
import { Document, Types } from 'mongoose';
import { ClassException, LeanClassException, IClassException, ClassExceptionType } from '../../models/academic-ops/ClassException';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { emit } from '../../shared/outbox/outbox';
import { getJuviConfig } from '../juvi-app/config/institution-config';
import { ymd, dayEnumOf, diffDays, hhmmToMinutes } from './timetable-date';

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

export async function listClassExceptions(
  collegeId: string, filter: { offeringId?: string; slotId?: string; from?: string; to?: string },
): Promise<LeanClassException[]> {
  const where: Record<string, unknown> = { collegeId };
  if (filter.offeringId) where.courseOfferingId = filter.offeringId;
  if (filter.slotId) where.timetableSlotId = filter.slotId;
  if (filter.from || filter.to) {
    const range: Record<string, unknown> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    where.date = range;
  }
  return ClassException.find(where).sort({ date: -1, createdAt: -1 }).limit(200).lean<LeanClassException[]>();
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
