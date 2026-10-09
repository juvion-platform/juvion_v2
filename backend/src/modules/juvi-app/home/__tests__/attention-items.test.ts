import { Types } from 'mongoose';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Course } from '../../../../models/academic-ops/Course';
import { CourseOffering } from '../../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../../models/academic-ops/Enrollment';
import { Timetable } from '../../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { Section } from '../../../../models/academic-structure/Section';
import { Semester } from '../../../../models/academic-structure/Semester';
import { Building } from '../../../../models/campus/Building';
import { Room } from '../../../../models/campus/Room';
import { Channel } from '../../../../models/juvi/Channel';
import { Faculty } from '../../../../models/people/Faculty';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { College } from '../../../../models/College';
import { Invoice } from '../../../../models/finance/Invoice';
import { InternalAssessment } from '../../../../models/academic-ops/InternalAssessment';
import { Notice } from '../../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { createClassException } from '../../../../modules/academics/class-exception-service';
import { attentionItems } from '../attention';
import { attention, attentionAll } from '../../notices/mobile-service';
import type { MobileContext } from '../../middleware/authenticate-mobile';

// Fixed clock: 2026-11-10T04:00:00Z = 09:30 IST, so the college-tz day is 2026-11-10.
const FIXED = new Date('2026-11-10T04:00:00.000Z');
const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const TZ = 'Asia/Kolkata';
const dow = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
const offset = (days: number) => new Date(FIXED.getTime() + days * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let seq = 0;

interface World {
  studentId: string;
  facultyId: string;
  accountId: string;
  todayDate: string;
  offeringId: string;
  timetableId: string;
  slotIds: { todaySlot: string; farSlot: string };
}

async function seedWorld(): Promise<World> {
  const todayDate = FIXED.toISOString().slice(0, 10);
  const college = await College.create({
    name: `Attention College ${seq}`, code: `ATC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '500001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true, timezone: TZ },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const section = await Section.create({ collegeId, name: 'A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(), year: 2, semester: 1, capacity: 60, studentIds: [] });
  const sPerson = await Person.create({ collegeId, name: `Attn Student ${seq}`, phone: `90000910${seq++}`, gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: `Prof. Devi ${seq}`, phone: `90000911${seq++}`, gender: 'female' });
  const student = await Student.create({ collegeId, personId: sPerson._id, admissionYear: 2026, rollNumber: `26AT${seq}`, status: 'active', onboardingStatus: 'not_started' });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACAT${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'OOP101', name: 'Object Oriented Programming',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: section._id, facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  await Enrollment.create({ collegeId, studentId: student._id, courseOfferingId: offering._id, semesterId: semester._id, status: 'enrolled', enrolledAt: FIXED });
  await Channel.create({
    collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
    scopeId: offering._id, name: 'OOP101 A', about: 'Course discussion',
    postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
  });
  const building = await Building.create({ collegeId, name: 'Main Block', code: `ATMD${seq++}`, floors: 3, totalRooms: 30 });
  const room = await Room.create({ collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60 });
  const timetable = await Timetable.create({ collegeId, semesterId: semester._id, sectionId: section._id, version: 1, status: 'published', effectiveFrom: new Date('2026-06-01T00:00:00Z') });
  const farDate = offset(4); // a weekday four days out: outside today/tomorrow
  const todaySlot = await TimetableSlot.create({
    collegeId, timetableId: timetable._id, day: dow(todayDate), period: 2,
    startTime: '14:00', endTime: '15:00', slotType: 'lecture', courseOfferingId: offering._id, roomId: room._id,
  });
  const farSlot = await TimetableSlot.create({
    collegeId, timetableId: timetable._id, day: dow(farDate), period: 3,
    startTime: '09:00', endTime: '10:00', slotType: 'lecture', courseOfferingId: offering._id, roomId: room._id,
  });
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    accountId: new Types.ObjectId().toString(), todayDate,
    offeringId: String(offering._id), timetableId: String(timetable._id),
    slotIds: { todaySlot: String(todaySlot._id), farSlot: String(farSlot._id) },
  };
}

function studentCtx(w: World): MobileContext {
  return {
    kind: 'student', collegeId: collegeId.toString(), userId: new Types.ObjectId().toString(),
    accountId: w.accountId, sessionId: new Types.ObjectId().toString(), role: 'student',
    studentId: w.studentId, account: { kind: 'student' },
  } as unknown as MobileContext;
}

function facultyCtx(w: World): MobileContext {
  return {
    kind: 'faculty', collegeId: collegeId.toString(), userId: new Types.ObjectId().toString(),
    accountId: w.accountId, sessionId: new Types.ObjectId().toString(), role: 'faculty',
    facultyId: w.facultyId, account: { kind: 'faculty' },
  } as unknown as MobileContext;
}

async function cancel(slotId: string, date: string): Promise<string> {
  const doc = await createClassException(collegeId.toString(), { timetableSlotId: slotId, date, type: 'cancelled', reason: 'Venue flooded' }, new Types.ObjectId().toString());
  return String(doc._id);
}

async function seedDueNotice(w: World, title: string, ackDeadline: Date | null): Promise<void> {
  const notice = await Notice.create({
    collegeId, title, body: `Body of ${title}`,
    publisher: { personId: new Types.ObjectId(), userId: new Types.ObjectId(), office: 'Exams' },
    audience: { rules: [], line: 'All students' },
    ackRequired: true, ackDeadline, status: 'published', publishedAt: FIXED,
  });
  await NoticeRecipient.create({
    collegeId, noticeId: notice._id, personId: new Types.ObjectId(), accountId: new Types.ObjectId(w.accountId),
    kind: 'student', ackRequired: true, deadline: ackDeadline, receivedAt: FIXED,
  });
}

describe('attentionItems (§7.4)', () => {
  beforeEach(async () => { await clearCollections(); vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('a cancelled class today is a class_change item with the original slot and its channel', async () => {
    const w = await seedWorld();
    const exceptionId = await cancel(w.slotIds.todaySlot, w.todayDate);
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', id: exceptionId, type: 'cancelled', courseCode: 'OOP101',
      date: w.todayDate, start: '14:00', deadline: new Date('2026-11-10T08:30:00.000Z').toISOString(),
    });
    expect(items[0]!.channelId).toBeTypeOf('string');
    expect(items[0]!.room).toBe('101, Main Block');
  });

  it('an exception whose original date is beyond tomorrow is excluded (R14)', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.farSlot, offset(4));
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });

  it('a class change whose original start already passed is excluded', async () => {
    const w = await seedWorld();
    // Re-seed a today slot at 07:00 IST (01:30Z < the 04:00Z fixed clock) and cancel it.
    const early = await TimetableSlot.create({
      collegeId, timetableId: new Types.ObjectId(w.timetableId), day: dow(w.todayDate), period: 1,
      startTime: '07:00', endTime: '08:00', slotType: 'lecture',
      courseOfferingId: new Types.ObjectId(w.offeringId), roomId: (await Room.findOne({ collegeId }))!._id,
    });
    await cancel(String(early._id), w.todayDate);
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });

  it('a reschedule from today to next week shows the original date/start and the new date/start', async () => {
    const w = await seedWorld();
    const doc = await createClassException(collegeId.toString(), {
      timetableSlotId: w.slotIds.todaySlot, date: w.todayDate, type: 'rescheduled',
      newDate: offset(5), newStartTime: '15:00', newEndTime: '16:00', reason: 'Staff training',
    }, new Types.ObjectId().toString());
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', id: String(doc._id), type: 'rescheduled',
      date: w.todayDate, start: '14:00', newDate: offset(5), newStart: '15:00',
    });
  });

  it('a reschedule whose new date is tomorrow appears even when the original is beyond tomorrow (R14)', async () => {
    const w = await seedWorld();
    await createClassException(collegeId.toString(), {
      timetableSlotId: w.slotIds.farSlot, date: offset(4), type: 'rescheduled',
      newDate: offset(1), newStartTime: '15:00', newEndTime: '16:00', reason: 'Staff training',
    }, new Types.ObjectId().toString());
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'class_change', type: 'rescheduled', date: offset(4), start: '09:00', newDate: offset(1), newStart: '15:00',
    });
  });

  it('fee_due items appear inside the 7-day window and for overdue invoices (§6/§7.4)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AWIN-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(5)}T00:00:00Z`), status: 'sent',
    });
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AOLD-1',
      type: 'hostel', totalAmount: 3000, dueDate: new Date(`${offset(-3)}T00:00:00Z`), status: 'overdue',
    });
    const items = await attentionItems(studentCtx(w));
    const fees = items.filter((i) => i.kind === 'fee_due');
    expect(fees).toHaveLength(2);
    expect(fees.map((f) => f.invoiceNumber).sort()).toEqual(['AOLD-1', 'AWIN-1']);
    // AWIN-1 has no payments: outstanding 5000 ₹ = integer paise 500000 (R1).
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.amount).toBe(500000);
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.overdue).toBe(true);
    // deadline carries the college-tz-midnight ISO instant; dueDate the display date (R15).
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.overdue).toBe(false);
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.dueDate).toBe(offset(5));
    expect(fees.find((f) => f.invoiceNumber === 'AWIN-1')!.deadline).toBe('2026-11-14T18:30:00.000Z'); // IST midnight of 2026-11-15
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.dueDate).toBe(offset(-3));
    expect(fees.find((f) => f.invoiceNumber === 'AOLD-1')!.deadline).toBe('2026-11-06T18:30:00.000Z'); // IST midnight of 2026-11-07
  });

  it('a fee due beyond 7 days is excluded', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AFAR-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(10)}T00:00:00Z`), status: 'sent',
    });
    const items = await attentionItems(studentCtx(w));
    expect(items.filter((i) => i.kind === 'fee_due')).toHaveLength(0);
  });

  it('a fee due exactly today appears and is NOT overdue (R15)', async () => {
    const w = await seedWorld();
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'ATODAY-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(0)}T00:00:00Z`), status: 'sent',
    });
    const items = await attentionItems(studentCtx(w));
    const fees = items.filter((i) => i.kind === 'fee_due');
    expect(fees).toHaveLength(1); // deadline == start-of-today: the window includes today
    expect(fees[0]).toMatchObject({
      invoiceNumber: 'ATODAY-1', dueDate: offset(0), overdue: false,
      deadline: '2026-11-09T18:30:00.000Z', // IST midnight of the 10th == start-of-today instant
    });
    expect(fees[0]!.amount).toBe(500000); // 5000 ₹ in paise (R1)
  });

  it('faculty get class changes but never fee or assessment items (R30)', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.todaySlot, w.todayDate);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'AFAC-1',
      type: 'fee', totalAmount: 5000, dueDate: new Date(`${offset(2)}T00:00:00Z`), status: 'sent',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 1', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 36 * 3_600_000), status: 'scheduled',
    });
    const items = await attentionItems(facultyCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('class_change');
  });

  it('an assessment within 48 hours is an assessment item whose deadline is its start', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 2', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 36 * 3_600_000), status: 'scheduled',
    });
    const items = await attentionItems(studentCtx(w));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'assessment', courseCode: 'OOP101', title: 'Quiz 2',
      at: new Date(FIXED.getTime() + 36 * 3_600_000).toISOString(),
      deadline: new Date(FIXED.getTime() + 36 * 3_600_000).toISOString(),
    });
    expect(items[0]!.channelId).toBeTypeOf('string');
  });

  it('an assessment beyond 48 hours is excluded', async () => {
    const w = await seedWorld();
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 3', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(FIXED.getTime() + 72 * 3_600_000), status: 'scheduled',
    });
    expect(await attentionItems(studentCtx(w))).toHaveLength(0);
  });
});

describe('attentionAll and the legacy shape', () => {
  beforeEach(async () => { await clearCollections(); vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('kinds=all merges due notices with ERP items, orders by deadline, and counts every item', async () => {
    const w = await seedWorld();
    await cancel(w.slotIds.todaySlot, w.todayDate);           // deadline 08:30Z
    await seedDueNotice(w, 'Submit hall ticket', new Date('2026-11-10T16:30:00.000Z')); // deadline 16:30Z
    const out = await attentionAll(studentCtx(w));
    expect(out.dueCount).toBe(2);
    expect(out.items.map((i) => i.kind)).toEqual(['class_change', 'notice']);
    const noticeItem = out.items[1]!;
    expect(noticeItem).toMatchObject({ kind: 'notice', title: 'Submit hall ticket', state: 'received', deadline: '2026-11-10T16:30:00.000Z' });
  });

  it('the legacy behaviour without kinds=all is unchanged: all due notices counted, items capped at 3', async () => {
    const w = await seedWorld();
    for (const n of [1, 2, 3, 4]) await seedDueNotice(w, `Dues notice ${n}`, new Date('2026-11-10T16:30:00.000Z'));
    await cancel(w.slotIds.todaySlot, w.todayDate);
    const legacy = await attention(studentCtx(w));
    expect(legacy.dueCount).toBe(4);
    expect(legacy.items).toHaveLength(3);
    expect(legacy.items.every((i) => i.kind === 'notice')).toBe(true);
  });
});
