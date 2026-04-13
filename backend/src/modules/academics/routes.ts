import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
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
  instantiateCurriculumSchema,
  formSectionsSchema,
  createLabBatchesSchema,
  assignFacultySchema,
  applySubstitutionSchema,
  optimizeElectiveAllocationsSchema,
  finalizeElectiveAllocationsSchema,
  refreshAttendanceSummarySchema,
  submitCondonationRequestSchema,
  reviewCondonationRequestSchema,
  computeCIESchema,
  createAssignmentSchema, updateAssignmentSchema,
  createSubmissionSchema, gradeSubmissionSchema,
  createQuizSchema, updateQuizSchema,
  submitQuizAttemptSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('academics', 'read'), ctrl.dashboardStats);

// Regulations
router.get('/regulations', authorize('academics', 'read'), ctrl.listRegulations);
router.get('/regulations/:id', authorize('academics', 'read'), ctrl.getRegulation);
router.post('/regulations', authorize('academics', 'create'), validate(createRegulationSchema), ctrl.createRegulation);
router.put('/regulations/:id', authorize('academics', 'update'), validate(updateRegulationSchema), ctrl.updateRegulation);
router.delete('/regulations/:id', authorize('academics', 'delete'), ctrl.deleteRegulation);

// Programmes
router.get('/programmes', authorize('academics', 'read'), ctrl.listProgrammes);
router.get('/programmes/:id', authorize('academics', 'read'), ctrl.getProgramme);
router.post('/programmes', authorize('academics', 'create'), validate(createProgrammeSchema), ctrl.createProgramme);
router.put('/programmes/:id', authorize('academics', 'update'), validate(updateProgrammeSchema), ctrl.updateProgramme);
router.delete('/programmes/:id', authorize('academics', 'delete'), ctrl.deleteProgramme);

// Departments
router.get('/departments', authorize('academics', 'read'), ctrl.listDepartments);
router.get('/departments/:id', authorize('academics', 'read'), ctrl.getDepartment);
router.post('/departments', authorize('academics', 'create'), validate(createDepartmentSchema), ctrl.createDepartment);
router.put('/departments/:id', authorize('academics', 'update'), validate(updateDepartmentSchema), ctrl.updateDepartment);
router.delete('/departments/:id', authorize('academics', 'delete'), ctrl.deleteDepartment);

// Branches
router.get('/branches', authorize('academics', 'read'), ctrl.listBranches);
router.get('/branches/:id', authorize('academics', 'read'), ctrl.getBranch);
router.post('/branches', authorize('academics', 'create'), validate(createBranchSchema), ctrl.createBranch);
router.put('/branches/:id', authorize('academics', 'update'), validate(updateBranchSchema), ctrl.updateBranch);
router.delete('/branches/:id', authorize('academics', 'delete'), ctrl.deleteBranch);

// Batches
router.get('/batches', authorize('academics', 'read'), ctrl.listBatches);
router.get('/batches/:id', authorize('academics', 'read'), ctrl.getBatch);
router.post('/batches', authorize('academics', 'create'), validate(createBatchSchema), ctrl.createBatch);
router.put('/batches/:id', authorize('academics', 'update'), validate(updateBatchSchema), ctrl.updateBatch);
router.delete('/batches/:id', authorize('academics', 'delete'), ctrl.deleteBatch);

// Sections
router.get('/sections', authorize('academics', 'read'), ctrl.listSections);
router.get('/sections/:id', authorize('academics', 'read'), ctrl.getSection);
router.post('/sections', authorize('academics', 'create'), validate(createSectionSchema), ctrl.createSection);
router.put('/sections/:id', authorize('academics', 'update'), validate(updateSectionSchema), ctrl.updateSection);
router.delete('/sections/:id', authorize('academics', 'delete'), ctrl.deleteSection);

// Academic Years
router.get('/academic-years', authorize('academics', 'read'), ctrl.listAcademicYears);
router.get('/academic-years/:id', authorize('academics', 'read'), ctrl.getAcademicYear);
router.post('/academic-years', authorize('academics', 'create'), validate(createAcademicYearSchema), ctrl.createAcademicYear);
router.put('/academic-years/:id', authorize('academics', 'update'), validate(updateAcademicYearSchema), ctrl.updateAcademicYear);
router.delete('/academic-years/:id', authorize('academics', 'delete'), ctrl.deleteAcademicYear);

// Semesters
router.get('/semesters', authorize('academics', 'read'), ctrl.listSemesters);
router.get('/semesters/:id', authorize('academics', 'read'), ctrl.getSemester);
router.post('/semesters', authorize('academics', 'create'), validate(createSemesterSchema), ctrl.createSemester);
router.put('/semesters/:id', authorize('academics', 'update'), validate(updateSemesterSchema), ctrl.updateSemester);
router.delete('/semesters/:id', authorize('academics', 'delete'), ctrl.deleteSemester);

// Courses
router.get('/courses', authorize('academics', 'read'), ctrl.listCourses);
router.get('/courses/:id', authorize('academics', 'read'), ctrl.getCourse);
router.post('/courses', authorize('academics', 'create'), validate(createCourseSchema), ctrl.createCourse);
router.put('/courses/:id', authorize('academics', 'update'), validate(updateCourseSchema), ctrl.updateCourse);
router.delete('/courses/:id', authorize('academics', 'delete'), ctrl.deleteCourse);

// Curriculum Maps
router.get('/curriculum', authorize('academics', 'read'), ctrl.listCurriculumMaps);
router.post('/curriculum', authorize('academics', 'create'), validate(createCurriculumMapSchema), ctrl.createCurriculumMap);
router.put('/curriculum/:id', authorize('academics', 'update'), validate(updateCurriculumMapSchema), ctrl.updateCurriculumMap);
router.delete('/curriculum/:id', authorize('academics', 'delete'), ctrl.deleteCurriculumMap);

// Course Offerings
router.get('/offerings', authorize('academics', 'read'), ctrl.listCourseOfferings);
router.get('/offerings/delivery-overview', authorize('academics', 'read'), ctrl.getCourseDeliveryOverview);
router.get('/offerings/:id', authorize('academics', 'read'), ctrl.getCourseOffering);
router.post('/offerings', authorize('academics', 'create'), validate(createCourseOfferingSchema), ctrl.createCourseOffering);
router.put('/offerings/:id', authorize('academics', 'update'), validate(updateCourseOfferingSchema), ctrl.updateCourseOffering);
router.delete('/offerings/:id', authorize('academics', 'delete'), ctrl.deleteCourseOffering);

// Enrollments
router.get('/enrollments', authorize('academics', 'read'), ctrl.listEnrollments);
router.post('/enrollments', authorize('academics', 'create'), validate(createEnrollmentSchema), ctrl.createEnrollment);
router.put('/enrollments/:id', authorize('academics', 'update'), validate(updateEnrollmentSchema), ctrl.updateEnrollment);
router.delete('/enrollments/:id', authorize('academics', 'delete'), ctrl.deleteEnrollment);

// ═══ Phase 3: Scheduling ═══════════════════════════════════

// Academic Calendar
router.get('/academic-calendar', authorize('academics', 'read'), ctrl.listCalendarEvents);
router.post('/academic-calendar', authorize('academics', 'create'), validate(createAcademicCalendarSchema), ctrl.createCalendarEvent);
router.put('/academic-calendar/:id', authorize('academics', 'update'), validate(updateAcademicCalendarSchema), ctrl.updateCalendarEvent);
router.delete('/academic-calendar/:id', authorize('academics', 'delete'), ctrl.deleteCalendarEvent);

// Timetables
router.get('/timetables', authorize('academics', 'read'), ctrl.listTimetables);
router.get('/timetables/:id', authorize('academics', 'read'), ctrl.getTimetable);
router.post('/timetables', authorize('academics', 'create'), validate(createTimetableSchema), ctrl.createTimetable);
router.put('/timetables/:id', authorize('academics', 'update'), validate(updateTimetableSchema), ctrl.updateTimetable);
router.delete('/timetables/:id', authorize('academics', 'delete'), ctrl.deleteTimetable);

// Timetable Slots
router.get('/timetable-slots', authorize('academics', 'read'), ctrl.listTimetableSlots);
router.post('/timetable-slots', authorize('academics', 'create'), validate(createTimetableSlotSchema), ctrl.createTimetableSlot);
router.put('/timetable-slots/:id', authorize('academics', 'update'), validate(updateTimetableSlotSchema), ctrl.updateTimetableSlot);
router.delete('/timetable-slots/:id', authorize('academics', 'delete'), ctrl.deleteTimetableSlot);

// ═══ Phase 4: Attendance ═══════════════════════════════════

// Attendance Sessions
router.get('/attendance-sessions', authorize('academics', 'read'), ctrl.listAttendanceSessions);
router.get('/attendance-sessions/:id', authorize('academics', 'read'), ctrl.getAttendanceSession);
router.post('/attendance-sessions', authorize('academics', 'create'), validate(createAttendanceSessionSchema), ctrl.createAttendanceSession);
router.put('/attendance-sessions/:id', authorize('academics', 'update'), validate(updateAttendanceSessionSchema), ctrl.updateAttendanceSession);
router.delete('/attendance-sessions/:id', authorize('academics', 'delete'), ctrl.deleteAttendanceSession);

// Attendance Records
router.get('/attendance-records', authorize('academics', 'read'), ctrl.listAttendanceRecords);
router.post('/attendance-records', authorize('academics', 'create'), validate(createAttendanceRecordSchema), ctrl.createAttendanceRecord);
router.post('/attendance-records/bulk', authorize('academics', 'create'), ctrl.bulkCreateAttendanceRecords);
router.put('/attendance-records/:id', authorize('academics', 'update'), validate(updateAttendanceRecordSchema), ctrl.updateAttendanceRecord);
router.delete('/attendance-records/:id', authorize('academics', 'delete'), ctrl.deleteAttendanceRecord);

// ═══ Phase 5: Internal Assessments ═════════════════════════

// Internal Assessments
router.get('/internal-assessments', authorize('academics', 'read'), ctrl.listInternalAssessments);
router.get('/internal-assessments/:id', authorize('academics', 'read'), ctrl.getInternalAssessment);
router.post('/internal-assessments', authorize('academics', 'create'), validate(createInternalAssessmentSchema), ctrl.createInternalAssessment);
router.put('/internal-assessments/:id', authorize('academics', 'update'), validate(updateInternalAssessmentSchema), ctrl.updateInternalAssessment);
router.delete('/internal-assessments/:id', authorize('academics', 'delete'), ctrl.deleteInternalAssessment);

// Internal Marks
router.get('/internal-marks', authorize('academics', 'read'), ctrl.listInternalMarks);
router.post('/internal-marks', authorize('academics', 'create'), validate(createInternalMarkSchema), ctrl.createInternalMark);
router.post('/internal-marks/bulk', authorize('academics', 'create'), ctrl.bulkCreateInternalMarks);
router.put('/internal-marks/:id', authorize('academics', 'update'), validate(updateInternalMarkSchema), ctrl.updateInternalMark);
router.delete('/internal-marks/:id', authorize('academics', 'delete'), ctrl.deleteInternalMark);

// ═══ Phase 6: Exams ════════════════════════════════════════

// Exam Registrations
router.get('/exam-registrations', authorize('academics', 'read'), ctrl.listExamRegistrations);
router.post('/exam-registrations', authorize('academics', 'create'), validate(createExamRegistrationSchema), ctrl.createExamRegistration);
router.put('/exam-registrations/:id', authorize('academics', 'update'), validate(updateExamRegistrationSchema), ctrl.updateExamRegistration);
router.delete('/exam-registrations/:id', authorize('academics', 'delete'), ctrl.deleteExamRegistration);

// Exam Schedules
router.get('/exam-schedules', authorize('academics', 'read'), ctrl.listExamSchedules);
router.post('/exam-schedules', authorize('academics', 'create'), validate(createExamScheduleSchema), ctrl.createExamSchedule);
router.put('/exam-schedules/:id', authorize('academics', 'update'), validate(updateExamScheduleSchema), ctrl.updateExamSchedule);
router.delete('/exam-schedules/:id', authorize('academics', 'delete'), ctrl.deleteExamSchedule);

// External Marks
router.get('/external-marks', authorize('academics', 'read'), ctrl.listExternalMarks);
router.post('/external-marks', authorize('academics', 'create'), validate(createExternalMarkSchema), ctrl.createExternalMark);
router.put('/external-marks/:id', authorize('academics', 'update'), validate(updateExternalMarkSchema), ctrl.updateExternalMark);
router.delete('/external-marks/:id', authorize('academics', 'delete'), ctrl.deleteExternalMark);

// ═══ Phase 7: Results ══════════════════════════════════════

// Grade Cards
router.get('/grade-cards', authorize('academics', 'read'), ctrl.listGradeCards);
router.post('/grade-cards', authorize('academics', 'create'), validate(createGradeCardSchema), ctrl.createGradeCard);
router.put('/grade-cards/:id', authorize('academics', 'update'), validate(updateGradeCardSchema), ctrl.updateGradeCard);
router.delete('/grade-cards/:id', authorize('academics', 'delete'), ctrl.deleteGradeCard);

// Semester Results
router.get('/semester-results', authorize('academics', 'read'), ctrl.listSemesterResults);
router.post('/semester-results', authorize('academics', 'create'), validate(createSemesterResultSchema), ctrl.createSemesterResult);
router.put('/semester-results/:id', authorize('academics', 'update'), validate(updateSemesterResultSchema), ctrl.updateSemesterResult);
router.delete('/semester-results/:id', authorize('academics', 'delete'), ctrl.deleteSemesterResult);

// ═══ Phase 8: OBE & Miscellaneous ══════════════════════════

// Course Outcomes
router.get('/course-outcomes', authorize('academics', 'read'), ctrl.listCourseOutcomes);
router.post('/course-outcomes', authorize('academics', 'create'), validate(createCourseOutcomeSchema), ctrl.createCourseOutcome);
router.put('/course-outcomes/:id', authorize('academics', 'update'), validate(updateCourseOutcomeSchema), ctrl.updateCourseOutcome);
router.delete('/course-outcomes/:id', authorize('academics', 'delete'), ctrl.deleteCourseOutcome);

// Program Outcomes
router.get('/program-outcomes', authorize('academics', 'read'), ctrl.listProgramOutcomes);
router.post('/program-outcomes', authorize('academics', 'create'), validate(createProgramOutcomeSchema), ctrl.createProgramOutcome);
router.put('/program-outcomes/:id', authorize('academics', 'update'), validate(updateProgramOutcomeSchema), ctrl.updateProgramOutcome);
router.delete('/program-outcomes/:id', authorize('academics', 'delete'), ctrl.deleteProgramOutcome);

// Elective Allocations
router.get('/elective-allocations', authorize('academics', 'read'), ctrl.listElectiveAllocations);
router.post('/elective-allocations', authorize('academics', 'create'), validate(createElectiveAllocationSchema), ctrl.createElectiveAllocation);
router.put('/elective-allocations/:id', authorize('academics', 'update'), validate(updateElectiveAllocationSchema), ctrl.updateElectiveAllocation);
router.delete('/elective-allocations/:id', authorize('academics', 'delete'), ctrl.deleteElectiveAllocation);

// Lesson Plans
router.get('/lesson-plans', authorize('academics', 'read'), ctrl.listLessonPlans);
router.post('/lesson-plans', authorize('academics', 'create'), validate(createLessonPlanSchema), ctrl.createLessonPlan);
router.put('/lesson-plans/:id', authorize('academics', 'update'), validate(updateLessonPlanSchema), ctrl.updateLessonPlan);
router.delete('/lesson-plans/:id', authorize('academics', 'delete'), ctrl.deleteLessonPlan);

// Course Feedback
router.get('/course-feedback', authorize('academics', 'read'), ctrl.listCourseFeedback);
router.post('/course-feedback', authorize('academics', 'create'), validate(createCourseFeedbackSchema), ctrl.createCourseFeedback);
router.delete('/course-feedback/:id', authorize('academics', 'delete'), ctrl.deleteCourseFeedback);

// ═══ W02: Curriculum Instantiation & Calendar Publish ═════════
router.post('/curriculum/instantiate', authorize('academics', 'create'), validate(instantiateCurriculumSchema), ctrl.instantiateSemesterCurriculum);
router.post('/academic-calendar/:id/publish', authorize('academics', 'update'), ctrl.publishAcademicCalendar);

// ═══ W02: Section Formation & Lab Batch Creation ═════════════
router.post('/sections/form', authorize('academics', 'create'), validate(formSectionsSchema), ctrl.formSections);
router.post('/sections/:id/lab-batches', authorize('academics', 'create'), validate(createLabBatchesSchema), ctrl.createLabBatches);

// ═══ W02: Faculty Assignment & Timetable Conflict Detection ═════
router.post('/offerings/:id/assign-faculty', authorize('academics', 'update'), validate(assignFacultySchema), ctrl.assignFacultyToOffering);
router.get('/timetables/:id/conflicts', authorize('academics', 'read'), ctrl.detectTimetableConflicts);

// ═══ W02: Timetable Substitution & Elective Allocation ═════════
router.put('/timetable-slots/:id/substitute', authorize('academics', 'update'), validate(applySubstitutionSchema), ctrl.applySubstitution);
router.post('/elective-allocations/optimize', authorize('academics', 'create'), validate(optimizeElectiveAllocationsSchema), ctrl.optimizeElectiveAllocations);
router.post('/elective-allocations/finalize', authorize('academics', 'create'), validate(finalizeElectiveAllocationsSchema), ctrl.finalizeElectiveAllocations);

// ═══ W02: Attendance Summary & Alerts ═════════════════════════

// Attendance Summaries
router.get('/attendance-summary', authorize('academics', 'read'), ctrl.listAttendanceSummaries);
router.post('/attendance-summary/refresh', authorize('academics', 'create'), validate(refreshAttendanceSummarySchema), ctrl.refreshAttendanceSummary);

// Attendance Alerts
router.get('/attendance-alerts', authorize('academics', 'read'), ctrl.listAttendanceAlerts);

// ═══ W02: Condonation Request Workflow ═══════════════════════

// Condonation Requests
router.post('/condonation-requests', authorize('academics', 'create'), validate(submitCondonationRequestSchema), ctrl.submitCondonationRequest);
router.get('/condonation-requests', authorize('academics', 'read'), ctrl.listCondonationRequests);
router.get('/condonation-requests/:id', authorize('academics', 'read'), ctrl.getCondonationRequest);
router.put('/condonation-requests/:id/review', authorize('academics', 'update'), validate(reviewCondonationRequestSchema), ctrl.reviewCondonationRequest);

// ═══ W02: CIE Computation Engine ═══════════════════════════
router.post('/internal-assessments/compute-cie', authorize('academics', 'create'), validate(computeCIESchema), ctrl.computeCIEForOffering);

// ═══ W02: Assignments ═══════════════════════════════════════
router.get('/assignments', authorize('academics', 'read'), ctrl.listAssignments);
router.get('/assignments/:id', authorize('academics', 'read'), ctrl.getAssignment);
router.post('/assignments', authorize('academics', 'create'), validate(createAssignmentSchema), ctrl.createAssignment);
router.put('/assignments/:id', authorize('academics', 'update'), validate(updateAssignmentSchema), ctrl.updateAssignment);
router.delete('/assignments/:id', authorize('academics', 'delete'), ctrl.deleteAssignment);

// ═══ W02: Submissions ═══════════════════════════════════════
router.get('/submissions', authorize('academics', 'read'), ctrl.listSubmissions);
router.get('/submissions/:id', authorize('academics', 'read'), ctrl.getSubmission);
router.post('/submissions', authorize('academics', 'create'), validate(createSubmissionSchema), ctrl.createSubmission);
router.put('/submissions/:id/grade', authorize('academics', 'update'), validate(gradeSubmissionSchema), ctrl.gradeSubmission);
router.delete('/submissions/:id', authorize('academics', 'delete'), ctrl.deleteSubmission);

// ═══ W02: Quizzes ═══════════════════════════════════════════
router.get('/quizzes', authorize('academics', 'read'), ctrl.listQuizzes);
router.get('/quizzes/:id', authorize('academics', 'read'), ctrl.getQuiz);
router.post('/quizzes', authorize('academics', 'create'), validate(createQuizSchema), ctrl.createQuiz);
router.put('/quizzes/:id', authorize('academics', 'update'), validate(updateQuizSchema), ctrl.updateQuiz);
router.delete('/quizzes/:id', authorize('academics', 'delete'), ctrl.deleteQuiz);

// ═══ W02: Quiz Attempts ═════════════════════════════════════
router.get('/quiz-attempts', authorize('academics', 'read'), ctrl.listQuizAttempts);
router.get('/quiz-attempts/:id', authorize('academics', 'read'), ctrl.getQuizAttempt);
router.post('/quiz-attempts', authorize('academics', 'create'), validate(submitQuizAttemptSchema), ctrl.submitQuizAttempt);
router.delete('/quiz-attempts/:id', authorize('academics', 'delete'), ctrl.deleteQuizAttempt);

// ═══ W02: Course Delivery Progress ══════════════════════════
router.post('/offerings/:id/update-progress', authorize('academics', 'update'), ctrl.updateCourseDeliveryProgress);

export default router;
