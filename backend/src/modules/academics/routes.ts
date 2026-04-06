import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createRegulationSchema, updateRegulationSchema,
  createProgrammeSchema, updateProgrammeSchema,
  createDepartmentSchema, updateDepartmentSchema,
  createBranchSchema, updateBranchSchema,
  createBatchSchema, updateBatchSchema,
  createSectionSchema, updateSectionSchema,
  createAcademicYearSchema, updateAcademicYearSchema,
  createSemesterSchema, updateSemesterSchema,
  createCourseSchema, updateCourseSchema,
  createCurriculumMapSchema, updateCurriculumMapSchema,
  createCourseOfferingSchema, updateCourseOfferingSchema,
  createEnrollmentSchema, updateEnrollmentSchema,
  createAcademicCalendarSchema, updateAcademicCalendarSchema,
  createTimetableSchema, updateTimetableSchema,
  createTimetableSlotSchema, updateTimetableSlotSchema,
  createAttendanceSessionSchema, updateAttendanceSessionSchema,
  createAttendanceRecordSchema, updateAttendanceRecordSchema,
  createInternalAssessmentSchema, updateInternalAssessmentSchema,
  createInternalMarkSchema, updateInternalMarkSchema,
  createExamRegistrationSchema, updateExamRegistrationSchema,
  createExamScheduleSchema, updateExamScheduleSchema,
  createExternalMarkSchema, updateExternalMarkSchema,
  createGradeCardSchema, updateGradeCardSchema,
  createSemesterResultSchema, updateSemesterResultSchema,
  createCourseOutcomeSchema, updateCourseOutcomeSchema,
  createProgramOutcomeSchema, updateProgramOutcomeSchema,
  createElectiveAllocationSchema, updateElectiveAllocationSchema,
  createLessonPlanSchema, updateLessonPlanSchema,
  createCourseFeedbackSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Regulations
router.get('/regulations', ctrl.listRegulations);
router.get('/regulations/:id', ctrl.getRegulation);
router.post('/regulations', validate(createRegulationSchema), ctrl.createRegulation);
router.put('/regulations/:id', validate(updateRegulationSchema), ctrl.updateRegulation);
router.delete('/regulations/:id', ctrl.deleteRegulation);

// Programmes
router.get('/programmes', ctrl.listProgrammes);
router.get('/programmes/:id', ctrl.getProgramme);
router.post('/programmes', validate(createProgrammeSchema), ctrl.createProgramme);
router.put('/programmes/:id', validate(updateProgrammeSchema), ctrl.updateProgramme);
router.delete('/programmes/:id', ctrl.deleteProgramme);

// Departments
router.get('/departments', ctrl.listDepartments);
router.get('/departments/:id', ctrl.getDepartment);
router.post('/departments', validate(createDepartmentSchema), ctrl.createDepartment);
router.put('/departments/:id', validate(updateDepartmentSchema), ctrl.updateDepartment);
router.delete('/departments/:id', ctrl.deleteDepartment);

// Branches
router.get('/branches', ctrl.listBranches);
router.get('/branches/:id', ctrl.getBranch);
router.post('/branches', validate(createBranchSchema), ctrl.createBranch);
router.put('/branches/:id', validate(updateBranchSchema), ctrl.updateBranch);
router.delete('/branches/:id', ctrl.deleteBranch);

// Batches
router.get('/batches', ctrl.listBatches);
router.get('/batches/:id', ctrl.getBatch);
router.post('/batches', validate(createBatchSchema), ctrl.createBatch);
router.put('/batches/:id', validate(updateBatchSchema), ctrl.updateBatch);
router.delete('/batches/:id', ctrl.deleteBatch);

// Sections
router.get('/sections', ctrl.listSections);
router.get('/sections/:id', ctrl.getSection);
router.post('/sections', validate(createSectionSchema), ctrl.createSection);
router.put('/sections/:id', validate(updateSectionSchema), ctrl.updateSection);
router.delete('/sections/:id', ctrl.deleteSection);

// Academic Years
router.get('/academic-years', ctrl.listAcademicYears);
router.get('/academic-years/:id', ctrl.getAcademicYear);
router.post('/academic-years', validate(createAcademicYearSchema), ctrl.createAcademicYear);
router.put('/academic-years/:id', validate(updateAcademicYearSchema), ctrl.updateAcademicYear);
router.delete('/academic-years/:id', ctrl.deleteAcademicYear);

// Semesters
router.get('/semesters', ctrl.listSemesters);
router.get('/semesters/:id', ctrl.getSemester);
router.post('/semesters', validate(createSemesterSchema), ctrl.createSemester);
router.put('/semesters/:id', validate(updateSemesterSchema), ctrl.updateSemester);
router.delete('/semesters/:id', ctrl.deleteSemester);

// Courses
router.get('/courses', ctrl.listCourses);
router.get('/courses/:id', ctrl.getCourse);
router.post('/courses', validate(createCourseSchema), ctrl.createCourse);
router.put('/courses/:id', validate(updateCourseSchema), ctrl.updateCourse);
router.delete('/courses/:id', ctrl.deleteCourse);

// Curriculum Maps
router.get('/curriculum', ctrl.listCurriculumMaps);
router.post('/curriculum', validate(createCurriculumMapSchema), ctrl.createCurriculumMap);
router.put('/curriculum/:id', validate(updateCurriculumMapSchema), ctrl.updateCurriculumMap);
router.delete('/curriculum/:id', ctrl.deleteCurriculumMap);

// Course Offerings
router.get('/offerings', ctrl.listCourseOfferings);
router.get('/offerings/:id', ctrl.getCourseOffering);
router.post('/offerings', validate(createCourseOfferingSchema), ctrl.createCourseOffering);
router.put('/offerings/:id', validate(updateCourseOfferingSchema), ctrl.updateCourseOffering);
router.delete('/offerings/:id', ctrl.deleteCourseOffering);

// Enrollments
router.get('/enrollments', ctrl.listEnrollments);
router.post('/enrollments', validate(createEnrollmentSchema), ctrl.createEnrollment);
router.put('/enrollments/:id', validate(updateEnrollmentSchema), ctrl.updateEnrollment);
router.delete('/enrollments/:id', ctrl.deleteEnrollment);

// ═══ Phase 3: Scheduling ═══════════════════════════════════

// Academic Calendar
router.get('/academic-calendar', ctrl.listCalendarEvents);
router.post('/academic-calendar', validate(createAcademicCalendarSchema), ctrl.createCalendarEvent);
router.put('/academic-calendar/:id', validate(updateAcademicCalendarSchema), ctrl.updateCalendarEvent);
router.delete('/academic-calendar/:id', ctrl.deleteCalendarEvent);

// Timetables
router.get('/timetables', ctrl.listTimetables);
router.get('/timetables/:id', ctrl.getTimetable);
router.post('/timetables', validate(createTimetableSchema), ctrl.createTimetable);
router.put('/timetables/:id', validate(updateTimetableSchema), ctrl.updateTimetable);
router.delete('/timetables/:id', ctrl.deleteTimetable);

// Timetable Slots
router.get('/timetable-slots', ctrl.listTimetableSlots);
router.post('/timetable-slots', validate(createTimetableSlotSchema), ctrl.createTimetableSlot);
router.put('/timetable-slots/:id', validate(updateTimetableSlotSchema), ctrl.updateTimetableSlot);
router.delete('/timetable-slots/:id', ctrl.deleteTimetableSlot);

// ═══ Phase 4: Attendance ═══════════════════════════════════

// Attendance Sessions
router.get('/attendance-sessions', ctrl.listAttendanceSessions);
router.get('/attendance-sessions/:id', ctrl.getAttendanceSession);
router.post('/attendance-sessions', validate(createAttendanceSessionSchema), ctrl.createAttendanceSession);
router.put('/attendance-sessions/:id', validate(updateAttendanceSessionSchema), ctrl.updateAttendanceSession);
router.delete('/attendance-sessions/:id', ctrl.deleteAttendanceSession);

// Attendance Records
router.get('/attendance-records', ctrl.listAttendanceRecords);
router.post('/attendance-records', validate(createAttendanceRecordSchema), ctrl.createAttendanceRecord);
router.post('/attendance-records/bulk', ctrl.bulkCreateAttendanceRecords);
router.put('/attendance-records/:id', validate(updateAttendanceRecordSchema), ctrl.updateAttendanceRecord);
router.delete('/attendance-records/:id', ctrl.deleteAttendanceRecord);

// ═══ Phase 5: Internal Assessments ═════════════════════════

// Internal Assessments
router.get('/internal-assessments', ctrl.listInternalAssessments);
router.get('/internal-assessments/:id', ctrl.getInternalAssessment);
router.post('/internal-assessments', validate(createInternalAssessmentSchema), ctrl.createInternalAssessment);
router.put('/internal-assessments/:id', validate(updateInternalAssessmentSchema), ctrl.updateInternalAssessment);
router.delete('/internal-assessments/:id', ctrl.deleteInternalAssessment);

// Internal Marks
router.get('/internal-marks', ctrl.listInternalMarks);
router.post('/internal-marks', validate(createInternalMarkSchema), ctrl.createInternalMark);
router.post('/internal-marks/bulk', ctrl.bulkCreateInternalMarks);
router.put('/internal-marks/:id', validate(updateInternalMarkSchema), ctrl.updateInternalMark);
router.delete('/internal-marks/:id', ctrl.deleteInternalMark);

// ═══ Phase 6: Exams ════════════════════════════════════════

// Exam Registrations
router.get('/exam-registrations', ctrl.listExamRegistrations);
router.post('/exam-registrations', validate(createExamRegistrationSchema), ctrl.createExamRegistration);
router.put('/exam-registrations/:id', validate(updateExamRegistrationSchema), ctrl.updateExamRegistration);
router.delete('/exam-registrations/:id', ctrl.deleteExamRegistration);

// Exam Schedules
router.get('/exam-schedules', ctrl.listExamSchedules);
router.post('/exam-schedules', validate(createExamScheduleSchema), ctrl.createExamSchedule);
router.put('/exam-schedules/:id', validate(updateExamScheduleSchema), ctrl.updateExamSchedule);
router.delete('/exam-schedules/:id', ctrl.deleteExamSchedule);

// External Marks
router.get('/external-marks', ctrl.listExternalMarks);
router.post('/external-marks', validate(createExternalMarkSchema), ctrl.createExternalMark);
router.put('/external-marks/:id', validate(updateExternalMarkSchema), ctrl.updateExternalMark);
router.delete('/external-marks/:id', ctrl.deleteExternalMark);

// ═══ Phase 7: Results ══════════════════════════════════════

// Grade Cards
router.get('/grade-cards', ctrl.listGradeCards);
router.post('/grade-cards', validate(createGradeCardSchema), ctrl.createGradeCard);
router.put('/grade-cards/:id', validate(updateGradeCardSchema), ctrl.updateGradeCard);
router.delete('/grade-cards/:id', ctrl.deleteGradeCard);

// Semester Results
router.get('/semester-results', ctrl.listSemesterResults);
router.post('/semester-results', validate(createSemesterResultSchema), ctrl.createSemesterResult);
router.put('/semester-results/:id', validate(updateSemesterResultSchema), ctrl.updateSemesterResult);
router.delete('/semester-results/:id', ctrl.deleteSemesterResult);

// ═══ Phase 8: OBE & Miscellaneous ══════════════════════════

// Course Outcomes
router.get('/course-outcomes', ctrl.listCourseOutcomes);
router.post('/course-outcomes', validate(createCourseOutcomeSchema), ctrl.createCourseOutcome);
router.put('/course-outcomes/:id', validate(updateCourseOutcomeSchema), ctrl.updateCourseOutcome);
router.delete('/course-outcomes/:id', ctrl.deleteCourseOutcome);

// Program Outcomes
router.get('/program-outcomes', ctrl.listProgramOutcomes);
router.post('/program-outcomes', validate(createProgramOutcomeSchema), ctrl.createProgramOutcome);
router.put('/program-outcomes/:id', validate(updateProgramOutcomeSchema), ctrl.updateProgramOutcome);
router.delete('/program-outcomes/:id', ctrl.deleteProgramOutcome);

// Elective Allocations
router.get('/elective-allocations', ctrl.listElectiveAllocations);
router.post('/elective-allocations', validate(createElectiveAllocationSchema), ctrl.createElectiveAllocation);
router.put('/elective-allocations/:id', validate(updateElectiveAllocationSchema), ctrl.updateElectiveAllocation);
router.delete('/elective-allocations/:id', ctrl.deleteElectiveAllocation);

// Lesson Plans
router.get('/lesson-plans', ctrl.listLessonPlans);
router.post('/lesson-plans', validate(createLessonPlanSchema), ctrl.createLessonPlan);
router.put('/lesson-plans/:id', validate(updateLessonPlanSchema), ctrl.updateLessonPlan);
router.delete('/lesson-plans/:id', ctrl.deleteLessonPlan);

// Course Feedback
router.get('/course-feedback', ctrl.listCourseFeedback);
router.post('/course-feedback', validate(createCourseFeedbackSchema), ctrl.createCourseFeedback);
router.delete('/course-feedback/:id', ctrl.deleteCourseFeedback);

export default router;
