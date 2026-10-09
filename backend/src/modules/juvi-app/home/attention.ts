/**
 * §7.4 attention items beyond notices: class changes, fee dues and assessments.
 * Notices are composed by notices/mobile-service (dueNoticeCards); this module
 * builds the ERP items the viewer is entitled to. Scoping is collegeId + the
 * caller's studentId/facultyId — never request parameters.
 */
import { Types } from 'mongoose';

import { activeExceptionsFor } from '../../academics/class-exception-service';
import { addDays, instantOf, ymd } from '../../academics/timetable-date';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Building } from '../../../models/campus/Building';
import { Room } from '../../../models/campus/Room';
import { getJuviConfig } from '../config/institution-config';
import type { MobileContext } from '../middleware/authenticate-mobile';
import type { AttentionItem } from '../notices/schemas';
import { assessmentsFor, courseChannels, duesFor, nextInvoiceDue } from './readers';

const FEE_WINDOW_DAYS = 7;                    // §7.4: next due within 7 days (or overdue)
const ASSESSMENT_WINDOW_MS = 48 * 3_600_000;  // §7.4: shown when it falls within 48 hours

/** §6: room number plus building when there is one. */
async function roomLabelOf(collegeId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const roomIds = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (roomIds.length === 0) return new Map();
  const rooms = await Room.find({ collegeId, _id: { $in: roomIds.map((v) => new Types.ObjectId(v)) } })
    .select('roomNumber buildingId').lean<{ _id: Types.ObjectId; roomNumber: string; buildingId?: Types.ObjectId }[]>();
  const buildingIds = [...new Set(rooms.map((r) => String(r.buildingId)).filter(Boolean))];
  const buildings = buildingIds.length
    ? await Building.find({ collegeId, _id: { $in: buildingIds.map((v) => new Types.ObjectId(v)) } })
        .select('name').lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const nameByBuilding = new Map(buildings.map((b) => [String(b._id), b.name]));
  return new Map(rooms.map((r) => {
    const building = nameByBuilding.get(String(r.buildingId));
    return [String(r._id), building ? `${r.roomNumber}, ${building}` : r.roomNumber];
  }));
}

/**
 * §7.4: the viewer's class changes whose original OR new date falls on
 * today or tomorrow (R14), shown until that original start has passed.
 * The item id is the exception id. A rescheduled class left its original
 * date, so deriving from day views would miss both an original-today
 * reschedule that moved beyond tomorrow and an original-beyond-tomorrow
 * reschedule whose new date is today/tomorrow — this queries the
 * exceptions directly and keeps every class whose either date is in-window
 * (Review Focus).
 */
async function classChangeItems(
  collegeId: string, ctx: MobileContext, todayDate: string, tomorrowDate: string, tz: string, now: Date,
): Promise<AttentionItem[]> {
  const exceptions = await activeExceptionsFor(collegeId, { dates: [todayDate, tomorrowDate] });
  const mine = exceptions.filter((e) => e.date === todayDate || e.date === tomorrowDate
    || e.newDate === todayDate || e.newDate === tomorrowDate); // R14: the new date counts too
  if (mine.length === 0) return [];

  const slotIds = [...new Set(mine.map((e) => String(e.timetableSlotId)))];
  const slots = await TimetableSlot.find({ collegeId, _id: { $in: slotIds.map((v) => new Types.ObjectId(v)) } })
    .select('courseOfferingId startTime roomId substituteFacultyId originalFacultyId')
    .lean<{ _id: Types.ObjectId; courseOfferingId: Types.ObjectId; startTime: string; roomId?: Types.ObjectId; substituteFacultyId?: Types.ObjectId; originalFacultyId?: Types.ObjectId }[]>();
  const slotById = new Map(slots.map((s) => [String(s._id), s]));

  const offeringIds = [...new Set(slots.map((s) => String(s.courseOfferingId)))];
  const offerings = offeringIds.length
    ? await CourseOffering.find({ collegeId, _id: { $in: offeringIds.map((v) => new Types.ObjectId(v)) } })
        .select('courseId facultyId coFacultyIds')
        .lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[] }[]>()
    : [];
  const offeringById = new Map(offerings.map((o) => [String(o._id), o]));
  const courses = offeringIds.length
    ? await Course.find({ collegeId, _id: { $in: [...new Set(offerings.map((o) => String(o.courseId)))] } })
        .select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>()
    : [];
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const [channels, roomLabels] = await Promise.all([courseChannels(collegeId, offeringIds), roomLabelOf(collegeId, [
    ...slots.map((s) => (s.roomId ? String(s.roomId) : null)),
    ...mine.map((e) => (e.newRoomId ? String(e.newRoomId) : null)),
  ])]);

  // Visibility: students see changes to offerings they are enrolled in; faculty
  // when they teach the offering or hold the slot's substitute/original seat.
  let enrolledOfferings: Set<string> = new Set();
  let myFacultyId = '';
  if (ctx.kind === 'student' && ctx.studentId) {
    const rows = await Enrollment.find({ collegeId, studentId: new Types.ObjectId(ctx.studentId), status: 'enrolled' })
      .select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
    enrolledOfferings = new Set(rows.map((r) => String(r.courseOfferingId)));
  }
  if (ctx.kind === 'faculty') myFacultyId = ctx.facultyId ?? '';

  const items: AttentionItem[] = [];
  for (const e of mine) {
    const slot = slotById.get(String(e.timetableSlotId));
    if (!slot) continue; // the slot row vanished between query and decoration
    const offering = offeringById.get(String(slot.courseOfferingId));
    if (!offering) continue;
    if (ctx.kind === 'faculty') {
      const teaches = String(offering.facultyId) === myFacultyId
        || (offering.coFacultyIds ?? []).some((c) => String(c) === myFacultyId)
        || Boolean(slot.substituteFacultyId && String(slot.substituteFacultyId) === myFacultyId)
        || Boolean(slot.originalFacultyId && String(slot.originalFacultyId) === myFacultyId);
      if (!teaches) continue;
    } else if (!enrolledOfferings.has(String(offering._id))) {
      continue;
    }
    const deadline = instantOf(e.date, slot.startTime, tz).toISOString();
    if (deadline <= now.toISOString()) continue; // shown until the original start has passed
    const course = courseById.get(String(offering.courseId));
    const roomName = e.newRoomId ? roomLabels.get(String(e.newRoomId)) : (slot.roomId ? roomLabels.get(String(slot.roomId)) : undefined);
    const channelId = channels.get(String(offering._id));
    const item: AttentionItem = {
      kind: 'class_change',
      id: String(e._id),
      type: e.type,
      offeringId: String(offering._id),
      courseCode: course?.code ?? '',
      title: course?.name ?? '',
      date: e.date,
      start: slot.startTime,
      deadline,
    };
    if (e.type === 'rescheduled') {
      item.newDate = e.newDate ?? undefined;
      item.newStart = e.newStartTime ?? undefined;
    }
    if (roomName) item.room = roomName;
    if (channelId) item.channelId = channelId;
    items.push(item);
  }
  return items;
}

/**
 * R15: the window and overdue comparisons are instant math — the origin is the
 * college-tz midnight passed in as todayMidnight (instantOf) — never string
 * comparison against 'YYYY-MM-DD' display values. A due-today item is inside
 * the window and not overdue (equal instants are not strictly before).
 */
async function feeDueItems(collegeId: string, studentId: string, todayMidnight: Date, tz: string): Promise<AttentionItem[]> {
  const dues = await duesFor(collegeId, studentId);
  const todayMs = todayMidnight.getTime();
  const windowMaxMs = todayMs + FEE_WINDOW_DAYS * 86_400_000;
  return dues.invoices.flatMap((invoice) => {
    const next = nextInvoiceDue(invoice);
    const deadlineMs = new Date(next.date).getTime();
    const overdue = deadlineMs < todayMs; // strictly before start-of-today (R15)
    const within = deadlineMs >= todayMs && deadlineMs <= windowMaxMs;
    if (!overdue && !within) return [];
    const item: AttentionItem = {
      kind: 'fee_due', id: invoice.id, invoiceNumber: invoice.invoiceNumber,
      amount: next.amount, // integer paise (R1): forwarded from duesFor — do NOT call toPaise again
      dueDate: ymd(new Date(next.date), tz), // display 'YYYY-MM-DD' the app renders (R15) — never compared
      overdue, deadline: next.date, // college-tz-midnight ISO instant (R15), comparable with R14/R16
    };
    return [item];
  });
}

async function assessmentItems(collegeId: string, studentId: string, now: Date): Promise<AttentionItem[]> {
  const rows = await assessmentsFor(collegeId, studentId, now, new Date(now.getTime() + ASSESSMENT_WINDOW_MS));
  return rows.map((a) => ({ kind: 'assessment', id: a.id, courseCode: a.courseCode, title: a.title, at: a.at, channelId: a.channelId, deadline: a.at }));
}

/** §7.4 kinds=all: the ERP items for the viewer (R30: faculty get notices + class changes only). */
export async function attentionItems(ctx: MobileContext): Promise<AttentionItem[]> {
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const changes = await classChangeItems(ctx.collegeId, ctx, todayDate, addDays(todayDate, 1), tz, now);
  const studentId = ctx.kind === 'student' ? ctx.studentId : undefined;
  if (!studentId) return changes;
  const [fees, assessments] = await Promise.all([
    feeDueItems(ctx.collegeId, studentId, instantOf(todayDate, '00:00', tz), tz),
    assessmentItems(ctx.collegeId, studentId, now),
  ]);
  return [...changes, ...fees, ...assessments];
}
