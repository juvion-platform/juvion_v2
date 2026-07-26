import api from './api';

const BASE = '/academics';

// ─── Stats ─────────────────────────────────────────────
export const getStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Regulations ───────────────────────────────────────
export const listRegulations = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/regulations`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getRegulation = (id: string) =>
  api.get(`${BASE}/regulations/${id}`).then(r => r.data);
export const createRegulation = (data: any) =>
  api.post(`${BASE}/regulations`, data).then(r => r.data);
export const updateRegulation = (id: string, data: any) =>
  api.put(`${BASE}/regulations/${id}`, data).then(r => r.data);
export const deleteRegulation = (id: string) =>
  api.delete(`${BASE}/regulations/${id}`).then(r => r.data);

// ─── Programmes ────────────────────────────────────────
export const listProgrammes = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/programmes`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getProgramme = (id: string) =>
  api.get(`${BASE}/programmes/${id}`).then(r => r.data);
export const createProgramme = (data: any) =>
  api.post(`${BASE}/programmes`, data).then(r => r.data);
export const updateProgramme = (id: string, data: any) =>
  api.put(`${BASE}/programmes/${id}`, data).then(r => r.data);
export const deleteProgramme = (id: string) =>
  api.delete(`${BASE}/programmes/${id}`).then(r => r.data);

// ─── Departments ───────────────────────────────────────
export const listDepartments = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/departments`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getDepartment = (id: string) =>
  api.get(`${BASE}/departments/${id}`).then(r => r.data);
export const createDepartment = (data: any) =>
  api.post(`${BASE}/departments`, data).then(r => r.data);
export const updateDepartment = (id: string, data: any) =>
  api.put(`${BASE}/departments/${id}`, data).then(r => r.data);
export const deleteDepartment = (id: string) =>
  api.delete(`${BASE}/departments/${id}`).then(r => r.data);

// ─── Branches ──────────────────────────────────────────
export const listBranches = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/branches`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getBranch = (id: string) =>
  api.get(`${BASE}/branches/${id}`).then(r => r.data);
export const createBranch = (data: any) =>
  api.post(`${BASE}/branches`, data).then(r => r.data);
export const updateBranch = (id: string, data: any) =>
  api.put(`${BASE}/branches/${id}`, data).then(r => r.data);
export const deleteBranch = (id: string) =>
  api.delete(`${BASE}/branches/${id}`).then(r => r.data);

// ─── Batches ───────────────────────────────────────────
export const listBatches = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/batches`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getBatch = (id: string) =>
  api.get(`${BASE}/batches/${id}`).then(r => r.data);
export const createBatch = (data: any) =>
  api.post(`${BASE}/batches`, data).then(r => r.data);
export const updateBatch = (id: string, data: any) =>
  api.put(`${BASE}/batches/${id}`, data).then(r => r.data);
export const deleteBatch = (id: string) =>
  api.delete(`${BASE}/batches/${id}`).then(r => r.data);

// ─── Sections ──────────────────────────────────────────
export const listSections = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/sections`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getSection = (id: string) =>
  api.get(`${BASE}/sections/${id}`).then(r => r.data);
export const createSection = (data: any) =>
  api.post(`${BASE}/sections`, data).then(r => r.data);
export const updateSection = (id: string, data: any) =>
  api.put(`${BASE}/sections/${id}`, data).then(r => r.data);
export const deleteSection = (id: string) =>
  api.delete(`${BASE}/sections/${id}`).then(r => r.data);

// ─── Academic Years ────────────────────────────────────
export const listAcademicYears = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/academic-years`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAcademicYear = (id: string) =>
  api.get(`${BASE}/academic-years/${id}`).then(r => r.data);
export const createAcademicYear = (data: any) =>
  api.post(`${BASE}/academic-years`, data).then(r => r.data);
export const updateAcademicYear = (id: string, data: any) =>
  api.put(`${BASE}/academic-years/${id}`, data).then(r => r.data);
export const deleteAcademicYear = (id: string) =>
  api.delete(`${BASE}/academic-years/${id}`).then(r => r.data);

// ─── Semesters ─────────────────────────────────────────
export const listSemesters = (page = 1, limit = 20, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/semesters`, { params: { page, limit, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getSemester = (id: string) =>
  api.get(`${BASE}/semesters/${id}`).then(r => r.data);
export const createSemester = (data: any) =>
  api.post(`${BASE}/semesters`, data).then(r => r.data);
export const updateSemester = (id: string, data: any) =>
  api.put(`${BASE}/semesters/${id}`, data).then(r => r.data);
export const deleteSemester = (id: string) =>
  api.delete(`${BASE}/semesters/${id}`).then(r => r.data);

// ─── Courses ───────────────────────────────────────────
export const listCourses = (page = 1, limit = 20, regulationId?: string, search?: string) =>
  api.get(`${BASE}/courses`, { params: { page, limit, regulationId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCourse = (id: string) =>
  api.get(`${BASE}/courses/${id}`).then(r => r.data);
export const createCourse = (data: any) =>
  api.post(`${BASE}/courses`, data).then(r => r.data);
export const updateCourse = (id: string, data: any) =>
  api.put(`${BASE}/courses/${id}`, data).then(r => r.data);
export const deleteCourse = (id: string) =>
  api.delete(`${BASE}/courses/${id}`).then(r => r.data);

// ─── Curriculum Maps ───────────────────────────────────
export const listCurriculumMaps = (page = 1, limit = 20, branchId?: string, semester?: number, search?: string) =>
  api.get(`${BASE}/curriculum`, { params: { page, limit, branchId, semester, ...(search ? { search } : {}) } }).then(r => r.data);
export const createCurriculumMap = (data: any) =>
  api.post(`${BASE}/curriculum`, data).then(r => r.data);
export const updateCurriculumMap = (id: string, data: any) =>
  api.put(`${BASE}/curriculum/${id}`, data).then(r => r.data);
export const deleteCurriculumMap = (id: string) =>
  api.delete(`${BASE}/curriculum/${id}`).then(r => r.data);

// ─── Course Offerings ──────────────────────────────────
export const listCourseOfferings = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/offerings`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCourseOffering = (id: string) =>
  api.get(`${BASE}/offerings/${id}`).then(r => r.data);
export const createCourseOffering = (data: any) =>
  api.post(`${BASE}/offerings`, data).then(r => r.data);
export const updateCourseOffering = (id: string, data: any) =>
  api.put(`${BASE}/offerings/${id}`, data).then(r => r.data);
export const deleteCourseOffering = (id: string) =>
  api.delete(`${BASE}/offerings/${id}`).then(r => r.data);

// ─── Enrollments ───────────────────────────────────────
export const listAcadEnrollments = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/enrollments`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAcadEnrollment = (data: any) =>
  api.post(`${BASE}/enrollments`, data).then(r => r.data);
export const updateAcadEnrollment = (id: string, data: any) =>
  api.put(`${BASE}/enrollments/${id}`, data).then(r => r.data);
export const deleteAcadEnrollment = (id: string) =>
  api.delete(`${BASE}/enrollments/${id}`).then(r => r.data);

// ═══ Phase 3: Scheduling ═══════════════════════════════════

// ─── Academic Calendar ─────────────────────────────────
export const listAcademicCalendars = (page = 1, limit = 20, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/academic-calendar`, { params: { page, limit, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createAcademicCalendar = (data: any) =>
  api.post(`${BASE}/academic-calendar`, data).then(r => r.data);
export const updateAcademicCalendar = (id: string, data: any) =>
  api.put(`${BASE}/academic-calendar/${id}`, data).then(r => r.data);
export const deleteAcademicCalendar = (id: string) =>
  api.delete(`${BASE}/academic-calendar/${id}`).then(r => r.data);

// ─── Timetables ────────────────────────────────────────
export const listTimetables = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/timetables`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getTimetable = (id: string) =>
  api.get(`${BASE}/timetables/${id}`).then(r => r.data);
export const createTimetable = (data: any) =>
  api.post(`${BASE}/timetables`, data).then(r => r.data);
export const updateTimetable = (id: string, data: any) =>
  api.put(`${BASE}/timetables/${id}`, data).then(r => r.data);
export const deleteTimetable = (id: string) =>
  api.delete(`${BASE}/timetables/${id}`).then(r => r.data);

// ─── Timetable Slots ──────────────────────────────────
export const listTimetableSlots = (timetableId: string) =>
  api.get(`${BASE}/timetable-slots`, { params: { timetableId } }).then(r => r.data);
export const createTimetableSlot = (data: any) =>
  api.post(`${BASE}/timetable-slots`, data).then(r => r.data);
export const updateTimetableSlot = (id: string, data: any) =>
  api.put(`${BASE}/timetable-slots/${id}`, data).then(r => r.data);
export const deleteTimetableSlot = (id: string) =>
  api.delete(`${BASE}/timetable-slots/${id}`).then(r => r.data);

// ═══ Phase 4: Attendance ═══════════════════════════════════

// ─── Attendance Sessions ──────────────────────────────
export const listAttendanceSessions = (page = 1, limit = 20, courseOfferingId?: string, search?: string) =>
  api.get(`${BASE}/attendance-sessions`, { params: { page, limit, courseOfferingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAttendanceSession = (id: string) =>
  api.get(`${BASE}/attendance-sessions/${id}`).then(r => r.data);
export const createAttendanceSession = (data: any) =>
  api.post(`${BASE}/attendance-sessions`, data).then(r => r.data);
export const updateAttendanceSession = (id: string, data: any) =>
  api.put(`${BASE}/attendance-sessions/${id}`, data).then(r => r.data);
export const deleteAttendanceSession = (id: string) =>
  api.delete(`${BASE}/attendance-sessions/${id}`).then(r => r.data);

// ─── Attendance Records ───────────────────────────────
export const listAttendanceRecords = (sessionId: string) =>
  api.get(`${BASE}/attendance-records`, { params: { sessionId } }).then(r => r.data);
export const createAttendanceRecord = (data: any) =>
  api.post(`${BASE}/attendance-records`, data).then(r => r.data);
export const bulkCreateAttendanceRecords = (data: any) =>
  api.post(`${BASE}/attendance-records/bulk`, data).then(r => r.data);
export const updateAttendanceRecord = (id: string, data: any) =>
  api.put(`${BASE}/attendance-records/${id}`, data).then(r => r.data);
export const deleteAttendanceRecord = (id: string) =>
  api.delete(`${BASE}/attendance-records/${id}`).then(r => r.data);

// ═══ Phase 5: Internal Assessments ═════════════════════════

// ─── Internal Assessments ─────────────────────────────
export const listInternalAssessments = (page = 1, limit = 20, courseOfferingId?: string, search?: string) =>
  api.get(`${BASE}/internal-assessments`, { params: { page, limit, courseOfferingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getInternalAssessment = (id: string) =>
  api.get(`${BASE}/internal-assessments/${id}`).then(r => r.data);
export const createInternalAssessment = (data: any) =>
  api.post(`${BASE}/internal-assessments`, data).then(r => r.data);
export const updateInternalAssessment = (id: string, data: any) =>
  api.put(`${BASE}/internal-assessments/${id}`, data).then(r => r.data);
export const deleteInternalAssessment = (id: string) =>
  api.delete(`${BASE}/internal-assessments/${id}`).then(r => r.data);

// ─── Internal Marks ───────────────────────────────────
export const listInternalMarks = (assessmentId: string) =>
  api.get(`${BASE}/internal-marks`, { params: { assessmentId } }).then(r => r.data);
export const createInternalMark = (data: any) =>
  api.post(`${BASE}/internal-marks`, data).then(r => r.data);
export const bulkCreateInternalMarks = (data: any) =>
  api.post(`${BASE}/internal-marks/bulk`, data).then(r => r.data);
export const updateInternalMark = (id: string, data: any) =>
  api.put(`${BASE}/internal-marks/${id}`, data).then(r => r.data);
export const deleteInternalMark = (id: string) =>
  api.delete(`${BASE}/internal-marks/${id}`).then(r => r.data);

// ═══ Phase 6: Exams ════════════════════════════════════════

// ─── Exam Registrations ───────────────────────────────
export const listExamRegistrations = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/exam-registrations`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createExamRegistration = (data: any) =>
  api.post(`${BASE}/exam-registrations`, data).then(r => r.data);
export const updateExamRegistration = (id: string, data: any) =>
  api.put(`${BASE}/exam-registrations/${id}`, data).then(r => r.data);
export const deleteExamRegistration = (id: string) =>
  api.delete(`${BASE}/exam-registrations/${id}`).then(r => r.data);

// ─── Exam Schedules ───────────────────────────────────
export const listExamSchedules = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/exam-schedules`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createExamSchedule = (data: any) =>
  api.post(`${BASE}/exam-schedules`, data).then(r => r.data);
export const updateExamSchedule = (id: string, data: any) =>
  api.put(`${BASE}/exam-schedules/${id}`, data).then(r => r.data);
export const deleteExamSchedule = (id: string) =>
  api.delete(`${BASE}/exam-schedules/${id}`).then(r => r.data);

// ─── External Marks ───────────────────────────────────
export const listExternalMarks = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/external-marks`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createExternalMark = (data: any) =>
  api.post(`${BASE}/external-marks`, data).then(r => r.data);
export const updateExternalMark = (id: string, data: any) =>
  api.put(`${BASE}/external-marks/${id}`, data).then(r => r.data);
export const deleteExternalMark = (id: string) =>
  api.delete(`${BASE}/external-marks/${id}`).then(r => r.data);

// ═══ Phase 7: Results ══════════════════════════════════════

// ─── Grade Cards ──────────────────────────────────────
export const listGradeCards = (page = 1, limit = 20, semesterId?: string, studentId?: string, search?: string) =>
  api.get(`${BASE}/grade-cards`, { params: { page, limit, semesterId, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createGradeCard = (data: any) =>
  api.post(`${BASE}/grade-cards`, data).then(r => r.data);
export const updateGradeCard = (id: string, data: any) =>
  api.put(`${BASE}/grade-cards/${id}`, data).then(r => r.data);
export const deleteGradeCard = (id: string) =>
  api.delete(`${BASE}/grade-cards/${id}`).then(r => r.data);

// ─── Semester Results ─────────────────────────────────
export const listSemesterResults = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/semester-results`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createSemesterResult = (data: any) =>
  api.post(`${BASE}/semester-results`, data).then(r => r.data);
export const updateSemesterResult = (id: string, data: any) =>
  api.put(`${BASE}/semester-results/${id}`, data).then(r => r.data);
export const deleteSemesterResult = (id: string) =>
  api.delete(`${BASE}/semester-results/${id}`).then(r => r.data);

// ═══ Phase 8: OBE & Miscellaneous ══════════════════════════

// ─── Course Outcomes ──────────────────────────────────
export const listCourseOutcomes = (courseId: string) =>
  api.get(`${BASE}/course-outcomes`, { params: { courseId } }).then(r => r.data);
export const createCourseOutcome = (data: any) =>
  api.post(`${BASE}/course-outcomes`, data).then(r => r.data);
export const updateCourseOutcome = (id: string, data: any) =>
  api.put(`${BASE}/course-outcomes/${id}`, data).then(r => r.data);
export const deleteCourseOutcome = (id: string) =>
  api.delete(`${BASE}/course-outcomes/${id}`).then(r => r.data);

// ─── Program Outcomes ─────────────────────────────────
export const listProgramOutcomes = (programmeId: string) =>
  api.get(`${BASE}/program-outcomes`, { params: { programmeId } }).then(r => r.data);
export const createProgramOutcome = (data: any) =>
  api.post(`${BASE}/program-outcomes`, data).then(r => r.data);
export const updateProgramOutcome = (id: string, data: any) =>
  api.put(`${BASE}/program-outcomes/${id}`, data).then(r => r.data);
export const deleteProgramOutcome = (id: string) =>
  api.delete(`${BASE}/program-outcomes/${id}`).then(r => r.data);

// ─── Elective Allocations ─────────────────────────────
export const listElectiveAllocations = (page = 1, limit = 20, semesterId?: string, search?: string) =>
  api.get(`${BASE}/elective-allocations`, { params: { page, limit, semesterId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createElectiveAllocation = (data: any) =>
  api.post(`${BASE}/elective-allocations`, data).then(r => r.data);
export const updateElectiveAllocation = (id: string, data: any) =>
  api.put(`${BASE}/elective-allocations/${id}`, data).then(r => r.data);
export const deleteElectiveAllocation = (id: string) =>
  api.delete(`${BASE}/elective-allocations/${id}`).then(r => r.data);

// ─── Lesson Plans ─────────────────────────────────────
export const listLessonPlans = (page = 1, limit = 20, courseOfferingId?: string, search?: string) =>
  api.get(`${BASE}/lesson-plans`, { params: { page, limit, courseOfferingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createLessonPlan = (data: any) =>
  api.post(`${BASE}/lesson-plans`, data).then(r => r.data);
export const updateLessonPlan = (id: string, data: any) =>
  api.put(`${BASE}/lesson-plans/${id}`, data).then(r => r.data);
export const deleteLessonPlan = (id: string) =>
  api.delete(`${BASE}/lesson-plans/${id}`).then(r => r.data);

// ─── Course Feedback ──────────────────────────────────
export const listCourseFeedbacks = (page = 1, limit = 20, courseOfferingId?: string, search?: string) =>
  api.get(`${BASE}/course-feedback`, { params: { page, limit, courseOfferingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createCourseFeedback = (data: any) =>
  api.post(`${BASE}/course-feedback`, data).then(r => r.data);
export const updateCourseFeedback = (id: string, data: any) =>
  api.put(`${BASE}/course-feedback/${id}`, data).then(r => r.data);
export const deleteCourseFeedback = (id: string) =>
  api.delete(`${BASE}/course-feedback/${id}`).then(r => r.data);

// ─── Promotions (Task 15 — Fee Configuration) ─────────
/**
 * `POST /academics/results/promote` triggers promotion for all `computed`/
 * `published` semester results in a programme+semester combination. The
 * response mirrors the T9-extended `promoteStudents` service return value:
 *   { promoted, detained, yearBack, deferredPins: [{ studentId, reason, targetYear }] }
 * Deferred pins are consumed by `PromotionResultsPanel` to list students
 * whose Year-N+1 FeeStructureInstance isn't published yet.
 */
export interface DeferredPin {
  studentId: string;
  reason: string;
  targetYear: number;
}

export interface PromotionSummary {
  promoted: number;
  detained: number;
  yearBack: number;
  deferredPins: DeferredPin[];
}

export const promoteStudents = (data: { semesterId: string; programmeId: string }): Promise<PromotionSummary> =>
  api.post(`${BASE}/results/promote`, data).then(r => r.data);
