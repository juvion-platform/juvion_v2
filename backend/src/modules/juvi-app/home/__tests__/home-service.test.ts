import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceRecord } from '../../../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../../../models/academic-ops/AttendanceSession';
import { Course } from '../../../../models/academic-ops/Course';
import { CourseOffering } from '../../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../../models/academic-ops/Enrollment';
import { Timetable } from '../../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { Department } from '../../../../models/academic-structure/Department';
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
import type { MobileContext } from '../../middleware/authenticate-mobile';
import { homeTeaching, homeToday, meAcademics } from '../service';

let collegeId = new Types.ObjectId();
let seq = 0;

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

// Pin the clock. `homeToday` derives "today" from the wall clock in the college tz, and this fixture
// must place its slots on the very weekday the service will resolve — so the fixture cannot side-step
// the problem by choosing a different date. On the real clock it lands on a Sunday twice a week, and
// `TimetableSlot.day`'s enum has no 'sunday' member (TimetableSlot.ts:14), so `seedHomeWorld`'s create
// throws a Mongoose ValidationError instead of the test failing honestly. It seeds *today and tomorrow*,
// so a Saturday run is fatal too. FIXED is a Tuesday. `toFake: ['Date']` only — faking the Mongo
// driver's timers hangs the suite (the same note Task 15's file carries). R87.
const FIXED = new Date('2026-11-10T04:00:00.000Z'); // 09:30 IST, Tuesday
beforeEach(() => { vi.useFakeTimers({ now: FIXED, toFake: ['Date'], shouldAdvanceTime: true }); });

interface World {
  studentId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
  semesterId: string;
  sectionId: string;
  todayDate: string;
  tomorrowDate: string;
}

function ctxOf(kind: 'student' | 'faculty' | 'staff', w?: World): MobileContext {
  return {
    kind,
    collegeId: collegeId.toString(),
    userId: new Types.ObjectId().toString(),
    accountId: new Types.ObjectId().toString(),
    sessionId: new Types.ObjectId().toString(),
    role: kind,
    studentId: kind === 'student' && w ? w.studentId : undefined,
    facultyId: kind === 'faculty' && w ? w.facultyId : undefined,
    account: { kind },
  } as unknown as MobileContext;
}

function collegeDates(): { todayDate: string; tomorrowDate: string } {
  // The service derives dates from the pinned clock in the college tz (Asia/Kolkata here); derive
  // the same strings for slot placement, from the same pinned clock, so the two cannot disagree —
  // and so the weekday they map to can never be a Sunday (R87).
  const inIst = new Date(Date.now() + 5.5 * 3_600_000);
  const todayDate = inIst.toISOString().slice(0, 10);
  const tomorrowDate = new Date(inIst.getTime() + 86_400_000).toISOString().slice(0, 10);
  return { todayDate, tomorrowDate };
}

async function seedHomeWorld(withTimetable: boolean): Promise<World> {
  const college = await College.create({
    name: 'Juvi Home College', code: `JHC${seq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test', contactPhone: '9000000000',
    juvi: { enabled: true, attendanceThreshold: 60, showAttendanceHeadroom: true, timezone: 'Asia/Kolkata' },
  });
  collegeId = college._id as Types.ObjectId;
  const { todayDate, tomorrowDate } = collegeDates();
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const section = await Section.create({
    collegeId, name: 'A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(),
    year: 2, semester: 1, capacity: 60, studentIds: [],
  });
  const sPerson = await Person.create({ collegeId, name: 'Home Student', phone: `90000${seq}`, gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'Prof. Rao', phone: `90001${seq}`, gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JH${seq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FACJH${seq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS301', name: 'Operating Systems',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId: semester._id,
    sectionId: section._id, facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1, status: 'active',
  });
  await Enrollment.create({
    collegeId, studentId: student._id, courseOfferingId: offering._id,
    semesterId: semester._id, status: 'enrolled', enrolledAt: new Date(),
  });
  await Channel.create({
    collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
    scopeId: offering._id, name: 'CS301 A', about: 'Course discussion',
    postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', status: 'active',
  });
  if (withTimetable) {
    const building = await Building.create({ collegeId, name: 'Alpha Block', code: `JHAB${seq++}`, floors: 3, totalRooms: 30 });
    const room = await Room.create({ collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60 });
    const timetable = await Timetable.create({
      collegeId, semesterId: semester._id, sectionId: section._id,
      version: 1, status: 'published', effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    });
    // TimetableSlot is keyed by weekday (`day`), not a calendar date: one slot on
    // today's weekday and one on tomorrow's, on the same published timetable (the
    // service maps a date onto its weekday through the live timetable).
    for (const [index, date] of [todayDate, tomorrowDate].entries()) {
      const weekday = DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
      await TimetableSlot.create({
        collegeId, timetableId: timetable._id, day: weekday, period: index + 1,
        startTime: '09:00', endTime: '10:00', slotType: 'lecture',
        courseOfferingId: offering._id, roomId: room._id,
      });
    }
  }
  return {
    studentId: String(student._id), facultyId: String(faculty._id),
    offeringId: String(offering._id), courseId: String(course._id),
    semesterId: String(semester._id), sectionId: String(section._id),
    todayDate, tomorrowDate,
  };
}

describe('homeToday (§7.1)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('returns asOf, today classes with channelId, tomorrow, and an empty-world glance', async () => {
    const w = await seedHomeWorld(true);
    const out = await homeToday(ctxOf('student', w));
    expect(out.asOf).toBeTypeOf('string');
    expect(out.today.classes.filter((c) => c.offeringId === w.offeringId).length).toBe(1);
    expect(out.today.classes[0]!.courseCode).toBe('CS301');
    expect(out.today.classes[0]!.channelId).toBeTypeOf('string');
    expect(out.tomorrow.date).toBe(w.tomorrowDate);
    expect(out.tomorrow.classes[0]!.courseCode).toBe('CS301');
    expect(out.glance.attendance).toMatchObject({ available: false, threshold: 60, belowThreshold: false });
    expect('overallPct' in out.glance.attendance).toBe(false);   // null omitted (§7.5)
    expect(out.glance.dues).toMatchObject({ available: false, totalOutstanding: 0 });
    expect('nextDue' in out.glance.dues).toBe(false);
    expect(out.glance.nextAssessment).toBeUndefined();
  });

  it('glance.dues carries totalOutstanding + nextDue, and nextAssessment comes from the 14-day window', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-1',
      type: 'fee', totalAmount: 12000, dueDate: new Date(Date.now() + 86_400_000), status: 'sent',
    });
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Quiz 1', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(Date.now() + 3 * 86_400_000), status: 'scheduled',
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.dues.available).toBe(true);
    expect(out.glance.dues.totalOutstanding).toBe(1200000); // 12000 ₹ in paise (R1)
    expect(out.glance.dues.nextDue).toMatchObject({ amount: 1200000 });
    expect(out.glance.nextAssessment!.title).toBe('Quiz 1');
    expect(out.glance.nextAssessment!.courseCode).toBe('CS301');
  });

  it('an assessment outside the 14-day window is not the next assessment (window assumption A5)', async () => {
    const w = await seedHomeWorld(false);
    await InternalAssessment.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      name: 'Far quiz', type: 'quiz', maxMarks: 10, weightage: 5,
      date: new Date(Date.now() + 40 * 86_400_000), status: 'scheduled',
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.nextAssessment).toBeUndefined();
  });

  it('attendance belowThreshold turns on when overall pct is under the threshold', async () => {
    const w = await seedHomeWorld(false);
    const session = await AttendanceSession.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      date: new Date('2026-07-01T00:00:00Z'), period: 1,
      facultyId: new Types.ObjectId(w.facultyId), status: 'closed',
    });
    await AttendanceRecord.create({
      collegeId, sessionId: session._id, studentId: new Types.ObjectId(w.studentId),
      status: 'absent', markedBy: new Types.ObjectId(w.facultyId),
    });
    const out = await homeToday(ctxOf('student', w));
    expect(out.glance.attendance.overallPct).toBe(0);
    expect(out.glance.attendance.belowThreshold).toBe(true);
  });

  it('staff is 403 FORBIDDEN (R24)', async () => {
    await seedHomeWorld(false);
    await expect(homeToday(ctxOf('staff'))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

describe('homeTeaching (§7.2)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('a faculty day carries registered, and nextTeachingDay lands on the next slotted day', async () => {
    const w = await seedHomeWorld(true);
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty).toEqual({ kind: 'regular' });
    expect(out.asOf).toBeTypeOf('string');
    const first = out.nextTeachingDay ?? out.tomorrow;
    expect(first.classes[0]!.registered).toBe(1);
    expect(first.date === w.tomorrowDate || out.tomorrow.classes.length === 0).toBe(true);
  });

  it('kind adjunct wins over hod (precedence A4)', async () => {
    const w = await seedHomeWorld(false);
    await Faculty.updateOne({ _id: new Types.ObjectId(w.facultyId) }, { $set: { contractType: 'visiting' } });
    await Department.create({ collegeId, code: 'CSEJH', name: 'Comp Sci', isActive: true, hodId: new Types.ObjectId(w.facultyId) });
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty.kind).toBe('adjunct');
  });

  it('kind hod from Department.hodId', async () => {
    const w = await seedHomeWorld(false);
    await Department.create({ collegeId, code: 'CSEJH2', name: 'Comp Sci 2', isActive: true, hodId: new Types.ObjectId(w.facultyId) });
    const out = await homeTeaching(ctxOf('faculty', w));
    expect(out.faculty.kind).toBe('hod');
  });

  it('students are 403 on teaching (§7.2 is faculty)', async () => {
    const w = await seedHomeWorld(false);
    await expect(homeTeaching(ctxOf('student', w))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

describe('meAcademics (§7.3)', () => {
  beforeEach(async () => { await clearCollections(); });

  it('a student gets attendance + dues in the contract shape (no instalments, no receiptNumber)', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-2',
      type: 'fee', totalAmount: 8000, dueDate: new Date(Date.now() + 2 * 86_400_000), status: 'sent',
    });
    const out = (await meAcademics(ctxOf('student', w))) as { attendance: { threshold: number }; dues: { invoices: { number: string; overdue: boolean }[]; payUrl?: string } };
    expect(out.attendance.threshold).toBe(60);
    expect(out.dues.invoices).toHaveLength(1);
    expect(out.dues.invoices[0]!.number).toBe('HINV-2');
    expect(out.dues.invoices[0]!.overdue).toBe(false);
    expect(JSON.stringify(out.dues)).not.toContain('instalments');
    expect(JSON.stringify(out.dues)).not.toContain('receiptNumber');
    expect('payUrl' in out.dues).toBe(false);
  });

  it('payUrl appears when the college configured paymentPortalUrl (Task 9 setting)', async () => {
    const w = await seedHomeWorld(false);
    await Invoice.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), invoiceNumber: 'HINV-3',
      type: 'fee', totalAmount: 8000, dueDate: new Date(Date.now() + 2 * 86_400_000), status: 'sent',
    });
    await College.updateOne({ _id: collegeId }, { $set: { 'juvi.paymentPortalUrl': 'https://pay.juvion.test/xyz' } });
    const out = (await meAcademics(ctxOf('student', w))) as { dues: { payUrl?: string } };
    expect(out.dues.payUrl).toBe('https://pay.juvion.test/xyz');
  });

  it('faculty get coursesTaught with section and channelId, not attendance/dues', async () => {
    const w = await seedHomeWorld(true);
    const out = (await meAcademics(ctxOf('faculty', w))) as { coursesTaught: { courseCode: string; section: string; channelId?: string }[] };
    expect(out.coursesTaught).toHaveLength(1);
    expect(out.coursesTaught[0]!.courseCode).toBe('CS301');
    expect(out.coursesTaught[0]!.section).toBe('A');
    expect(out.coursesTaught[0]!.channelId).toBeTypeOf('string');
    expect('attendance' in out).toBe(false);
    expect('dues' in out).toBe(false);
  });

  it('staff is 403 FORBIDDEN (R24)', async () => {
    await seedHomeWorld(false);
    await expect(meAcademics(ctxOf('staff'))).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});
