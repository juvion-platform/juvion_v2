import {
  Course, CourseOffering, Enrollment,
  AttendanceSession, InternalAssessment,
  Person, Faculty,
} from '../../models';
import { createTestUser } from './user.factory';

let courseCounter = 0;
let facultyCounter = 0;

export async function createTestCourse(collegeId: string, opts: {
  regulationId: string;
  departmentId: string;
  code?: string;
  name?: string;
  credits?: number;
}) {
  courseCounter++;
  return Course.create({
    collegeId,
    code: opts.code ?? `CS${String(100 + courseCounter)}`,
    name: opts.name ?? `Test Course ${courseCounter}`,
    regulationId: opts.regulationId,
    departmentId: opts.departmentId,
    credits: opts.credits ?? 4,
    lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0,
    type: 'theory',
    isElective: false,
  });
}

export async function createTestFaculty(collegeId: string, opts?: {
  departmentId?: string;
  name?: string;
  designation?: string;
}) {
  facultyCounter++;
  const name = opts?.name ?? `Test Faculty ${facultyCounter}`;
  const email = `faculty${facultyCounter}@test.com`;

  const person = await Person.create({
    collegeId, name,
    phone: `80000${String(facultyCounter).padStart(5, '0')}`,
    email, gender: 'male',
  });

  const faculty = await Faculty.create({
    collegeId, personId: person._id,
    employeeCode: `FAC${String(facultyCounter).padStart(4, '0')}`,
    designation: opts?.designation ?? 'Assistant Professor',
    departmentId: opts?.departmentId,
    contractType: 'regular',
    status: 'active',
  });

  const { user, token } = await createTestUser({
    collegeId, role: 'faculty', personaType: 'L-FAC',
    name, email, personId: String(person._id),
  });

  return { person, faculty, user, token };
}

export async function createTestCourseOffering(collegeId: string, opts: {
  courseId: string; semesterId: string; sectionId: string; facultyId: string; maxEnrollment?: number;
}) {
  return CourseOffering.create({
    collegeId, courseId: opts.courseId, semesterId: opts.semesterId,
    sectionId: opts.sectionId, facultyId: opts.facultyId,
    maxEnrollment: opts.maxEnrollment ?? 60, enrolledCount: 0,
  });
}

export async function createTestEnrollment(collegeId: string, opts: {
  studentId: string; courseOfferingId: string; semesterId: string;
}) {
  return Enrollment.create({
    collegeId, studentId: opts.studentId,
    courseOfferingId: opts.courseOfferingId,
    semesterId: opts.semesterId,
    status: 'enrolled', enrolledAt: new Date(),
  });
}

export async function createTestAttendanceSession(collegeId: string, opts: {
  courseOfferingId: string; facultyId: string; date?: Date; period?: number;
}) {
  return AttendanceSession.create({
    collegeId, courseOfferingId: opts.courseOfferingId,
    date: opts.date ?? new Date(), period: opts.period ?? 1,
    facultyId: opts.facultyId, status: 'open',
  });
}

export async function createTestInternalAssessment(collegeId: string, opts: {
  courseOfferingId: string; name?: string; type?: string; maxMarks?: number;
}) {
  return InternalAssessment.create({
    collegeId, courseOfferingId: opts.courseOfferingId,
    name: opts.name ?? 'Mid 1', type: opts.type ?? 'mid1',
    maxMarks: opts.maxMarks ?? 30, weightage: 15, status: 'conducted',
  });
}
