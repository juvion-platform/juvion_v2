import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { College } from '../../../models/College';
import { AttendanceAlert } from '../../../models/academic-ops/AttendanceAlert';
import { AttendanceRecord } from '../../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../../models/academic-ops/AttendanceSession';
import { AttendanceSummary } from '../../../models/academic-ops/AttendanceSummary';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { Semester } from '../../../models/academic-structure/Semester';
import { Faculty } from '../../../models/people/Faculty';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import {
  bulkUpsertAttendanceRecords,
  createAttendanceRecord,
  createAttendanceSession,
  deleteAttendanceRecord,
  deleteAttendanceSession,
  recomputeSummaries,
  updateAttendanceRecord,
  updateAttendanceSession,
  updateAttendanceSummary,
} from '../service';
import {
  checkAttendanceThreshold,
  checkHallTicketEligibility,
  computeAttendanceSummary,
  generateAttendanceAlerts,
} from '../academic-delivery-service';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let semesterId = new Types.ObjectId();
let codeSeq = 0;

interface SeedBase {
  studentIds: [string, string];
  byPersonId: string;
  facultyId: string;
  courseId: string;
  offeringIds: [string, string];
  makeOffering: () => Promise<Types.ObjectId>;
}

async function seedBase(withThreshold?: number): Promise<SeedBase> {
  if (withThreshold !== undefined) {
    const college = await College.create({
      name: 'Juvi Test College', code: `JTC${Date.now()}_${codeSeq++}`,
      address: { line1: 'Road 1', city: 'X', state: 'Y', pincode: '501001' },
      contactEmail: 'a@juvion.test', contactPhone: '9000000000',
      juvi: { enabled: true, attendanceThreshold: withThreshold },
    });
    // Reassigns the module-scope collegeId; clearCollections() clears Mongo but not Redis, and getJuviConfig caches for 60 s, so a later seedBase() can read a stale threshold. (R91)
    collegeId = college._id as Types.ObjectId;
  }
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  semesterId = semester._id as Types.ObjectId;
  const people = await Person.create([
    { collegeId, name: 'Teacher One', phone: '9000090001', gender: 'male' },
    { collegeId, name: 'Student A', phone: '9000090002', gender: 'male' },
    { collegeId, name: 'Student B', phone: '9000090003', gender: 'female' },
  ]);
  const [byPerson, sA, sB] = people;
  const faculty = await Faculty.create({
    collegeId, personId: byPerson!._id, employeeCode: `FAC${codeSeq++}`,
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const students = await Student.create([
    { collegeId, personId: sA!._id, admissionYear: 2026, rollNumber: `26JITA${codeSeq++}`, status: 'active', onboardingStatus: 'not_started' },
    { collegeId, personId: sB!._id, admissionYear: 2026, rollNumber: `26JITB${codeSeq++}`, status: 'active', onboardingStatus: 'not_started' },
  ]);
  const course = await Course.create({
    collegeId, code: `CS${codeSeq++}`, name: 'Intro',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const makeOffering = (): Promise<Types.ObjectId> =>
    CourseOffering.create({
      collegeId, courseId: course._id, semesterId,
      sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 0,
    }).then((o) => o._id as Types.ObjectId);
  const a = await makeOffering();
  const b = await makeOffering();
  await Enrollment.create({ collegeId, studentId: students[0]!._id, courseOfferingId: a, semesterId, status: 'enrolled' });
  await Enrollment.create({ collegeId, studentId: students[0]!._id, courseOfferingId: b, semesterId, status: 'enrolled' });
  await Enrollment.create({ collegeId, studentId: students[1]!._id, courseOfferingId: a, semesterId, status: 'enrolled' });
  return {
    studentIds: [String(students[0]!._id), String(students[1]!._id)],
    byPersonId: String(byPerson!._id),
    facultyId: String(faculty._id),
    courseId: String(course._id),
    offeringIds: [String(a), String(b)],
    makeOffering,
  };
}

async function closedSession(offeringId: string, facultyId: string, day: number): Promise<Types.ObjectId> {
  const doc = await AttendanceSession.create({
    collegeId, courseOfferingId: new Types.ObjectId(offeringId),
    date: new Date(`2026-07-${String(day).padStart(2, '0')}T00:00:00Z`), period: 1,
    facultyId: new Types.ObjectId(facultyId), status: 'closed',
  });
  return doc._id as Types.ObjectId;
}

async function rec(sessionId: Types.ObjectId, studentId: string, byPersonId: string, status: string): Promise<void> {
  await AttendanceRecord.create({
    collegeId, sessionId, studentId: new Types.ObjectId(studentId),
    status, markedBy: new Types.ObjectId(byPersonId),
  });
}

function summaryFilter(studentId: string, offeringId: string) {
  return { collegeId: collegeId.toString(), studentId, courseOfferingId: offeringId };
}

// This suite imports ../service + ../academic-delivery-service, which register
// ~60 models on the connection; mongoose builds their indexes lazily on the
// FIRST write, so under the full parallel suite (CI runs `vitest run`, all
// files) the first test overruns vitest's 5 s default even though the file
// passes standalone in ~1.5 s. Same shape and same remedy as the sibling
// `promote-students-pin.test.ts` (identical import graph): a describe-level
// timeout, not a `vi.setConfig` override.
describe('attendance summary wiring', { timeout: 30_000 }, () => {
  beforeEach(async () => { await clearCollections(); });

  it('stores a null percentage and safe category when nothing was held, and never alerts (R13)', async () => {
    const b = await seedBase();
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBeNull();
    expect(s.category).toBe('safe');
    expect(s.projectedFinal).toBe(0);
    expect(await AttendanceAlert.countDocuments({ collegeId })).toBe(0);
  });

  it('rounds to one decimal, categorises at_risk and creates one alert', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'od');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.totalClasses).toBe(3);
    expect(s.percentage).toBe(66.7);
    expect(s.category).toBe('at_risk');
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('at_risk');
    expect(alert?.threshold).toBe(65);
  });

  it('keeps the hard-coded warning band at threshold 75 (R9 pin)', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
      await closedSession(b.offeringIds[0]!, b.facultyId, 4),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[3]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBe(75);
    expect(s.category).toBe('warning');
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('warning');
    expect(alert?.threshold).toBe(75);
  });

  it('moves categories with juvi.attendanceThreshold but keeps alert thresholds hard-coded (R9 pin)', async () => {
    const b = await seedBase(60);
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
      await closedSession(b.offeringIds[0]!, b.facultyId, 3),
      await closedSession(b.offeringIds[0]!, b.facultyId, 4),
      await closedSession(b.offeringIds[0]!, b.facultyId, 5),
    ];
    await rec(ses[0]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[1]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[2]!, b.studentIds[0]!, b.byPersonId, 'present');
    await rec(ses[3]!, b.studentIds[0]!, b.byPersonId, 'absent');
    await rec(ses[4]!, b.studentIds[0]!, b.byPersonId, 'absent');
    const s = await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(s.percentage).toBe(60);
    expect(s.category).toBe('warning'); // T = 60: warning band [60, 70)
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[0]! });
    expect(alert?.alertType).toBe('warning');
    expect(alert?.threshold).toBe(75); // NOT 60 — the alert path ignores the setting per R9
  });

  it('bulkUpsertAttendanceRecords keeps summaries current for every marked student', async () => {
    const b = await seedBase();
    const ses = [
      await closedSession(b.offeringIds[0]!, b.facultyId, 1),
      await closedSession(b.offeringIds[0]!, b.facultyId, 2),
    ];
    await bulkUpsertAttendanceRecords(collegeId.toString(), [
      { sessionId: String(ses[0]), studentId: b.studentIds[0], status: 'present', markedBy: b.byPersonId },
      { sessionId: String(ses[1]), studentId: b.studentIds[0], status: 'present', markedBy: b.byPersonId },
      { sessionId: String(ses[0]), studentId: b.studentIds[1], status: 'absent', markedBy: b.byPersonId },
      { sessionId: String(ses[1]), studentId: b.studentIds[1], status: 'absent', markedBy: b.byPersonId },
    ]);
    const a = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(a?.percentage).toBe(100);
    const c = await AttendanceSummary.findOne(summaryFilter(b.studentIds[1]!, b.offeringIds[0]!));
    expect(c?.percentage).toBe(0);
    expect(c?.category).toBe('detained');
    expect(
      await AttendanceSummary.countDocuments(summaryFilter(b.studentIds[1]!, b.offeringIds[1]!)),
    ).toBe(0);
  });

  it('closing a session recomputes every enrolled student; opening does not', async () => {
    const b = await seedBase();
    await createAttendanceSession(collegeId.toString(), {
      courseOfferingId: b.offeringIds[0], date: '2026-07-01', period: 1, facultyId: b.facultyId, status: 'closed',
    }, 'user-1');
    expect(await AttendanceSummary.countDocuments({ collegeId, courseOfferingId: b.offeringIds[0] })).toBe(2);
    await createAttendanceSession(collegeId.toString(), {
      courseOfferingId: b.offeringIds[1], date: '2026-07-02', period: 1, facultyId: b.facultyId, status: 'open',
    }, 'user-1');
    expect(await AttendanceSummary.countDocuments({ collegeId, courseOfferingId: b.offeringIds[1] })).toBe(0);
  });

  it('moving a session to another offering recomputes both offerings', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[1]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[1]!);
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!); // both rows pre-exist
    await updateAttendanceSession(collegeId.toString(), String(sesId), { courseOfferingId: b.offeringIds[0]! }, 'user-1');
    const movedFrom = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[1]!));
    expect(movedFrom?.totalClasses).toBe(0);
    expect(movedFrom?.percentage).toBeNull();
    const movedTo = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(movedTo?.totalClasses).toBe(1);
    expect(movedTo?.percentage).toBe(100);
  });

  it('create and update attendance records keep the summary fresh', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    const doc = await createAttendanceRecord(collegeId.toString(), {
      sessionId: String(sesId), studentId: b.studentIds[0]!, status: 'absent', markedBy: b.byPersonId,
    }, 'user-1');
    let s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.percentage).toBe(0);
    await updateAttendanceRecord(collegeId.toString(), String(doc._id), { status: 'present' }, 'user-1');
    s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.percentage).toBe(100);
  });

  it('deleting a session recomputes its summaries from remaining records', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    await deleteAttendanceSession(collegeId.toString(), String(sesId), 'user-1');
    const s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.totalClasses).toBe(0);
    expect(s?.percentage).toBeNull();
  });

  it('deleting an attendance record recomputes the summary to 0%', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    const recDoc = await AttendanceRecord.create({
      collegeId, sessionId: sesId, studentId: new Types.ObjectId(b.studentIds[0]!),
      status: 'present', markedBy: new Types.ObjectId(b.byPersonId),
    });
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect((await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!)))?.percentage).toBe(100);
    await deleteAttendanceRecord(collegeId.toString(), String(recDoc._id), 'user-1');
    const s = await AttendanceSummary.findOne(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!));
    expect(s?.attended).toBe(0);
    expect(s?.percentage).toBe(0);
  });

  it('recomputeSummaries dedupes pairs and survives unknown offerings', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    await expect(recomputeSummaries(collegeId.toString(), [
      { studentId: b.studentIds[0]!, courseOfferingId: new Types.ObjectId().toString() }, // unknown — swallowed
      { studentId: b.studentIds[0]!, courseOfferingId: b.offeringIds[0]! },
      { studentId: b.studentIds[0]!, courseOfferingId: b.offeringIds[0]! }, // duplicate — deduped
    ])).resolves.toBeUndefined();
    expect(
      await AttendanceSummary.countDocuments(summaryFilter(b.studentIds[0]!, b.offeringIds[0]!)),
    ).toBe(1);
  });

  it('computeAttendanceSummary matches the formula and leaves projectedFinal unset', async () => {
    const b = await seedBase();
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    const computed = await computeAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(computed.percentage).toBe(100);
    expect(computed.projectedFinal).toBeUndefined();
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[0]!);
    const viaUpdate = await AttendanceSummary.findOne(summaryFilter(b.studentIds[1]!, b.offeringIds[0]!));
    expect(viaUpdate?.projectedFinal).toBe(0);
  });

  it('checkAttendanceThreshold returns 0/false for a null percentage in both branches', async () => {
    const b = await seedBase();
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!); // row with pct null
    const stored = await checkAttendanceThreshold(collegeId.toString(), b.studentIds[0]!, b.offeringIds[0]!);
    expect(stored).toEqual({ meetsThreshold: false, percentage: 0, threshold: 75 });
    const computed = await checkAttendanceThreshold(collegeId.toString(), b.studentIds[1]!, b.offeringIds[1]!); // no row
    expect(computed).toEqual({ meetsThreshold: false, percentage: 0, threshold: 75 });
  });

  it('generateAttendanceAlerts skips never-held students and alerts only the 0% one', async () => {
    const b = await seedBase();
    expect(await generateAttendanceAlerts(collegeId.toString(), b.offeringIds[0]!, 'user-1'))
      .toEqual({ alertCount: 0, totalStudents: 2 });
    const sesId = await closedSession(b.offeringIds[0]!, b.facultyId, 1);
    await rec(sesId, b.studentIds[0]!, b.byPersonId, 'present');
    expect(await generateAttendanceAlerts(collegeId.toString(), b.offeringIds[0]!, 'user-1'))
      .toEqual({ alertCount: 1, totalStudents: 2 });
    const alert = await AttendanceAlert.findOne({ collegeId, studentId: b.studentIds[1]! });
    expect(alert?.alertType).toBe('detained');
  });

  it('hall-ticket eligibility passes a never-held course and still blocks a 0% one (R13)', async () => {
    const b = await seedBase();
    await Enrollment.create({
      collegeId, studentId: new Types.ObjectId(b.studentIds[1]!),
      courseOfferingId: new Types.ObjectId(b.offeringIds[1]!), semesterId, status: 'enrolled',
    });
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[0]!); // stays null
    const sesId = await closedSession(b.offeringIds[1]!, b.facultyId, 2);
    await rec(sesId, b.studentIds[1]!, b.byPersonId, 'absent');
    await updateAttendanceSummary(collegeId.toString(), b.studentIds[1]!, b.offeringIds[1]!); // 0%
    const { reasons } = await checkHallTicketEligibility(collegeId.toString(), b.studentIds[1]!, semesterId.toString());
    expect(reasons.filter((r) => r.includes('Attendance below'))).toHaveLength(1);
    expect(reasons.join('; ')).toContain(b.offeringIds[1]!);
  });
});
