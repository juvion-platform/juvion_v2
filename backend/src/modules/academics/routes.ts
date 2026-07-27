import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import * as examCfg from './exam-config-controller';
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
  checkBulkEligibilitySchema,
  generateExamFeeInvoiceSchema,
  createSeatingPlanSchema_w02,
  updateSeatingPlanSchema,
  createInvigilationRosterSchema,
  updateInvigilationRosterSchema,
  generateHallTicketsSchema,
  bulkEnterExternalMarksSchema,
  validateExternalMarksSchema,
  computeGradesSchema,
  computeSemesterResultsSchema,
  transitionResultStatusSchema,
  submitRevaluationRequestSchema,
  processRevaluationRequestSchema,
  updateBacklogSchema_w02,
  scheduleSupplementaryExamsSchema,
  clearBacklogSchema,
  determinePromotionsSchema,
  updatePromotionDecisionSchema_w02,
  computeCOAttainmentSchema,
  computePOAttainmentSchema,
  computeProgrammeHealthSchema,
  feedComplianceEvidenceSchema,
  generateRiskAlertsSchema,
  transitionStudentStatesSchema,
  appendAcademicHistorySchema,
  generateTranscriptSchema,
  dispatchAcademicNotificationsSchema,
  submitResultsToJNTUSchema,
  optimizeElectivesSchema,
  submitCondonationSchema,
  resolveCondonationSchema,
  bulkExternalMarksSchema,
  validateMarksSchema,
  computeResultsSchema,
  publishResultsSchema,
  promoteStudentsSchema,
  registerBacklogSchema,
  submitRevaluationSchema,
  generateSeatingPlanSchema,
  assignInvigilationSchema,
  aggregatePOAttainmentSchema,
  createAttainmentRunSchema,
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
// Class roster for an offering — powers the attendance grid and the
// internal-marks sheet. Declared before /offerings/:id so the extra segment
// is not swallowed by the generic id route.
router.get('/offerings/:id/roster', authorize('academics', 'read'), ctrl.getCourseOfferingRoster);
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

// ═══ W02: Hall Ticket Eligibility ═══════════════════════════
router.get('/eligibility/check', authorize('academics', 'read'), ctrl.checkHallTicketEligibility);
router.post('/eligibility/bulk-check', authorize('academics', 'create'), validate(checkBulkEligibilitySchema), ctrl.checkBulkEligibility);

// ═══ W02: Exam Fee & Seating ════════════════════════════════
router.post('/exam-fees/generate', authorize('academics', 'create'), validate(generateExamFeeInvoiceSchema), ctrl.generateExamFeeInvoice);

// Seating Plans
router.get('/seating-plans', authorize('academics', 'read'), ctrl.listSeatingPlans);
router.post('/seating-plans', authorize('academics', 'create'), validate(createSeatingPlanSchema_w02), ctrl.createSeatingPlan);
router.put('/seating-plans/:id', authorize('academics', 'update'), validate(updateSeatingPlanSchema), ctrl.updateSeatingPlan);
router.delete('/seating-plans/:id', authorize('academics', 'delete'), ctrl.deleteSeatingPlan);

// Invigilation Rosters
router.get('/invigilation-rosters', authorize('academics', 'read'), ctrl.listInvigilationRosters);
router.post('/invigilation-rosters', authorize('academics', 'create'), validate(createInvigilationRosterSchema), ctrl.createInvigilationRoster);
router.put('/invigilation-rosters/:id', authorize('academics', 'update'), validate(updateInvigilationRosterSchema), ctrl.updateInvigilationRoster);
router.delete('/invigilation-rosters/:id', authorize('academics', 'delete'), ctrl.deleteInvigilationRoster);

// ═══ W02: Hall Tickets ══════════════════════════════════════
router.post('/hall-tickets/generate', authorize('academics', 'create'), validate(generateHallTicketsSchema), ctrl.generateHallTickets);
router.get('/hall-tickets', authorize('academics', 'read'), ctrl.listHallTickets);
router.get('/hall-tickets/:id', authorize('academics', 'read'), ctrl.getHallTicket);

// ═══ W02: Bulk Mark Entry ═══════════════════════════════════
router.post('/external-marks/bulk-enter', authorize('academics', 'create'), validate(bulkEnterExternalMarksSchema), ctrl.bulkEnterExternalMarks);
router.post('/external-marks/validate', authorize('academics', 'update'), validate(validateExternalMarksSchema), ctrl.validateExternalMarks);

// ═══ W02: Grade Computation ═════════════════════════════════
router.post('/grades/compute', authorize('academics', 'create'), validate(computeGradesSchema), ctrl.computeGradesForSemester);

// ═══ W02: SGPA/CGPA Computation ═══════════════════════════════
router.post('/semester-results/compute', authorize('academics', 'create'), validate(computeSemesterResultsSchema), ctrl.computeSemesterResults);

// ═══ W02: Result Publication ═════════════════════════════════
router.post('/semester-results/transition', authorize('academics', 'update'), validate(transitionResultStatusSchema), ctrl.transitionResultStatus);

// ═══ W02: Revaluation Requests ═══════════════════════════════
router.get('/revaluation-requests', authorize('academics', 'read'), ctrl.listRevaluationRequests);
router.get('/revaluation-requests/:id', authorize('academics', 'read'), ctrl.getRevaluationRequest);
router.post('/revaluation-requests', authorize('academics', 'create'), validate(submitRevaluationRequestSchema), ctrl.submitRevaluationRequest);
router.put('/revaluation-requests/:id/process', authorize('academics', 'update'), validate(processRevaluationRequestSchema), ctrl.processRevaluationRequest);

// ═══ W02: Backlogs ══════════════════════════════════════════
router.get('/backlogs', authorize('academics', 'read'), ctrl.listBacklogs);
router.get('/backlogs/:id', authorize('academics', 'read'), ctrl.getBacklog);
router.put('/backlogs/:id', authorize('academics', 'update'), validate(updateBacklogSchema_w02), ctrl.updateBacklog);

// ═══ W02: Supplementary Exams ═══════════════════════════════
router.post('/supplementary-exams/schedule', authorize('academics', 'create'), validate(scheduleSupplementaryExamsSchema), ctrl.scheduleSupplementaryExams);

// ═══ W02: Backlog Clearance ══════════════════════════════════
router.put('/backlogs/:id/clear', authorize('academics', 'update'), validate(clearBacklogSchema), ctrl.clearBacklog);

// ═══ W02: Promotion/Detention ════════════════════════════════
router.post('/promotions/determine', authorize('academics', 'create'), validate(determinePromotionsSchema), ctrl.determinePromotions);
router.get('/promotions', authorize('academics', 'read'), ctrl.listPromotionDecisions);
router.get('/promotions/:id', authorize('academics', 'read'), ctrl.getPromotionDecision);
router.put('/promotions/:id', authorize('academics', 'update'), validate(updatePromotionDecisionSchema_w02), ctrl.updatePromotionDecision);

// ═══ W02: OBE Attainment ════════════════════════════════════
router.post('/obe/co-attainment/compute', authorize('academics', 'create'), validate(computeCOAttainmentSchema), ctrl.computeCOAttainmentForSemester);
router.post('/obe/po-attainment/compute', authorize('academics', 'create'), validate(computePOAttainmentSchema), ctrl.computePOAttainment);
router.post('/obe/programme-health/compute', authorize('academics', 'create'), validate(computeProgrammeHealthSchema), ctrl.computeProgrammeHealth);

// ═══ W02 Phase 3: Compliance Evidence Feed ══════════════════════
router.post('/compliance/evidence-feed', authorize('academics', 'create'), validate(feedComplianceEvidenceSchema), ctrl.feedComplianceEvidence);

// ═══ W02 Phase 3: Dashboards ════════════════════════════════════
router.get('/dashboards/academic-performance', authorize('academics', 'read'), ctrl.getAcademicPerformanceDashboard);
router.get('/dashboards/attendance-analytics', authorize('academics', 'read'), ctrl.getAttendanceAnalyticsDashboard);

// ═══ W02 Phase 3: Risk Alerts ═══════════════════════════════════
router.post('/risk-alerts/generate', authorize('academics', 'create'), validate(generateRiskAlertsSchema), ctrl.generateRiskAlerts);

// ═══ W02 Phase 3: Student Lifecycle ═════════════════════════════
router.post('/students/transition-states', authorize('academics', 'create'), validate(transitionStudentStatesSchema), ctrl.transitionStudentStates);
router.post('/students/append-history', authorize('academics', 'create'), validate(appendAcademicHistorySchema), ctrl.appendAcademicHistory);
router.post('/transcripts/generate', authorize('academics', 'create'), validate(generateTranscriptSchema), ctrl.generateTranscript);

// ═══ W02 Phase 3: Notifications ═════════════════════════════════
router.post('/notifications/dispatch', authorize('academics', 'create'), validate(dispatchAcademicNotificationsSchema), ctrl.dispatchAcademicNotifications);

// ═══ W02 Phase 3: JNTU Integration Stubs ════════════════════════
router.post('/jntu/submit-results', authorize('academics', 'create'), validate(submitResultsToJNTUSchema), ctrl.submitResultsToJNTU);
router.post('/jntu/fetch-regulations', authorize('academics', 'create'), ctrl.fetchJNTURegulations);

// ═══ W02 Academic Delivery Routes ═══════════════════════════

// ── Curriculum & Scheduling ────────────────────────────────
router.post('/curriculum/instantiate', authorize('academics', 'create'), validate(instantiateCurriculumSchema), ctrl.instantiateCurriculumCtrl);
router.post('/sections/form', authorize('academics', 'create'), validate(formSectionsSchema), ctrl.formSectionsCtrl);
router.put('/offerings/:id/assign-faculty', authorize('academics', 'update'), validate(assignFacultySchema), ctrl.assignFacultyCtrl);
router.post('/elective-allocations/optimize', authorize('academics', 'create'), validate(optimizeElectivesSchema), ctrl.optimizeElectivesCtrl);
router.post('/elective-allocations/finalize', authorize('academics', 'update'), validate(optimizeElectivesSchema), ctrl.finalizeElectivesCtrl);
router.get('/timetables/:id/conflicts', authorize('academics', 'read'), ctrl.detectConflictsCtrl);

// ── Attendance ─────────────────────────────────────────────
router.post('/attendance/compute-summary', authorize('academics', 'read'), ctrl.computeAttendanceSummaryCtrl);
router.get('/attendance/check-threshold', authorize('academics', 'read'), ctrl.checkAttendanceThresholdCtrl);
router.post('/attendance-alerts/generate', authorize('academics', 'create'), ctrl.generateAttendanceAlertsCtrl);
router.post('/condonation-requests', authorize('academics', 'create'), validate(submitCondonationSchema), ctrl.submitCondonationCtrl);
router.put('/condonation-requests/:id/resolve', authorize('academics', 'update'), validate(resolveCondonationSchema), ctrl.resolveCondonationCtrl);

// ── CIE & Marks ────────────────────────────────────────────
router.post('/internal-assessments/compute-cie', authorize('academics', 'update'), ctrl.computeCIECtrl);
router.post('/internal-assessments/compute-batch-cie', authorize('academics', 'update'), ctrl.computeBatchCIECtrl);
router.post('/external-marks/bulk', authorize('academics', 'create'), validate(bulkExternalMarksSchema), ctrl.bulkEnterExternalMarksCtrl);
router.post('/external-marks/validate', authorize('academics', 'update'), validate(validateMarksSchema), ctrl.validateExternalMarksCtrl);

// ── Results & Promotion ────────────────────────────────────
router.post('/results/compute', authorize('academics', 'create'), validate(computeResultsSchema), ctrl.computeResultsCtrl);
router.post('/results/publish', authorize('academics', 'update'), validate(publishResultsSchema), ctrl.publishResultsCtrl);
router.post('/results/promote', authorize('academics', 'update'), validate(promoteStudentsSchema), ctrl.promoteStudentsCtrl);
router.post('/backlogs', authorize('academics', 'create'), validate(registerBacklogSchema), ctrl.registerBacklogCtrl);
router.put('/backlogs/:id/clear', authorize('academics', 'update'), validate(clearBacklogSchema), ctrl.clearBacklogCtrl);
router.post('/revaluation-requests', authorize('academics', 'create'), validate(submitRevaluationSchema), ctrl.submitRevaluationCtrl);

// ── Exam Management ────────────────────────────────────────
router.post('/exam-registrations/check-eligibility', authorize('academics', 'read'), ctrl.checkHallTicketEligibilityCtrl);
router.post('/hall-tickets/generate', authorize('academics', 'create'), validate(generateHallTicketsSchema), ctrl.generateHallTicketsCtrl);
router.post('/exam-schedules/:id/seating-plan', authorize('academics', 'create'), validate(generateSeatingPlanSchema), ctrl.generateSeatingPlanCtrl);
router.post('/exam-schedules/:id/invigilation', authorize('academics', 'create'), validate(assignInvigilationSchema), ctrl.assignInvigilationCtrl);

// ── OBE ────────────────────────────────────────────────────
router.post('/obe/compute-co-attainment', authorize('academics', 'create'), validate(computeCOAttainmentSchema), ctrl.computeCOAttainmentCtrl);
router.post('/obe/aggregate-po-attainment', authorize('academics', 'create'), validate(aggregatePOAttainmentSchema), ctrl.aggregatePOAttainmentCtrl);
router.post('/obe/programme-health', authorize('academics', 'create'), validate(computeProgrammeHealthSchema), ctrl.computeProgrammeHealthCtrl);
router.post('/obe/attainment-runs', authorize('academics', 'create'), validate(createAttainmentRunSchema), ctrl.createAttainmentRunCtrl);

// ── Academic Reads ─────────────────────────────────────────
router.get('/students/:id/attendance-report', authorize('academics', 'read'), ctrl.getStudentAttendanceReportCtrl);
router.get('/students/:id/academic-summary', authorize('academics', 'read'), ctrl.getStudentAcademicSummaryCtrl);
router.get('/offerings/:id/delivery-progress', authorize('academics', 'read'), ctrl.getCourseDeliveryProgressCtrl);
router.get('/exam-calendar', authorize('academics', 'read'), ctrl.getExamCalendarCtrl);
router.get('/enrollment-count', authorize('academics', 'read'), ctrl.getSemesterEnrollmentCountCtrl);

// ─── Strategic Gap 6 — Examination administration depth (Phase A) ─────
// Master-data CRUD for the 7 new exam-config entities. Validation
// schemas deferred to Phase B; v1 leans on Mongoose schema enums +
// service-layer 404s, same as the existing exam-management endpoints.
router.get   ('/exam-config/rooms',                 authorize('academics', 'read'),   examCfg.listExamRooms);
router.get   ('/exam-config/rooms/:id',             authorize('academics', 'read'),   examCfg.getExamRoom);
router.post  ('/exam-config/rooms',                 authorize('academics', 'create'), examCfg.createExamRoom);
router.put   ('/exam-config/rooms/:id',             authorize('academics', 'update'), examCfg.updateExamRoom);
router.delete('/exam-config/rooms/:id',             authorize('academics', 'delete'), examCfg.deleteExamRoom);

router.get   ('/exam-config/evaluators',            authorize('academics', 'read'),   examCfg.listEvaluators);
router.get   ('/exam-config/evaluators/:id',        authorize('academics', 'read'),   examCfg.getEvaluator);
router.post  ('/exam-config/evaluators',            authorize('academics', 'create'), examCfg.createEvaluator);
router.put   ('/exam-config/evaluators/:id',        authorize('academics', 'update'), examCfg.updateEvaluator);
router.delete('/exam-config/evaluators/:id',        authorize('academics', 'delete'), examCfg.deleteEvaluator);

router.get   ('/exam-config/grade-templates',       authorize('academics', 'read'),   examCfg.listGradeTemplates);
router.get   ('/exam-config/grade-templates/:id',   authorize('academics', 'read'),   examCfg.getGradeTemplate);
router.post  ('/exam-config/grade-templates',       authorize('academics', 'create'), examCfg.createGradeTemplate);
router.put   ('/exam-config/grade-templates/:id',   authorize('academics', 'update'), examCfg.updateGradeTemplate);
router.delete('/exam-config/grade-templates/:id',   authorize('academics', 'delete'), examCfg.deleteGradeTemplate);

router.get   ('/exam-config/centre-templates',      authorize('academics', 'read'),   examCfg.listExamCentreTemplates);
router.get   ('/exam-config/centre-templates/:id',  authorize('academics', 'read'),   examCfg.getExamCentreTemplate);
router.post  ('/exam-config/centre-templates',      authorize('academics', 'create'), examCfg.createExamCentreTemplate);
router.put   ('/exam-config/centre-templates/:id',  authorize('academics', 'update'), examCfg.updateExamCentreTemplate);
router.delete('/exam-config/centre-templates/:id',  authorize('academics', 'delete'), examCfg.deleteExamCentreTemplate);

router.get   ('/exam-config/question-papers',       authorize('academics', 'read'),   examCfg.listQuestionPapers);
router.get   ('/exam-config/question-papers/:id',   authorize('academics', 'read'),   examCfg.getQuestionPaper);
router.post  ('/exam-config/question-papers',       authorize('academics', 'create'), examCfg.createQuestionPaper);
router.put   ('/exam-config/question-papers/:id',   authorize('academics', 'update'), examCfg.updateQuestionPaper);
router.delete('/exam-config/question-papers/:id',   authorize('academics', 'delete'), examCfg.deleteQuestionPaper);

router.get   ('/exam-config/signatures',            authorize('academics', 'read'),   examCfg.listSignatureTypes);
router.get   ('/exam-config/signatures/:id',        authorize('academics', 'read'),   examCfg.getSignatureType);
router.post  ('/exam-config/signatures',            authorize('academics', 'create'), examCfg.createSignatureType);
router.put   ('/exam-config/signatures/:id',        authorize('academics', 'update'), examCfg.updateSignatureType);
router.delete('/exam-config/signatures/:id',        authorize('academics', 'delete'), examCfg.deleteSignatureType);

router.get   ('/exam-config/mooc-subjects',         authorize('academics', 'read'),   examCfg.listMoocSubjects);
router.get   ('/exam-config/mooc-subjects/:id',     authorize('academics', 'read'),   examCfg.getMoocSubject);
router.post  ('/exam-config/mooc-subjects',         authorize('academics', 'create'), examCfg.createMoocSubject);
router.put   ('/exam-config/mooc-subjects/:id',     authorize('academics', 'update'), examCfg.updateMoocSubject);
router.delete('/exam-config/mooc-subjects/:id',     authorize('academics', 'delete'), examCfg.deleteMoocSubject);

export default router;
