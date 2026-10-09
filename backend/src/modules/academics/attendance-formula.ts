import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { getJuviConfig } from '../juvi-app/config/institution-config';
import { activeSemesterIds } from './live-timetable';

/** Spec §5.4: percentages round to one decimal, in exactly one place. */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export type AttendanceCategory = 'safe' | 'warning' | 'at_risk' | 'detained';

/**
 * Spec §5.4 bands relative to the college's threshold:
 * safe ≥ T+10, warning [T, T+10), at_risk [T−10, T), detained < T−10.
 * A null percentage (no classes held) is 'safe' — it never generates alerts.
 */
export function attendanceCategory(pct: number | null, threshold: number): AttendanceCategory {
  if (pct === null) return 'safe';
  if (pct >= threshold + 10) return 'safe';
  if (pct >= threshold) return 'warning';
  if (pct >= threshold - 10) return 'at_risk';
  return 'detained';
}

export async function attendanceThresholdFor(collegeId: string): Promise<number> {
  const cfg = await getJuviConfig(collegeId);
  return cfg?.attendanceThreshold ?? 75;
}

/** Spec §6 reader `available`: the college has any closed attendance session. */
export async function attendanceAvailableFor(collegeId: string): Promise<boolean> {
  return (await AttendanceSession.countDocuments({ collegeId, status: 'closed' })) > 0;
}

export interface CourseAttendance {
  offeringId: string;
  courseCode: string;
  title: string;
  held: number;
  attended: number;
  pct: number | null;
  headroom: number;
  threshold: number;
}

/**
 * Spec §5.4 for one (student, offering). held = closed sessions;
 * attended = records with status present | late | od;
 * pct = round1(attended / held × 100), null when held = 0;
 * headroom = max(0, floor(attended / (T/100) − held)), defined only when pct ≥ T, else 0.
 */
export async function courseAttendanceFor(
  collegeId: string,
  studentId: string,
  offeringId: string,
  threshold?: number,
): Promise<CourseAttendance> {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');
  const T = threshold ?? (await attendanceThresholdFor(collegeId));
  const sessionFilter = { collegeId, courseOfferingId: offeringId, status: 'closed' as const };
  const [held, sessionIds, course] = await Promise.all([
    AttendanceSession.countDocuments(sessionFilter),
    AttendanceSession.find(sessionFilter).select('_id').lean<{ _id: Types.ObjectId }[]>(),
    Course.findOne({ _id: offering.courseId, collegeId }).select('code name').lean<{ code: string; name: string } | null>(),
  ]);
  const attended = sessionIds.length
    ? await AttendanceRecord.countDocuments({
        collegeId,
        studentId,
        sessionId: { $in: sessionIds.map((s) => s._id) },
        status: { $in: ['present', 'late', 'od'] },
      })
    : 0;
  const pct = held > 0 ? round1((attended / held) * 100) : null;
  return {
    offeringId,
    courseCode: course?.code ?? '',
    title: course?.name ?? '',
    held,
    attended,
    pct,
    headroom: pct !== null && pct >= T ? Math.max(0, Math.floor(attended / (T / 100) - held)) : 0,
    threshold: T,
  };
}

export interface StudentAttendance {
  courses: CourseAttendance[];
  held: number;
  attended: number;
  overallPct: number | null;
  threshold: number;
}

/**
 * Spec §5.4 overall: Σattended ÷ Σheld across the student's enrolled courses in
 * active semesters. channelId is deliberately out of the formula — readers add it (R12).
 */
export async function attendanceFor(
  collegeId: string,
  studentId: string,
  threshold?: number,
): Promise<StudentAttendance> {
  const T = threshold ?? (await attendanceThresholdFor(collegeId));
  const semesterIds = await activeSemesterIds(collegeId);
  if (semesterIds.length === 0) return { courses: [], held: 0, attended: 0, overallPct: null, threshold: T };
  const enrollments = await Enrollment.find({
    collegeId,
    studentId,
    status: 'enrolled',
    semesterId: { $in: semesterIds },
  }).select('courseOfferingId').lean<{ courseOfferingId: Types.ObjectId }[]>();
  const offeringIds = [...new Set(enrollments.map((e) => String(e.courseOfferingId)))];
  const courses: CourseAttendance[] = [];
  for (const id of offeringIds) courses.push(await courseAttendanceFor(collegeId, studentId, id, T));
  const held = courses.reduce((sum, c) => sum + c.held, 0);
  const attended = courses.reduce((sum, c) => sum + c.attended, 0);
  return {
    courses,
    held,
    attended,
    overallPct: held > 0 ? round1((attended / held) * 100) : null,
    threshold: T,
  };
}
