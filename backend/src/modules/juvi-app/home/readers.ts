import { Types } from 'mongoose';

import { attendanceFor as erpAttendanceFor, attendanceAvailableFor, type CourseAttendance } from '../../academics/attendance-formula';
import { activeSemesterIds } from '../../academics/live-timetable';
import { instantOf, ymd } from '../../academics/timetable-date';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { ExamSchedule } from '../../../models/academic-ops/ExamSchedule';
import { InternalAssessment } from '../../../models/academic-ops/InternalAssessment';
import { Invoice } from '../../../models/finance/Invoice';
import { Payment } from '../../../models/finance/Payment';
import { PaymentPlan } from '../../../models/finance/PaymentPlan';
import { Channel } from '../../../models/juvi/Channel';
import { getJuviConfig } from '../config/institution-config';
import { toPaise } from './money';

// ---- attendance (§7.3 attendance block) ----------------------------------------

export interface JuviAttendanceCourse extends Omit<CourseAttendance, 'threshold'> {
  channelId?: string;
}

export interface JuviAttendance {
  available: boolean;
  threshold: number;
  showHeadroom: boolean;
  /** §7.3 nests the overall; pct is a nullable scalar (Foundation R57/R61), null exactly when held is 0 (R13). */
  overall: { held: number; attended: number; pct: number | null };
  courses: JuviAttendanceCourse[];
}

export async function juviAttendance(collegeId: string, studentId: string): Promise<JuviAttendance> {
  const [cfg, erp, available] = await Promise.all([
    getJuviConfig(collegeId),
    erpAttendanceFor(collegeId, studentId),
    attendanceAvailableFor(collegeId),
  ]);
  const showHeadroom = cfg?.showAttendanceHeadroom ?? true;
  const offeringIds = erp.courses.map((c) => c.offeringId);
  const channelByOffering = await courseChannels(collegeId, offeringIds);
  return {
    available,
    threshold: erp.threshold,
    showHeadroom,
    overall: { held: erp.held, attended: erp.attended, pct: erp.overallPct },
    courses: erp.courses.map(({ threshold: _t, ...c }) => ({ // R42: threshold stays ERP-internal (§7.3 names it once, at the top level)
      ...c,
      headroom: showHeadroom ? c.headroom : 0,
      channelId: channelByOffering.get(c.offeringId),
    })),
  };
}

/** R18: the active course channel for each offering, when one exists. */
export async function courseChannels(
  collegeId: string,
  offeringIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (offeringIds.length === 0) return map;
  const rows = await Channel.find({
    collegeId,
    scopeType: 'course_offering',
    scopeId: { $in: offeringIds.map((id) => new Types.ObjectId(id)) },
    status: 'active',
  }).select('scopeId').lean<{ _id: Types.ObjectId; scopeId: Types.ObjectId }[]>();
  for (const row of rows) map.set(String(row.scopeId), String(row._id));
  return map;
}

// ---- dues (§7.3 dues block) ------------------------------------------------------

export interface DuesInstalment {
  id: string;
  amount: number; // integer paise (R1)
  dueDate: string; // the due date at college-tz midnight, as an ISO instant — not a 'YYYY-MM-DD' string (R15)
  paid: boolean;
  overdue: boolean;
}

export interface DuesInvoice {
  id: string;
  invoiceNumber: string;
  type: string;
  amount: number;      // netPayable ?? totalAmount, integer paise (R1)
  outstanding: number; // integer paise (R1)
  dueDate: string; // the due date at college-tz midnight, as an ISO instant — not a 'YYYY-MM-DD' string (R15)
  overdue: boolean;
  instalments: DuesInstalment[];
}

/** The invoice's next due: the first unpaid instalment, else its dueDate + outstanding (§6). The returned `date` is a college-tz-midnight ISO instant (R15). */
export function nextInvoiceDue(invoice: DuesInvoice): { invoiceId: string; amount: number; date: string; overdue: boolean } {
  const unpaid = invoice.instalments.find((i) => !i.paid) ?? null;
  if (unpaid) return { invoiceId: invoice.id, amount: unpaid.amount, date: unpaid.dueDate, overdue: unpaid.overdue };
  return { invoiceId: invoice.id, amount: invoice.outstanding, date: invoice.dueDate, overdue: invoice.overdue };
}

export interface JuviDues {
  available: boolean;
  invoiceCount: number;
  total: number; // integer paise (R1) — downstream surfaces forward this, never re-convert
  invoices: DuesInvoice[];
  nextDue: { invoiceId: string; amount: number; date: string; overdue: boolean } | null; // date: college-tz-midnight ISO instant (R15)
  lastPayment: { invoiceId: string; amount: number; date: string; receiptNumber: string } | null;
}

/** R1: money enters and leaves this reader in integer paise (toPaise from './money'). */

/** R5: OPEN = anything not closed out. Draft is not due; paid/written-off/cancelled are done. */
const OPEN_STATUSES = ['generated', 'sent', 'partially_paid', 'overdue', 'disputed', 'confirmed'] as const;

// Raw DB rows are ERP-side: every `amount` below is rupees — converted once by toPaise.
interface RawInvoice {
  _id: Types.ObjectId;
  invoiceNumber: string;
  type: string;
  totalAmount: number; // rupees (ERP)
  netPayable?: number | null;
  dueDate: Date;
}

interface RawPayment {
  _id: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  amount: number; // rupees (ERP)
  receiptNumber: string;
  paymentDate: Date;
}

interface RawInstalment {
  dueDate: Date;
  amount: number; // rupees (ERP)
  status: string;
}

export async function duesFor(collegeId: string, studentId: string): Promise<JuviDues> {
  const now = new Date();
  const cfg = await getJuviConfig(collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const todayMidnight = instantOf(ymd(now, tz), '00:00', tz);

  const invoices = await Invoice.find({
    collegeId,
    studentId: new Types.ObjectId(studentId),
    status: { $in: OPEN_STATUSES },
  }).sort({ dueDate: 1 }).lean<RawInvoice[]>();

  const invoiceIds = invoices.map((i) => i._id);
  const [payments, plans] = await Promise.all([
    invoiceIds.length
      ? Payment.find({ collegeId, invoiceId: { $in: invoiceIds }, status: 'success' })
          .sort({ paymentDate: 1 }).lean<RawPayment[]>()
      : Promise.resolve([] as RawPayment[]),
    invoiceIds.length
      ? PaymentPlan.find({ collegeId, studentId: new Types.ObjectId(studentId), invoiceId: { $in: invoiceIds } })
          .lean<{ invoiceId: Types.ObjectId | null; installments: RawInstalment[] }[]>()
      : Promise.resolve([] as { invoiceId: Types.ObjectId | null; installments: RawInstalment[] }[]),
  ]);

  const paidByInvoice = new Map<string, number>();
  for (const p of payments) {
    const key = String(p.invoiceId);
    paidByInvoice.set(key, (paidByInvoice.get(key) ?? 0) + toPaise(p.amount));
  }
  const instalmentsByInvoice = new Map<string, RawInstalment[]>();
  for (const plan of plans) if (plan.invoiceId) instalmentsByInvoice.set(String(plan.invoiceId), plan.installments ?? []);

  const duesInvoices: DuesInvoice[] = [];
  const nextDuePerInvoice: ReturnType<typeof nextInvoiceDue>[] = [];
  let total = 0;
  for (const inv of invoices) {
    const id = String(inv._id);
    const amount = inv.netPayable ?? inv.totalAmount;
    const paidPaise = paidByInvoice.get(id) ?? 0;
    const outstandingPaise = toPaise(amount) - paidPaise;
    if (outstandingPaise <= 0) continue;

    const invoiceDue = instantOf(ymd(inv.dueDate, tz), '00:00', tz); // the due date at college-tz midnight (R15)

    const instalments: DuesInstalment[] = [];
    let cumulative = 0;
    for (const [index, inst] of (instalmentsByInvoice.get(id) ?? []).entries()) {
      cumulative += toPaise(inst.amount);
      const paid = paidPaise >= cumulative;
      const dueDate = instantOf(ymd(inst.dueDate, tz), '00:00', tz); // the instalment's due date at college-tz midnight (R15)
      instalments.push({
        id: `${id}:${index}`,
        amount: toPaise(inst.amount), // integer paise (R1)
        dueDate: dueDate.toISOString(),
        paid,
        overdue: !paid && dueDate.getTime() < todayMidnight.getTime(),
      });
    }

    const nextInstalment = instalments.find((i) => !i.paid) ?? null;
    const row: DuesInvoice = {
      id,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      amount: toPaise(amount),        // integer paise (R1)
      outstanding: outstandingPaise,  // interior math is already paise — no /100 here (R1)
      dueDate: invoiceDue.toISOString(),
      overdue: nextInstalment ? nextInstalment.overdue : invoiceDue.getTime() < todayMidnight.getTime(),
      instalments,
    };
    duesInvoices.push(row);
    nextDuePerInvoice.push(nextInvoiceDue(row));
    total += outstandingPaise; // integer paise (R1)
  }

  const winner = nextDuePerInvoice
    .reduce<ReturnType<typeof nextInvoiceDue> | null>(
      (min, n) => (min === null || n.date < min.date ? n : min), null);

  const last = payments.length ? payments[payments.length - 1] : null;
  return {
    available: (await Invoice.exists({ collegeId })) !== null,
    invoiceCount: duesInvoices.length,
    total,
    invoices: duesInvoices,
    nextDue: winner,
    lastPayment: last
      ? {
          invoiceId: last.invoiceId ? String(last.invoiceId) : '',
          amount: toPaise(last.amount), // integer paise (R1)
          date: last.paymentDate.toISOString(),
          receiptNumber: last.receiptNumber,
        }
      : null,
  };
}

// ---- assessments (§7.3 assessments block) ---------------------------------------

export type AssessmentKind = 'internal' | 'exam';

export interface AssessmentItem {
  id: string;
  kind: AssessmentKind;
  offeringId: string;
  courseCode: string;
  title: string;
  at: string;
  channelId?: string;
}

/** Spec §6: student assessments in [from, to), sorted by `at`. The item is a
 *  superset of §6's list (id, offeringId included) because §7.4 attention
 *  items need the id; callers pass narrow windows. */
export async function assessmentsFor(
  collegeId: string,
  studentId: string,
  from: Date,
  to: Date,
): Promise<AssessmentItem[]> {
  const [cfg, semesterIds] = await Promise.all([
    getJuviConfig(collegeId),
    activeSemesterIds(collegeId),
  ]);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  if (semesterIds.length === 0) return [];

  const enrollments = await Enrollment.find({
    collegeId,
    studentId: new Types.ObjectId(studentId),
    status: 'enrolled',
    semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
  }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
  const offeringIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
  if (offeringIds.length === 0) return [];

  const offerings = await CourseOffering.find({
    collegeId, _id: { $in: offeringIds.map((i) => new Types.ObjectId(i)) },
  }).select('_id courseId semesterId').lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; semesterId: Types.ObjectId }[]>();
  const courseIds = [...new Set(offerings.map((o) => String(o.courseId)))];

  const [assessmentRows, examRows, courseRows] = await Promise.all([
    InternalAssessment.find({
      collegeId,
      courseOfferingId: { $in: offeringIds.map((i) => new Types.ObjectId(i)) },
      status: 'scheduled',
      date: { $ne: null },
    }).sort({ date: 1 }).lean<{ _id: Types.ObjectId; courseOfferingId: Types.ObjectId; name: string; date: Date }[]>(),
    ExamSchedule.find({
      collegeId,
      semesterId: { $in: semesterIds.map((s) => new Types.ObjectId(s)) },
      courseId: { $in: courseIds.map((i) => new Types.ObjectId(i)) },
      status: 'scheduled',
    }).sort({ date: 1 }).lean<{ _id: Types.ObjectId; courseId: Types.ObjectId; semesterId: Types.ObjectId; examType: string; date: Date; startTime: string }[]>(),
    Course.find({ collegeId, _id: { $in: courseIds.map((i) => new Types.ObjectId(i)) } })
      .select('code').lean<{ _id: Types.ObjectId; code: string }[]>(),
  ]);
  const channelByOffering = await courseChannels(collegeId, offeringIds);

  const codeByCourse = new Map(courseRows.map((c) => [String(c._id), c.code]));

  const items: AssessmentItem[] = [];
  for (const row of assessmentRows) {
    const offeringId = String(row.courseOfferingId);
    const offering = offerings.find((o) => String(o._id) === offeringId);
    const courseCode = offering ? codeByCourse.get(String(offering.courseId)) ?? '' : '';
    items.push({
      id: String(row._id),
      kind: 'internal',
      offeringId,
      courseCode,
      title: row.name,
      at: row.date.toISOString(),
      channelId: channelByOffering.get(offeringId),
    });
  }
  for (const row of examRows) {
    // An exam is scheduled per (semester, course); attach it to the matching offering.
    const offering = offerings.find(
      (o) => String(o.courseId) === String(row.courseId) && String(o.semesterId) === String(row.semesterId),
    );
    if (!offering) continue;
    const name = row.examType === 'regular' ? 'End Semester Exam'
      : row.examType === 'supplementary' ? 'Supplementary Exam'
      : 'Improvement Exam';
    items.push({
      id: String(row._id),
      kind: 'exam',
      offeringId: String(offering._id),
      courseCode: codeByCourse.get(String(row.courseId)) ?? '',
      title: `${name} (${row.startTime})`,
      at: instantOf(ymd(row.date, tz), row.startTime, tz).toISOString(),
      channelId: channelByOffering.get(String(offering._id)),
    });
  }

  // [from, to), left-inclusive, compared as instants (at is an ISO string).
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return items
    .filter((i) => { const ms = new Date(i.at).getTime(); return ms >= fromMs && ms < toMs; })
    .sort((a, b) => a.at.localeCompare(b.at));
}
