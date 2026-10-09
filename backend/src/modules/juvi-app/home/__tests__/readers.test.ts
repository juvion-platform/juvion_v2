import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { College } from '../../../../models/College';
import { AttendanceRecord } from '../../../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../../../models/academic-ops/AttendanceSession';
import { Course } from '../../../../models/academic-ops/Course';
import { CourseOffering } from '../../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../../models/academic-ops/Enrollment';
import { Semester } from '../../../../models/academic-structure/Semester';
import { Faculty } from '../../../../models/people/Faculty';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { InternalAssessment } from '../../../../models/academic-ops/InternalAssessment';
import { ExamSchedule } from '../../../../models/academic-ops/ExamSchedule';
import { Invoice } from '../../../../models/finance/Invoice';
import { Payment } from '../../../../models/finance/Payment';
import { PaymentPlan } from '../../../../models/finance/PaymentPlan';
import { Channel } from '../../../../models/juvi/Channel';
import { toPaise } from '../money';
import { assessmentsFor, juviAttendance, duesFor } from '../readers';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  studentId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
  semesterId: string;
  semester2Id: string;
}

async function seedWorld(): Promise<World> {
  const college = await College.create({
    name: 'Juvi Readers College', code: `JRC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const semester2 = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 1,
    startDate: new Date('2025-06-01T00:00:00Z'), endDate: new Date('2025-12-01T00:00:00Z'), status: 'completed',
  });
  const sPerson = await Person.create({ collegeId, name: 'Rea Der', phone: '9000090002', gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'F Teacher', phone: '9000090001', gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JR${seq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FAC${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS201', name: 'Data Structures',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  // Both readers in this file are enrollment-driven — juviAttendance through
  // erpAttendanceFor's Enrollment lookup, and assessmentsFor through its own — so
  // without this row every course list comes back empty. Task 11's sibling seedWorld
  // already enrolls the student.
  await Enrollment.create({
    collegeId, studentId: student._id, courseOfferingId: offering._id,
    semesterId: semester._id, status: 'enrolled', enrolledAt: new Date(),
  });
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    offeringId: String(offering._id), courseId: String(course._id),
    semesterId: String(semester._id), semester2Id: String(semester2._id),
  };
}

function closedSession(w: World, iso: string): Promise<Types.ObjectId> {
  return AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
    date: new Date(iso), period: 1, facultyId: new Types.ObjectId(w.facultyId), status: 'closed',
  }).then((doc) => doc._id as Types.ObjectId);
}

// --- attendance ---------------------------------------------------------------

describe('juviAttendance', () => {
  beforeEach(async () => { await clearCollections(); });

  it('wraps the ERP formula with available/threshold/showHeadroom and adds channelId (R18)', async () => {
    const w = await seedWorld();
    const channel = await Channel.create({
      collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
      scopeId: new Types.ObjectId(w.offeringId), name: 'CS201 CSE-A', about: 'Course discussion',
      postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
    });
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out).toMatchObject({ available: false, threshold: 60, showHeadroom: true, overall: { held: 0, attended: 0, pct: null } });
    expect(out.courses[0]!.courseCode).toBe('CS201');
    expect(out.courses[0]!.channelId).toBe(String(channel._id));
  });

  it('no active channel → channelId omitted (never null, R11)', async () => {
    const w = await seedWorld();
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.courses).toHaveLength(1);
    expect(out.courses[0]!.channelId).toBeUndefined();
  });

  it('available turns true once a closed session exists', async () => {
    const w = await seedWorld();
    await closedSession(w, '2026-07-01T00:00:00Z');
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);
    expect(out.courses[0]!.held).toBe(1);
  });

  it('zeroes headroom when showAttendanceHeadroom is off', async () => {
    const w = await seedWorld();
    await College.updateOne({ _id: collegeId }, { $set: { 'juvi.showAttendanceHeadroom': false } });
    const session = await closedSession(w, '2026-07-01T00:00:00Z');
    await AttendanceRecord.create({
      collegeId, sessionId: session, studentId: new Types.ObjectId(w.studentId),
      status: 'present', markedBy: new Types.ObjectId(w.facultyId),
    });
    const out = await juviAttendance(collegeId.toString(), w.studentId);
    expect(out.showHeadroom).toBe(false);
    expect(out.courses[0]!.pct).toBe(100);
    expect(out.courses[0]!.headroom).toBe(0);
  });
});

// --- dues ----------------------------------------------------------------------

// --- toPaise (R1 money boundary): pure converter, no DB -----------------------

describe('toPaise', () => {
  it('multiplies rupees ×100 half-up and passes null through', () => {
    expect(toPaise(12499.5)).toBe(1249950);
    expect(toPaise(19.99)).toBe(1999);   // 19.99 × 100 is 1998.9999999999998 in fp64 — must land on 1999
    expect(toPaise(0.125)).toBe(13);     // exact .5 boundary → half-up
    expect(toPaise(0)).toBe(0);
    expect(toPaise(null)).toBeNull();
  });

  it('keeps invoice-grade rupee values exact in paise', () => {
    expect(toPaise(39999.99)).toBe(3999999);
    expect(toPaise(25000.25)).toBe(2500025);
  });
});

describe('duesFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('drops draft/paid invoices and reports outstanding in paise (R1, R5)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-1',
      type: 'fee', totalAmount: 40000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'generated',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-2',
      type: 'fee', totalAmount: 10000, dueDate: new Date('2027-07-02T00:00:00Z'), status: 'paid',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-3',
      type: 'hostel', totalAmount: 20000, dueDate: new Date('2027-07-03T00:00:00Z'), status: 'draft',
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);
    expect(out.invoiceCount).toBe(1);
    expect(out.total).toBe(4000000);                    // 40000 ₹ in paise (R1)
    expect(out.invoices[0]!.outstanding).toBe(4000000); // 40000 ₹ in paise (R1)
    expect(out.invoices[0]!.instalments).toEqual([]);
  });

  it('outstanding = (netPayable ?? totalAmount) minus successful payments, in paise (R1)', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-10',
      type: 'fee', totalAmount: 40000, netPayable: 39999.99,
      dueDate: new Date('2026-07-01T00:00:00Z'), status: 'sent',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-1', amount: 25000.25, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-07-05T00:00:00Z'),
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-2', amount: 5000, paymentMode: 'online', status: 'failed',
      paymentDate: new Date('2026-07-06T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    const invoice = out.invoices[0]!;
    expect(invoice.amount).toBe(3999999);      // 39999.99 ₹ in paise (R1)
    expect(invoice.outstanding).toBe(1499974); // 3999999 − 2500025 paise (R1) — exact, no toBeCloseTo needed
    expect(out.lastPayment).toMatchObject({ amount: 2500025, receiptNumber: 'RCP-1' });
    expect(out.nextDue!.invoiceId).toBe(invoice.id);
    expect(out.nextDue!.amount).toBe(1499974); // same paise arithmetic (R1)
  });

  it('matches instalments chronologically against cumulative payments (R7); next unpaid instalment is nextDue', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-20',
      type: 'fee', totalAmount: 30000,
      dueDate: new Date('2027-03-01T00:00:00Z'), status: 'sent',
    });
    await PaymentPlan.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      totalAmount: 30000, status: 'active',
      installments: [
        { dueDate: new Date('2027-01-01T00:00:00Z'), amount: 10000, status: 'pending' },
        { dueDate: new Date('2027-02-01T00:00:00Z'), amount: 10000, status: 'pending' },
        { dueDate: new Date('2027-03-01T00:00:00Z'), amount: 10000, status: 'pending' },
      ],
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-10', amount: 20000, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.instalments.map((i) => [i.paid, i.amount])).toEqual([[true, 1000000], [true, 1000000], [false, 1000000]]); // paise (R1)
    expect(out.nextDue!.amount).toBe(1000000);   // 10000 ₹ in paise (R1)
    // The test college has no timezone, so R41's 'Asia/Kolkata' default applies:
    // the 2027-03-01 due date at IST midnight is a college-tz-midnight ISO instant (R15).
    expect(out.nextDue!.date).toBe('2027-02-28T18:30:00.000Z');
    expect(out.invoices[0]!.outstanding).toBe(1000000); // 30000 − 20000 = 10000 ₹ in paise (R1)
  });

  it('flags overdue when the next due date is past (R15 overdue = date < today in college tz)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-30',
      type: 'fee', totalAmount: 15000,
      dueDate: new Date('2026-01-10T00:00:00Z'), status: 'overdue',
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.overdue).toBe(true);
    expect(out.nextDue!.overdue).toBe(true);
  });

  it('drops an invoice whose payments cover it; a college with nothing on file is not available', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-40',
      type: 'fee', totalAmount: 5000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'sent',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-40', amount: 5000, paymentMode: 'upi', status: 'success',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.available).toBe(true);          // the invoice row exists on file
    expect(out.invoiceCount).toBe(0);          // but nothing is OPEN
    expect(out.total).toBe(0);
    expect(out.nextDue).toBeNull();
    const otherCollege = await duesFor(new Types.ObjectId().toString(), w.studentId);
    expect(otherCollege.available).toBe(false);
  });

  it('reversed payments do not reduce outstanding', async () => {
    const w = await seedWorld();
    const inv = await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'INV-50',
      type: 'fee', totalAmount: 9000, dueDate: new Date('2027-07-01T00:00:00Z'), status: 'generated',
    });
    await Payment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceId: inv._id,
      receiptNumber: 'RCP-50', amount: 4000, paymentMode: 'upi', status: 'reversed',
      paymentDate: new Date('2026-11-01T00:00:00Z'),
    });
    const out = await duesFor(collegeId.toString(), w.studentId);
    expect(out.invoices[0]!.outstanding).toBe(900000); // 9000 ₹ in paise (R1)
  });
});

// --- assessments ---------------------------------------------------------------

describe('assessmentsFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('merges scheduled assessments and exams on active-semester offerings, sorted by at (R18 ids + channelId)', async () => {
    const w = await seedWorld();
    const channel = await Channel.create({
      collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
      scopeId: new Types.ObjectId(w.offeringId), name: 'CS201 CSE-A', about: 'Course discussion',
      postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Mid 1', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'scheduled',
    });
    await ExamSchedule.create({
      collegeId, semesterId: new Types.ObjectId(w.semesterId), courseId: new Types.ObjectId(w.courseId),
      examType: 'regular', date: new Date('2026-11-25T00:00:00Z'), startTime: '10:00', endTime: '12:00',
      venue: 'Hall A', status: 'scheduled',
    });
    const items = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'));
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe('internal');
    expect(items[0]!.title).toBe('Mid 1');
    expect(items[0]!.at).toBe(new Date('2026-11-20T09:00:00Z').toISOString());
    expect(items[0]!.channelId).toBe(String(channel._id));
    expect(items[1]!.kind).toBe('exam');
    expect(items[1]!.courseCode).toBe('CS201');
    expect(items[1]!.at).toBe('2026-11-25T04:30:00.000Z');   // 10:00 in Asia/Kolkata
  });

  it('skips conducted assessments, rows without a date, and other semesters', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Conducted Mid', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'conducted',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'No date', type: 'assignment', maxMarks: 10, weightage: 5, status: 'scheduled',
    });
    await ExamSchedule.create({
      collegeId, semesterId: new Types.ObjectId(w.semester2Id), courseId: new Types.ObjectId(w.courseId),
      examType: 'regular', date: new Date('2026-11-25T00:00:00Z'), startTime: '10:00', endTime: '12:00',
      status: 'scheduled',
    });
    const items = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'));
    expect(items).toEqual([]);
  });

  it('respects the from/to window: left edge inclusive, right edge exclusive', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Mid 1', type: 'mid1', maxMarks: 30, weightage: 20,
      date: new Date('2026-11-20T09:00:00Z'), status: 'scheduled',
    });
    const past = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-12-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'));
    expect(past).toEqual([]);
    const within = await assessmentsFor(collegeId.toString(), w.studentId, new Date('2026-11-20T09:00:00Z'), new Date('2026-11-21T00:00:00Z'));
    expect(within).toHaveLength(1);
  });
});
