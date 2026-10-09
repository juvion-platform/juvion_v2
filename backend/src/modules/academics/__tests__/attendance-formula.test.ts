import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { College } from '../../../models/College';
import {
  AttendanceRecord,
  AttendanceSession,
  Course,
  CourseOffering,
  Enrollment,
  Faculty,
  Person,
  Semester,
  Student,
} from '../../../models';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import {
  attendanceAvailableFor,
  attendanceCategory,
  attendanceFor,
  attendanceThresholdFor,
  courseAttendanceFor,
  round1,
} from '../attendance-formula';

// The `../../../models` barrel registers every model, so Mongoose builds all
// their indexes on connect; the first DB test absorbs that warmup (~10 s here).
// Matches the repo's other barrel-importing test (demo-seed/breadth.test.ts).
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

// --- pure tests (no DB) ------------------------------------------------------

describe('round1', () => {
  it('rounds to one decimal place', () => {
    expect(round1(66.66666666666667)).toBe(66.7);
    expect(round1(75)).toBe(75);
    expect(round1(0)).toBe(0);
  });
});

describe('attendanceCategory', () => {
  it('bands at threshold 75 per §5.4', () => {
    expect(attendanceCategory(100, 75)).toBe('safe');
    expect(attendanceCategory(85, 75)).toBe('safe');
    expect(attendanceCategory(84.9, 75)).toBe('warning');
    expect(attendanceCategory(75, 75)).toBe('warning');
    expect(attendanceCategory(74.9, 75)).toBe('at_risk');
    expect(attendanceCategory(65, 75)).toBe('at_risk');
    expect(attendanceCategory(64.9, 75)).toBe('detained');
    expect(attendanceCategory(0, 75)).toBe('detained');
  });

  it('bands shift when the threshold is 60', () => {
    expect(attendanceCategory(70, 60)).toBe('safe');
    expect(attendanceCategory(69.9, 60)).toBe('warning');
    expect(attendanceCategory(60, 60)).toBe('warning');
    expect(attendanceCategory(59.9, 60)).toBe('at_risk');
    expect(attendanceCategory(50, 60)).toBe('at_risk');
    expect(attendanceCategory(49.9, 60)).toBe('detained');
  });

  it('a null percentage is safe (held = 0 stores null)', () => {
    expect(attendanceCategory(null, 75)).toBe('safe');
  });
});

// --- DB-backed tests ---------------------------------------------------------

let collegeId = new Types.ObjectId();
let semesterId = new Types.ObjectId();
let codeSeq = 0;

interface SeedWorld {
  studentId: string;
  byPersonId: string;
  facultyId: string;
  offeringId: string;
  courseId: string;
}

async function seedWorld(threshold?: number): Promise<SeedWorld> {
  const college = await College.create({
    name: 'Juvi Test College',
    code: `JTC${Date.now()}_${codeSeq++}`,
    address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
    contactEmail: 'a@juvion.test',
    contactPhone: '9000000000',
    juvi: { enabled: true, ...(threshold ? { attendanceThreshold: threshold } : {}) },
  });
  collegeId = college._id as Types.ObjectId;
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  semesterId = semester._id as Types.ObjectId;
  const sPerson = await Person.create({ collegeId, name: 'S Student', phone: '9000090002', gender: 'male' });
  const fPerson = await Person.create({ collegeId, name: 'F Teacher', phone: '9000090001', gender: 'male' });
  const student = await Student.create({
    collegeId, personId: sPerson._id, admissionYear: 2026,
    rollNumber: `26JIT${codeSeq}`, status: 'active', onboardingStatus: 'not_started',
  });
  const faculty = await Faculty.create({
    collegeId, personId: fPerson._id, employeeCode: `FAC${codeSeq}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId, code: 'CS101', name: 'Intro to CS',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId, courseId: course._id, semesterId,
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 1,
  });
  await Enrollment.create({
    collegeId, studentId: student._id, courseOfferingId: offering._id,
    semesterId, status: 'enrolled', enrolledAt: new Date(),
  });
  return {
    studentId: String(student._id),
    byPersonId: String(fPerson._id),
    facultyId: String(faculty._id),
    offeringId: String(offering._id),
    courseId: String(course._id),
  };
}

async function closeSession(offeringId: string, facultyId: string, day: number): Promise<Types.ObjectId> {
  const doc = await AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(offeringId),
    date: new Date(`2026-07-${String(day).padStart(2, '0')}T00:00:00Z`), period: 1,
    facultyId: new Types.ObjectId(facultyId), status: 'closed',
  });
  return doc._id as Types.ObjectId;
}

async function mark(sessionId: Types.ObjectId, studentId: string, byPersonId: string, status: string): Promise<void> {
  await AttendanceRecord.create({
    collegeId, sessionId, studentId: new Types.ObjectId(studentId),
    status, markedBy: new Types.ObjectId(byPersonId),
  });
}

describe('attendanceFor', () => {
  beforeEach(async () => { await clearCollections(); });

  it('counts only closed sessions as held', async () => {
    const w = await seedWorld();
    await closeSession(w.offeringId, w.facultyId, 1);
    await AttendanceSession.create({
      collegeId, courseOfferingId: new Types.ObjectId(w.offeringId),
      date: new Date('2026-07-02T00:00:00Z'), period: 1, facultyId: new Types.ObjectId(w.facultyId), status: 'open',
    });
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.held).toBe(1);
    expect(s.courses[0]!.held).toBe(1);
  });

  it('maps od/late/absent per §5.4 and computes headroom only above threshold', async () => {
    const w = await seedWorld();
    const ses = [
      await closeSession(w.offeringId, w.facultyId, 1),
      await closeSession(w.offeringId, w.facultyId, 2),
      await closeSession(w.offeringId, w.facultyId, 3),
      await closeSession(w.offeringId, w.facultyId, 4),
    ];
    const statuses = ['present', 'od', 'late', 'absent'];
    for (let i = 0; i < statuses.length; i++) await mark(ses[i]!, w.studentId, w.byPersonId, statuses[i]!);
    const course = await courseAttendanceFor(collegeId.toString(), w.studentId, w.offeringId);
    expect(course.held).toBe(4);
    expect(course.attended).toBe(3);
    expect(course.pct).toBe(75);
    expect(course.headroom).toBe(0);
    expect(course.threshold).toBe(75);
  });

  it('held = 0 → pct null, headroom 0, overallPct null (R13)', async () => {
    const w = await seedWorld();
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.held).toBe(0);
    expect(s.overallPct).toBeNull();
    expect(s.courses[0]!.held).toBe(0);
    expect(s.courses[0]!.pct).toBeNull();
    expect(s.courses[0]!.headroom).toBe(0);
  });

  it('scopes courses to active-semester enrollments', async () => {
    const w = await seedWorld();
    const doneSemester = await Semester.create({
      collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 1,
      startDate: new Date('2025-06-01T00:00:00Z'), endDate: new Date('2025-12-01T00:00:00Z'), status: 'completed',
    });
    const otherCourse = await Course.create({
      collegeId, code: 'CS102', name: 'Other', regulationId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(), credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0,
      type: 'theory', isElective: false,
    });
    const otherOffering = await CourseOffering.create({
      collegeId, courseId: otherCourse._id, semesterId: doneSemester._id,
      sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(w.facultyId), status: 'active',
    });
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), courseOfferingId: otherOffering._id,
      semesterId: doneSemester._id, status: 'enrolled',
    });
    await closeSession(w.offeringId, w.facultyId, 1);
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.courses.length).toBe(1);
    expect(s.courses[0]!.offeringId).toBe(w.offeringId);
  });

  it('aggregates overall as Σattended ÷ Σheld', async () => {
    const w = await seedWorld();
    const other = await CourseOffering.create({
      collegeId, courseId: new Types.ObjectId(w.courseId), semesterId,
      sectionId: new Types.ObjectId(), facultyId: new Types.ObjectId(w.facultyId), status: 'active',
    });
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(w.studentId), courseOfferingId: other._id,
      semesterId, status: 'enrolled',
    });
    const a = await closeSession(w.offeringId, w.facultyId, 1);
    const b = await closeSession(String(other._id), w.facultyId, 2);
    const c = await closeSession(String(other._id), w.facultyId, 3);
    await mark(a, w.studentId, w.byPersonId, 'present');
    await mark(b, w.studentId, w.byPersonId, 'present');
    await mark(c, w.studentId, w.byPersonId, 'absent');
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.courses.map((course) => course.pct)).toEqual([100, 50]);
    expect(s.overallPct).toBe(66.7);
  });

  it('uses College juvi.attendanceThreshold for bands and headroom', async () => {
    const w = await seedWorld(60);
    const ses: Types.ObjectId[] = [];
    for (let i = 1; i <= 22; i++) ses.push(await closeSession(w.offeringId, w.facultyId, i));
    for (let i = 0; i < 14; i++) await mark(ses[i]!, w.studentId, w.byPersonId, 'present');
    const s = await attendanceFor(collegeId.toString(), w.studentId);
    expect(s.threshold).toBe(60);
    expect(s.courses[0]!.pct).toBe(63.6);
    expect(s.courses[0]!.headroom).toBe(1);
    expect(await attendanceThresholdFor(collegeId.toString())).toBe(60);
  });

  it('defaults the threshold to 75 when the College has no setting', async () => {
    await seedWorld();
    expect(await attendanceThresholdFor(collegeId.toString())).toBe(75);
  });

  it('reports available only once a closed session exists', async () => {
    const w = await seedWorld();
    expect(await attendanceAvailableFor(collegeId.toString())).toBe(false);
    await closeSession(w.offeringId, w.facultyId, 1);
    expect(await attendanceAvailableFor(collegeId.toString())).toBe(true);
  });

  it('404s an unknown course offering', async () => {
    await seedWorld();
    await expect(
      courseAttendanceFor(collegeId.toString(), new Types.ObjectId().toString(), new Types.ObjectId().toString()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
