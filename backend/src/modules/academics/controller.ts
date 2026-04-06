import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Stats ──────────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getStats(req.collegeId!)); } catch (e) { next(e); }
}

// ─── Regulations ────────────────────────────────────────────
export async function listRegulations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listRegulations(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getRegulation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getRegulation(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createRegulation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createRegulation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateRegulation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateRegulation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteRegulation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteRegulation(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Programmes ─────────────────────────────────────────────
export async function listProgrammes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listProgrammes(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getProgramme(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getProgramme(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createProgramme(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createProgramme(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateProgramme(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateProgramme(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteProgramme(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteProgramme(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Departments ────────────────────────────────────────────
export async function listDepartments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listDepartments(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getDepartment(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createDepartment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateDepartment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteDepartment(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Branches ───────────────────────────────────────────────
export async function listBranches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listBranches(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getBranch(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createBranch(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateBranch(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteBranch(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Batches ────────────────────────────────────────────────
export async function listBatches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listBatches(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getBatch(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createBatch(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateBatch(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteBatch(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Sections ───────────────────────────────────────────────
export async function listSections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listSections(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getSection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getSection(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createSection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createSection(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateSection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateSection(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteSection(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteSection(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Academic Years ─────────────────────────────────────────
export async function listAcademicYears(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await svc.listAcademicYears(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}
export async function getAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getAcademicYear(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createAcademicYear(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateAcademicYear(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteAcademicYear(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteAcademicYear(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Semesters ──────────────────────────────────────────────
export async function listSemesters(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', academicYearId } = req.query as any;
    res.json(await svc.listSemesters(req.collegeId!, +page, +limit, academicYearId));
  } catch (e) { next(e); }
}
export async function getSemester(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getSemester(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createSemester(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createSemester(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateSemester(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateSemester(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteSemester(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteSemester(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Courses ────────────────────────────────────────────────
export async function listCourses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', regulationId } = req.query as any;
    res.json(await svc.listCourses(req.collegeId!, +page, +limit, regulationId));
  } catch (e) { next(e); }
}
export async function getCourse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getCourse(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createCourse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCourse(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateCourse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCourse(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCourse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCourse(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Curriculum Maps ────────────────────────────────────────
export async function listCurriculumMaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', branchId, semester } = req.query as any;
    res.json(await svc.listCurriculumMaps(req.collegeId!, +page, +limit, branchId, semester ? +semester : undefined));
  } catch (e) { next(e); }
}
export async function createCurriculumMap(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCurriculumMap(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateCurriculumMap(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCurriculumMap(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCurriculumMap(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCurriculumMap(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Course Offerings ───────────────────────────────────────
export async function listCourseOfferings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', semesterId } = req.query as any;
    res.json(await svc.listCourseOfferings(req.collegeId!, +page, +limit, semesterId));
  } catch (e) { next(e); }
}
export async function getCourseOffering(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getCourseOffering(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createCourseOffering(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCourseOffering(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateCourseOffering(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCourseOffering(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCourseOffering(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCourseOffering(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Enrollments ────────────────────────────────────────────
export async function listEnrollments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', semesterId } = req.query as any;
    res.json(await svc.listEnrollments(req.collegeId!, +page, +limit, semesterId));
  } catch (e) { next(e); }
}
export async function createEnrollment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createEnrollment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateEnrollment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateEnrollment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteEnrollment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteEnrollment(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 3: Academic Calendar ═════════════════════════════
export async function listCalendarEvents(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '50', academicYearId } = req.query as any; res.json(await svc.listCalendarEvents(req.collegeId!, +page, +limit, academicYearId)); } catch (e) { next(e); }
}
export async function createCalendarEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCalendarEvent(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateCalendarEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCalendarEvent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCalendarEvent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCalendarEvent(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 3: Timetable ════════════════════════════════════
export async function listTimetables(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listTimetables(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function getTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getTimetable(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createTimetable(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateTimetable(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteTimetable(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteTimetable(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 3: Timetable Slots ══════════════════════════════
export async function listTimetableSlots(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listTimetableSlots(req.collegeId!, req.params.timetableId as string)); } catch (e) { next(e); }
}
export async function createTimetableSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createTimetableSlot(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateTimetableSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateTimetableSlot(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteTimetableSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteTimetableSlot(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 4: Attendance Sessions ══════════════════════════
export async function listAttendanceSessions(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', courseOfferingId } = req.query as any; res.json(await svc.listAttendanceSessions(req.collegeId!, +page, +limit, courseOfferingId)); } catch (e) { next(e); }
}
export async function getAttendanceSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getAttendanceSession(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createAttendanceSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createAttendanceSession(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateAttendanceSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateAttendanceSession(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteAttendanceSession(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteAttendanceSession(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 4: Attendance Records ═══════════════════════════
export async function listAttendanceRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listAttendanceRecords(req.collegeId!, req.params.sessionId as string)); } catch (e) { next(e); }
}
export async function createAttendanceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createAttendanceRecord(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateAttendanceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateAttendanceRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteAttendanceRecord(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteAttendanceRecord(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
export async function bulkCreateAttendanceRecords(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.bulkCreateAttendanceRecords(req.collegeId!, req.body.records, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 5: Internal Assessments ═════════════════════════
export async function listInternalAssessments(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', courseOfferingId } = req.query as any; res.json(await svc.listInternalAssessments(req.collegeId!, +page, +limit, courseOfferingId)); } catch (e) { next(e); }
}
export async function getInternalAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getInternalAssessment(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createInternalAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createInternalAssessment(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateInternalAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateInternalAssessment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteInternalAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteInternalAssessment(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 5: Internal Marks ═══════════════════════════════
export async function listInternalMarks(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listInternalMarks(req.collegeId!, req.params.assessmentId as string)); } catch (e) { next(e); }
}
export async function createInternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createInternalMark(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateInternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateInternalMark(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteInternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteInternalMark(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
export async function bulkCreateInternalMarks(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.bulkCreateInternalMarks(req.collegeId!, req.body.marks, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 6: Exam Registration ════════════════════════════
export async function listExamRegistrations(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listExamRegistrations(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function createExamRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createExamRegistration(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateExamRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateExamRegistration(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteExamRegistration(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteExamRegistration(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 6: Exam Schedule ════════════════════════════════
export async function listExamSchedules(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listExamSchedules(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function createExamSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createExamSchedule(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateExamSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateExamSchedule(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteExamSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteExamSchedule(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 6: External Marks ═══════════════════════════════
export async function listExternalMarks(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listExternalMarks(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function createExternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createExternalMark(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateExternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateExternalMark(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteExternalMark(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteExternalMark(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 7: Grade Cards ══════════════════════════════════
export async function listGradeCards(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId, studentId } = req.query as any; res.json(await svc.listGradeCards(req.collegeId!, +page, +limit, semesterId, studentId)); } catch (e) { next(e); }
}
export async function createGradeCard(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createGradeCard(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateGradeCard(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateGradeCard(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteGradeCard(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteGradeCard(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 7: Semester Results ═════════════════════════════
export async function listSemesterResults(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listSemesterResults(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function createSemesterResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createSemesterResult(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateSemesterResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateSemesterResult(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteSemesterResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteSemesterResult(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 8: Course Outcomes ══════════════════════════════
export async function listCourseOutcomes(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listCourseOutcomes(req.collegeId!, req.params.courseId as string)); } catch (e) { next(e); }
}
export async function createCourseOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCourseOutcome(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateCourseOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateCourseOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCourseOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCourseOutcome(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 8: Program Outcomes ═════════════════════════════
export async function listProgramOutcomes(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listProgramOutcomes(req.collegeId!, req.params.programmeId as string)); } catch (e) { next(e); }
}
export async function createProgramOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createProgramOutcome(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateProgramOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateProgramOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteProgramOutcome(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteProgramOutcome(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 8: Elective Allocations ═════════════════════════
export async function listElectiveAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', semesterId } = req.query as any; res.json(await svc.listElectiveAllocations(req.collegeId!, +page, +limit, semesterId)); } catch (e) { next(e); }
}
export async function createElectiveAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createElectiveAllocation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateElectiveAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateElectiveAllocation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteElectiveAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteElectiveAllocation(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 8: Lesson Plans ═════════════════════════════════
export async function listLessonPlans(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '50', courseOfferingId } = req.query as any; res.json(await svc.listLessonPlans(req.collegeId!, +page, +limit, courseOfferingId)); } catch (e) { next(e); }
}
export async function createLessonPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createLessonPlan(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateLessonPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateLessonPlan(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteLessonPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteLessonPlan(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ═══ Phase 8: Course Feedback ══════════════════════════════
export async function listCourseFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page = '1', limit = '20', courseOfferingId } = req.query as any; res.json(await svc.listCourseFeedback(req.collegeId!, +page, +limit, courseOfferingId)); } catch (e) { next(e); }
}
export async function createCourseFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createCourseFeedback(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteCourseFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteCourseFeedback(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
