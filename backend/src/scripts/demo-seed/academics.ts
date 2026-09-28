import { Types } from 'mongoose';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Semester } from '../../models/academic-structure/Semester';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { InternalMark } from '../../models/academic-ops/InternalMark';
import { Backlog } from '../../models/academic-ops/Backlog';
import { RiskSignal } from '../../models/welfare/RiskSignal';
import { DemoCtx, DAY, rng } from './context';

/** Insert in chunks so a remote database never sees one giant batch. */
async function insertChunked<T>(insert: (docs: T[]) => Promise<unknown>, docs: T[], size = 1000) {
  for (let i = 0; i < docs.length; i += size) await insert(docs.slice(i, i + size));
}

/** Signal types currently active per student — the academics must back them up. */
async function signalsByStudent(collegeId: string): Promise<Map<string, Set<string>>> {
  const rows = await RiskSignal.find({ collegeId, expiresAt: { $gt: new Date() } }).select({ studentId: 1, signalType: 1 }).lean();
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = String(r.studentId);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(r.signalType as string);
  }
  return m;
}

export async function seedAcademics(ctx: DemoCtx): Promise<void> {
  const cid = ctx.collegeId;
  const r = rng(20260931);
  const signals = await signalsByStudent(cid);
  const has = (id: Types.ObjectId, t: string) => signals.get(String(id))?.has(t) ?? false;

  const offerings = await CourseOffering.find({ collegeId: cid, semesterId: ctx.semesterId, sectionId: { $in: [...new Set(ctx.students.map((s) => String(s.sectionId)))] } })
    .select({ sectionId: 1, facultyId: 1, courseId: 1 }).lean();
  const facultyPerson = new Map(ctx.faculty.map((f) => [String(f._id), f.personId]));
  const bySection = new Map<string, Types.ObjectId[]>();
  for (const s of ctx.students) {
    const k = String(s.sectionId);
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k)!.push(s._id);
  }

  // ── Enrollments ────────────────────────────────────────────────────────
  const enrolled = new Set((await Enrollment.find({ collegeId: cid, courseOfferingId: { $in: offerings.map((o) => o._id) } }).select({ studentId: 1, courseOfferingId: 1 }).lean())
    .map((e) => `${e.studentId}|${e.courseOfferingId}`));
  const newEnrollments = offerings.flatMap((o) => (bySection.get(String(o.sectionId)) ?? [])
    .filter((sid) => !enrolled.has(`${sid}|${o._id}`))
    .map((sid) => ({ collegeId: cid, studentId: sid, courseOfferingId: o._id, semesterId: ctx.semesterId, status: 'enrolled' })));
  await insertChunked((d) => Enrollment.insertMany(d), newEnrollments);

  // ── Attendance: Mon/Wed/Fri over the last eight weeks of the term ───────
  // Per-student rate. A student with an attendance signal holds up for five
  // weeks and then drops off — the register shows the cliff the signal names.
  const rate = new Map<string, number>();
  for (const s of ctx.students) rate.set(String(s._id), 0.8 + r.next() * 0.17);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const from = new Date(Math.max(ctx.semesterStart.getTime(), today.getTime() - 56 * DAY));
  const days: Date[] = [];
  for (let d = new Date(from); d < today; d = new Date(d.getTime() + DAY)) if ([1, 3, 5].includes(d.getDay())) days.push(new Date(d));
  const cliff = today.getTime() - 21 * DAY;

  let sessions = 0, records = 0;
  for (const [oi, o] of offerings.entries()) {
    if (await AttendanceSession.exists({ collegeId: cid, courseOfferingId: o._id })) continue;
    const markedBy = facultyPerson.get(String(o.facultyId)) ?? ctx.faculty[0]!.personId;
    const created = await AttendanceSession.insertMany(days.map((date) => ({
      collegeId: cid, courseOfferingId: o._id, date: new Date(date.getTime() + (9 + (oi % 3)) * 3_600_000), period: (oi % 3) + 1,
      facultyId: o.facultyId, status: 'closed',
    })));
    sessions += created.length;
    const recs: Record<string, unknown>[] = [];
    for (const sess of created) {
      const late = sess.date.getTime() >= cliff;
      for (const sid of bySection.get(String(o.sectionId)) ?? []) {
        let p = rate.get(String(sid))!;
        if (has(sid, 'attendance_drop')) p = late ? 0.3 : 0.86;
        else if (has(sid, 'failing_grades') || has(sid, 'backlog_accumulation')) p = Math.min(p, 0.78);
        const x = r.next();
        const status = x < p ? (x < p - 0.04 ? 'present' : 'late') : x < p + 0.02 ? 'od' : 'absent';
        recs.push({ collegeId: cid, sessionId: sess._id, studentId: sid, status, markedBy });
      }
    }
    await insertChunked((d) => AttendanceRecord.insertMany(d), recs);
    records += recs.length;
  }

  // ── Mid-I marks, out of 30 ─────────────────────────────────────────────
  let marks = 0;
  for (const o of offerings) {
    if (await InternalAssessment.exists({ collegeId: cid, courseOfferingId: o._id, type: 'mid1' })) continue;
    const a = await InternalAssessment.create({
      collegeId: cid, courseOfferingId: o._id, name: 'Mid-I Examination', type: 'mid1', maxMarks: 30, weightage: 30,
      scheduledDate: new Date(today.getTime() - 18 * DAY), status: 'marks_entered',
    });
    const docs = (bySection.get(String(o.sectionId)) ?? []).map((sid) => {
      const m = has(sid, 'failing_grades') ? r.int(5, 10) : has(sid, 'backlog_accumulation') ? r.int(9, 14) : r.int(14, 29);
      return { collegeId: cid, assessmentId: a._id, studentId: sid, marksObtained: m };
    });
    await InternalMark.insertMany(docs);
    marks += docs.length;
  }

  // ── Backlogs from last year's even term ────────────────────────────────
  const prevAy = await AcademicYear.findOne({ collegeId: cid, code: 'AY2025-26' }).select({ _id: 1 }).lean()
    ?? await AcademicYear.create({ collegeId: cid, code: 'AY2025-26', label: 'Academic Year 2025-26', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), status: 'completed', isCurrent: false });
  const prevSem = await Semester.findOne({ collegeId: cid, academicYearId: prevAy._id, number: 2 }).select({ _id: 1 }).lean()
    ?? await Semester.create({ collegeId: cid, academicYearId: prevAy._id, number: 2, year: 2026, startDate: new Date('2026-01-10'), endDate: new Date('2026-05-30'), status: 'completed' });
  let backlogs = 0;
  if (!(await Backlog.exists({ collegeId: cid, semesterId: prevSem._id }))) {
    const coursesByBranch = new Map<string, Types.ObjectId[]>();
    for (const [code, dept] of Object.entries(ctx.departments)) {
      coursesByBranch.set(code, (await Course.find({ collegeId: cid, departmentId: dept }).select({ _id: 1 }).lean()).map((c) => c._id as Types.ObjectId));
    }
    const docs: Record<string, unknown>[] = [];
    for (const s of ctx.students.filter((x) => x.year >= 2)) {
      const courses = coursesByBranch.get(s.branch) ?? [];
      if (!courses.length) continue;
      const flagged = has(s._id, 'backlog_accumulation');
      const n = flagged ? 2 : r.next() < 0.08 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        docs.push({
          collegeId: cid, studentId: s._id, courseId: courses[(k * 3) % courses.length], semesterId: prevSem._id,
          originalExamType: 'regular', attempts: flagged ? 2 : 1, currentStatus: flagged ? 'persists' : r.pick(['registered_for_supplementary', 'cleared', 'created']),
        });
      }
    }
    if (docs.length) await Backlog.insertMany(docs);
    backlogs = docs.length;
  }

  ctx.log(`academics: ${newEnrollments.length} enrollments, ${sessions} attendance sessions (${records} marks of attendance), ${marks} mid-term marks, ${backlogs} backlogs`);
}
