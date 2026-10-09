import { Types } from 'mongoose';

import type { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { Department } from '../../../models/academic-structure/Department';
import { Faculty } from '../../../models/people/Faculty';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Section } from '../../../models/academic-structure/Section';
import { activeSemesterIds } from '../../academics/live-timetable';
import { addDays, ymd } from '../../academics/timetable-date';
import { nextTeachingDay, resolveDay, type DayView, type DayViewer } from './resolve-day';
import {
  assessmentsFor,
  courseChannels,
  duesFor,
  juviAttendance,
  nextInvoiceDue,
  type DuesInvoice,
  type JuviAttendance,
} from './readers';
import { getJuviConfig } from '../config/institution-config';

export interface TodayResponse {
  asOf: string;
  today: DayView;
  tomorrow: DayView;
  glance: {
    attendance: { available: boolean; overallPct?: number; threshold: number; belowThreshold: boolean };
    dues: { available: boolean; totalOutstanding: number; nextDue?: { amount: number; date: string } }; // money: integer paise (R1)
    nextAssessment?: { offeringId: string; courseCode: string; title: string; at: string; channelId?: string };
  };
}

export interface TeachingResponse {
  asOf: string;
  today: DayView;
  tomorrow: DayView;
  nextTeachingDay?: DayView;
  faculty: { kind: 'regular' | 'hod' | 'adjunct' };
}

export interface DueInvoiceItem { number: string; type: string; outstanding: number; nextDue: { amount: number; date: string }; overdue: boolean } // integer paise (R1)

export interface StudentDues {
  available: boolean;
  totalOutstanding: number; // integer paise (R1)
  invoices: DueInvoiceItem[];
  lastPayment?: { amount: number; date: string }; // integer paise (R1)
  payUrl?: string;
}

export interface StudentAcademics { attendance: JuviAttendance; dues: StudentDues }

export interface CoursesTaughtItem {
  offeringId: string;
  courseCode: string;
  title: string;
  section: string;
  channelId?: string;
}

export type MeAcademicsResponse = StudentAcademics | { coursesTaught: CoursesTaughtItem[] };

const NEXT_ASSESSMENT_WINDOW_MS = 14 * 86_400_000;

function requireStudent(ctx: MobileContext): { kind: 'student'; studentId: string } {
  if (ctx.kind !== 'student' || !ctx.studentId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to students only.');
  return { kind: 'student', studentId: ctx.studentId };
}

function requireFaculty(ctx: MobileContext): { kind: 'faculty'; facultyId: string } {
  if (ctx.kind !== 'faculty' || !ctx.facultyId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to faculty only.');
  return { kind: 'faculty', facultyId: ctx.facultyId };
}

function requireNotStaff(ctx: MobileContext): string {
  if (ctx.kind === 'staff') throw new MobileApiError(403, 'FORBIDDEN', 'Available to students and faculty only.');
  if (ctx.kind === 'student') return ctx.studentId ?? '';
  return ctx.facultyId ?? '';
}

export async function homeToday(ctx: MobileContext): Promise<TodayResponse> {
  const viewer: DayViewer = requireStudent(ctx);
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const [today, tomorrow, attendance, dues, nextAssessments] = await Promise.all([
    resolveDay(ctx.collegeId, viewer, todayDate, tz),
    resolveDay(ctx.collegeId, viewer, addDays(todayDate, 1), tz),
    juviAttendance(ctx.collegeId, viewer.studentId),
    duesFor(ctx.collegeId, viewer.studentId),
    assessmentsFor(ctx.collegeId, viewer.studentId, now, new Date(now.getTime() + NEXT_ASSESSMENT_WINDOW_MS)),
  ]);

  const attendanceGlance: TodayResponse['glance']['attendance'] = {
    available: attendance.available,
    threshold: attendance.threshold,
    belowThreshold: attendance.overall.pct !== null && attendance.overall.pct < attendance.threshold,
  };
  if (attendance.overall.pct !== null) attendanceGlance.overallPct = attendance.overall.pct;

  // duesFor output is already integer paise (R1) — forward it; a second toPaise would ×100 again.
  const duesGlance: TodayResponse['glance']['dues'] = { available: dues.available, totalOutstanding: dues.total };
  if (dues.nextDue) duesGlance.nextDue = { amount: dues.nextDue.amount, date: dues.nextDue.date };

  const glance: TodayResponse['glance'] = { attendance: attendanceGlance, dues: duesGlance };
  const first = nextAssessments[0];
  if (first) {
    glance.nextAssessment = {
      offeringId: first.offeringId,
      courseCode: first.courseCode,
      title: first.title,
      at: first.at,
      channelId: first.channelId,
    };
  }
  return { asOf: now.toISOString(), today, tomorrow, glance };
}

export async function homeTeaching(ctx: MobileContext): Promise<TeachingResponse> {
  const viewer: DayViewer = requireFaculty(ctx);
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const now = new Date();
  const todayDate = ymd(now, tz);
  const [today, tomorrow, next, kind] = await Promise.all([
    resolveDay(ctx.collegeId, viewer, todayDate, tz),
    resolveDay(ctx.collegeId, viewer, addDays(todayDate, 1), tz),
    nextTeachingDay(ctx.collegeId, viewer, todayDate, tz),
    facultyKindOf(ctx.collegeId, viewer.facultyId),
  ]);
  const out: TeachingResponse = { asOf: now.toISOString(), today, tomorrow, faculty: { kind } };
  if (next) out.nextTeachingDay = next;
  return out;
}

/** §7.2: adjunct when the contract is adjunct/visiting, else hod via Department.hodId, else regular (A4). */
async function facultyKindOf(collegeId: string, facultyId: string): Promise<'regular' | 'hod' | 'adjunct'> {
  const faculty = await Faculty.findOne({ _id: facultyId, collegeId }).select('contractType').lean<{ contractType?: string } | null>();
  if (!faculty) return 'regular';
  if (faculty.contractType === 'adjunct' || faculty.contractType === 'visiting') return 'adjunct';
  const dept = await Department.findOne({ collegeId, hodId: new Types.ObjectId(facultyId) }).select('_id').lean<{ _id: unknown } | null>();
  return dept ? 'hod' : 'regular';
}

export async function meAcademics(ctx: MobileContext): Promise<MeAcademicsResponse> {
  const id = requireNotStaff(ctx);
  if (ctx.kind === 'faculty') {
    // `JuviAccount.facultyId` is neither required nor cross-validated against `kind`, so a
    // faculty-kind account can arrive with no facultyId. Without this, `coursesTaughtOf`
    // would receive '' and `new Types.ObjectId('')` would throw a BSONError → 500. Siblings
    // (requireFaculty, the student branch below) already re-check their empty id.
    if (!id) throw new MobileApiError(403, 'FORBIDDEN', 'Available to students and faculty only.');
    return { coursesTaught: await coursesTaughtOf(ctx.collegeId, id) };
  }

  const studentId = id;
  if (!studentId) throw new MobileApiError(403, 'FORBIDDEN', 'Available to students and faculty only.');
  const [cfg, attendance, dues] = await Promise.all([
    getJuviConfig(ctx.collegeId),
    juviAttendance(ctx.collegeId, studentId),
    duesFor(ctx.collegeId, studentId),
  ]);
  // duesFor output is already integer paise (R1) — forward it (see homeToday's glance note).
  const duesBlock: StudentDues = {
    available: dues.available,
    totalOutstanding: dues.total,
    invoices: dues.invoices.map((i: DuesInvoice) => {
      // nextInvoiceDue returns { invoiceId, amount, date, overdue }. A call result gets no
      // excess-property check, so forwarding it whole ships `invoiceId`/`overdue` beyond the
      // declared `{ amount, date }` — and Task 17 registers that declared shape as the contract.
      const n = nextInvoiceDue(i);
      return {
        number: i.invoiceNumber,
        type: i.type,
        outstanding: i.outstanding,
        nextDue: { amount: n.amount, date: n.date },
        overdue: i.overdue,
      };
    }),
  };
  if (dues.lastPayment) duesBlock.lastPayment = { amount: dues.lastPayment.amount, date: dues.lastPayment.date };
  if (cfg?.paymentPortalUrl) duesBlock.payUrl = cfg.paymentPortalUrl;
  return { attendance, dues: duesBlock };
}

async function coursesTaughtOf(collegeId: string, facultyId: string): Promise<CoursesTaughtItem[]> {
  const semesterIds = await activeSemesterIds(collegeId);
  if (semesterIds.length === 0) return [];
  const id = new Types.ObjectId(facultyId);
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
    $or: [{ facultyId: id }, { coFacultyIds: id }],
  }).select('_id courseId sectionId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; sectionId?: Types.ObjectId }[]>();
  if (offerings.length === 0) return [];
  const channels = await courseChannels(collegeId, offerings.map((o) => String(o._id)));
  const courses = await Course.find({
    collegeId, _id: { $in: [...new Set(offerings.map((o) => o.courseId))] },
  }).select('code name').lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const sectionIds = [...new Set(offerings.map((o) => o.sectionId).filter((s): s is Types.ObjectId => Boolean(s)))];
  const sections = sectionIds.length
    ? await Section.find({ collegeId, _id: { $in: sectionIds } }).select('name').lean<{ _id: Types.ObjectId; name?: string }[]>()
    : [];
  const sectionName = new Map(sections.map((s) => [String(s._id), s.name ?? '']));
  return offerings.map((o) => ({
    offeringId: String(o._id),
    courseCode: courseById.get(String(o.courseId))?.code ?? '',
    title: courseById.get(String(o.courseId))?.name ?? '',
    section: o.sectionId ? sectionName.get(String(o.sectionId)) ?? '' : '',
    channelId: channels.get(String(o._id)),
  }));
}
