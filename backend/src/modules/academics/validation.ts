import { z } from 'zod';

// ─── Regulation ─────────────────────────────────────────
export const createRegulationSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  effectiveFromYear: z.number().int().min(2000),
  effectiveToYear: z.number().int().optional(),
  totalCredits: z.number().int().min(1),
  maxYears: z.number().int().min(1),
  isActive: z.boolean().optional(),
});
export const updateRegulationSchema = createRegulationSchema.partial();

// ─── Programme ──────────────────────────────────────────
export const createProgrammeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  level: z.enum(['UG', 'PG', 'Diploma', 'PhD']),
  durationYears: z.number().int().min(1),
  regulationId: z.string().min(1, 'Regulation is required'),
  isActive: z.boolean().optional(),
});
export const updateProgrammeSchema = createProgrammeSchema.partial();

// ─── Department ─────────────────────────────────────────
export const createDepartmentSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  hodId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

// ─── Branch ─────────────────────────────────────────────
export const createBranchSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  programmeId: z.string().min(1, 'Programme is required'),
  departmentId: z.string().optional(),
  intake: z.number().int().min(0),
  isActive: z.boolean().optional(),
});
export const updateBranchSchema = createBranchSchema.partial();

// ─── Batch ──────────────────────────────────────────────
export const createBatchSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  admissionYear: z.number().int().min(2000),
  programmeId: z.string().min(1, 'Programme is required'),
  regulationId: z.string().min(1, 'Regulation is required'),
  isActive: z.boolean().optional(),
});
export const updateBatchSchema = createBatchSchema.partial();

// ─── Section ────────────────────────────────────────────
export const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branchId: z.string().min(1, 'Branch is required'),
  batchId: z.string().min(1, 'Batch is required'),
  year: z.number().int().min(1).max(6),
  semester: z.number().int().min(1).max(12),
  capacity: z.number().int().min(1).optional(),
  classAdvisorId: z.string().optional(),
});
export const updateSectionSchema = createSectionSchema.partial();

// ─── Academic Year ──────────────────────────────────────
export const createAcademicYearSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  label: z.string().min(1, 'Label is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isCurrent: z.boolean().optional(),
});
export const updateAcademicYearSchema = createAcademicYearSchema.partial();

// ─── Semester ───────────────────────────────────────────
export const createSemesterSchema = z.object({
  academicYearId: z.string().min(1, 'Academic year is required'),
  number: z.number().int().min(1).max(12),
  year: z.number().int().min(1).max(6),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.enum(['upcoming', 'active', 'completed']).optional(),
});
export const updateSemesterSchema = createSemesterSchema.partial();

// ─── Course ─────────────────────────────────────────────
export const createCourseSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  regulationId: z.string().min(1, 'Regulation is required'),
  departmentId: z.string().min(1, 'Department is required'),
  credits: z.number().int().min(0),
  lectureHrs: z.number().int().min(0).optional(),
  tutorialHrs: z.number().int().min(0).optional(),
  practicalHrs: z.number().int().min(0).optional(),
  type: z.enum(['theory', 'lab', 'project', 'seminar', 'audit']),
  isElective: z.boolean().optional(),
});
export const updateCourseSchema = createCourseSchema.partial();

// ─── Curriculum Map ─────────────────────────────────────
export const createCurriculumMapSchema = z.object({
  regulationId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().min(1),
  semester: z.number().int().min(1).max(12),
  courseId: z.string().min(1),
  isElective: z.boolean().optional(),
  electiveGroup: z.string().optional(),
});
export const updateCurriculumMapSchema = createCurriculumMapSchema.partial();

// ─── Course Offering ────────────────────────────────────
export const createCourseOfferingSchema = z.object({
  courseId: z.string().min(1),
  semesterId: z.string().min(1),
  sectionId: z.string().min(1),
  facultyId: z.string().min(1),
  maxEnrollment: z.number().int().min(1).optional(),
});
export const updateCourseOfferingSchema = createCourseOfferingSchema.partial();

// ─── Enrollment ─────────────────────────────────────────
export const createEnrollmentSchema = z.object({
  studentId: z.string().min(1),
  courseOfferingId: z.string().min(1),
  semesterId: z.string().min(1),
  status: z.enum(['enrolled', 'dropped', 'withdrawn', 'completed']).optional(),
});
export const updateEnrollmentSchema = createEnrollmentSchema.partial();

// ═══ Phase 3: Scheduling ═══════════════════════════════════

export const createAcademicCalendarSchema = z.object({
  academicYearId: z.string().min(1),
  title: z.string().min(1),
  eventType: z.enum(['instruction', 'exam', 'holiday', 'event', 'registration', 'result']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  description: z.string().optional(),
  isHoliday: z.boolean().optional(),
});
export const updateAcademicCalendarSchema = createAcademicCalendarSchema.partial();

export const createTimetableSchema = z.object({
  semesterId: z.string().min(1),
  sectionId: z.string().min(1),
  version: z.number().int().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  effectiveFrom: z.string().min(1),
});
export const updateTimetableSchema = createTimetableSchema.partial();

export const createTimetableSlotSchema = z.object({
  timetableId: z.string().min(1),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  period: z.number().int().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  courseOfferingId: z.string().min(1),
  roomId: z.string().optional(),
  slotType: z.enum(['lecture', 'tutorial', 'lab', 'free']).optional(),
});
export const updateTimetableSlotSchema = createTimetableSlotSchema.partial();

// ═══ Phase 4: Attendance ═══════════════════════════════════

export const createAttendanceSessionSchema = z.object({
  courseOfferingId: z.string().min(1),
  date: z.string().min(1),
  period: z.number().int().min(1),
  facultyId: z.string().min(1),
  topicCovered: z.string().optional(),
  status: z.enum(['open', 'closed']).optional(),
});
export const updateAttendanceSessionSchema = createAttendanceSessionSchema.partial();

export const createAttendanceRecordSchema = z.object({
  sessionId: z.string().min(1),
  studentId: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'od', 'leave']),
  markedBy: z.string().min(1),
  remarks: z.string().optional(),
});
export const updateAttendanceRecordSchema = createAttendanceRecordSchema.partial();

// ═══ Phase 5: Internal Assessments ═════════════════════════

export const createInternalAssessmentSchema = z.object({
  courseOfferingId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['mid1', 'mid2', 'assignment', 'quiz', 'seminar', 'lab_internal']),
  maxMarks: z.number().min(0),
  weightage: z.number().min(0).max(100),
  date: z.string().optional(),
  status: z.enum(['scheduled', 'conducted', 'marks_entered', 'finalized']).optional(),
});
export const updateInternalAssessmentSchema = createInternalAssessmentSchema.partial();

export const createInternalMarkSchema = z.object({
  assessmentId: z.string().min(1),
  studentId: z.string().min(1),
  marksObtained: z.number().min(0),
  remarks: z.string().optional(),
});
export const updateInternalMarkSchema = createInternalMarkSchema.partial();

// ═══ Phase 6: Exams ════════════════════════════════════════

export const createExamRegistrationSchema = z.object({
  studentId: z.string().min(1),
  courseOfferingId: z.string().min(1),
  semesterId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
  isEligible: z.boolean().optional(),
  status: z.enum(['registered', 'approved', 'rejected', 'appeared', 'absent']).optional(),
});
export const updateExamRegistrationSchema = createExamRegistrationSchema.partial();

export const createExamScheduleSchema = z.object({
  semesterId: z.string().min(1),
  courseId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().optional(),
  status: z.enum(['scheduled', 'conducted', 'cancelled']).optional(),
});
export const updateExamScheduleSchema = createExamScheduleSchema.partial();

export const createExternalMarkSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  semesterId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
  maxMarks: z.number().min(0),
  marksObtained: z.number().min(0),
  result: z.enum(['pass', 'fail', 'absent', 'withheld']),
});
export const updateExternalMarkSchema = createExternalMarkSchema.partial();

// ═══ Phase 7: Results ══════════════════════════════════════

export const createGradeCardSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  courseId: z.string().min(1),
  internalMarks: z.number().min(0),
  externalMarks: z.number().min(0),
  totalMarks: z.number().min(0),
  grade: z.string().min(1),
  gradePoints: z.number().min(0),
  credits: z.number().min(0),
  result: z.enum(['pass', 'fail', 'absent']),
});
export const updateGradeCardSchema = createGradeCardSchema.partial();

export const createSemesterResultSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  sgpa: z.number().min(0).max(10),
  cgpa: z.number().min(0).max(10),
  totalCreditsEarned: z.number().int().min(0),
  totalCreditsRegistered: z.number().int().min(0),
  backlogs: z.number().int().min(0),
  result: z.enum(['pass', 'fail', 'detained']),
});
export const updateSemesterResultSchema = createSemesterResultSchema.partial();

// ═══ Phase 8: OBE & Miscellaneous ══════════════════════════

export const createCourseOutcomeSchema = z.object({
  courseId: z.string().min(1),
  code: z.string().min(1),
  description: z.string().min(1),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  poMappings: z.array(z.object({ poCode: z.string(), level: z.number().int().min(1).max(3) })).optional(),
});
export const updateCourseOutcomeSchema = createCourseOutcomeSchema.partial();

export const createProgramOutcomeSchema = z.object({
  programmeId: z.string().min(1),
  code: z.string().min(1),
  description: z.string().min(1),
});
export const updateProgramOutcomeSchema = createProgramOutcomeSchema.partial();

export const createElectiveAllocationSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  electiveGroup: z.string().min(1),
  courseId: z.string().min(1),
  preference: z.number().int().min(1),
  status: z.enum(['requested', 'allocated', 'finalized', 'rejected']).optional(),
});
export const updateElectiveAllocationSchema = createElectiveAllocationSchema.partial();

export const createLessonPlanSchema = z.object({
  courseOfferingId: z.string().min(1),
  weekNumber: z.number().int().min(1),
  topic: z.string().min(1),
  cosCovered: z.array(z.string()).optional(),
  teachingMethod: z.string().optional(),
  plannedDate: z.string().optional(),
  completedDate: z.string().optional(),
  status: z.enum(['planned', 'completed', 'skipped']).optional(),
});
export const updateLessonPlanSchema = createLessonPlanSchema.partial();

// ═══ W02: Curriculum Instantiation & Calendar Publish ═════════

export const instantiateCurriculumSchema = z.object({
  semesterId: z.string().min(1, 'Semester is required'),
  regulationId: z.string().min(1, 'Regulation is required'),
  programmeId: z.string().min(1, 'Programme is required'),
  branchId: z.string().min(1, 'Branch is required'),
});

export const createCourseFeedbackSchema = z.object({
  courseOfferingId: z.string().min(1),
  studentId: z.string().min(1),
  ratings: z.array(z.object({ parameter: z.string(), score: z.number().min(1).max(5) })),
  overallRating: z.number().min(1).max(5),
  comments: z.string().optional(),
});
export const updateCourseFeedbackSchema = createCourseFeedbackSchema.partial();

// ═══ W02: Section Formation & Lab Batch Creation ═════════════

export const formSectionsSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  batchId: z.string().min(1, 'Batch is required'),
  semesterId: z.string().min(1, 'Semester is required'),
  year: z.number().int().min(1).max(6),
  semester: z.number().int().min(1).max(12),
});

export const createLabBatchesSchema = z.object({
  labBatchSize: z.number().int().min(1).optional(),
});

// ═══ W02: Faculty Assignment & Timetable Conflict Detection ═════

export const assignFacultySchema = z.object({
  facultyId: z.string().min(1, 'Faculty ID is required'),
});

// ═══ W02: Timetable Substitution & Elective Allocation ═════════

export const applySubstitutionSchema = z.object({
  substituteFacultyId: z.string().min(1, 'Substitute faculty ID is required'),
});

export const optimizeElectiveAllocationsSchema = z.object({
  semesterId: z.string().min(1, 'Semester is required'),
  electiveGroup: z.string().min(1, 'Elective group is required'),
});

export const finalizeElectiveAllocationsSchema = z.object({
  semesterId: z.string().min(1, 'Semester is required'),
  electiveGroup: z.string().min(1, 'Elective group is required'),
});

// ═══ W02: Attendance Summary & Alerts ═════════════════════════

export const refreshAttendanceSummarySchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  courseOfferingId: z.string().min(1, 'Course offering ID is required'),
});

// ═══ W02: Condonation Request Workflow ═══════════════════════

export const submitCondonationRequestSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  courseOfferingId: z.string().min(1, 'Course offering ID is required'),
  semesterId: z.string().min(1, 'Semester ID is required'),
  reason: z.enum(['medical', 'od', 'family_emergency', 'other']),
  description: z.string().min(1, 'Description is required'),
  supportingDocuments: z.array(z.string()).optional(),
  classesRequested: z.number().int().positive('Classes requested must be a positive integer'),
});

export const reviewCondonationRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewRemarks: z.string().optional(),
});

// ═══ W02: CIE Computation Engine ═══════════════════════════

export const computeCIESchema = z.object({
  courseOfferingId: z.string().min(1, 'Course offering ID is required'),
});

// ═══ W02: Assignments ═══════════════════════════════════════

export const createAssignmentSchema = z.object({
  courseOfferingId: z.string().min(1),
  assessmentId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  instructions: z.string().optional(),
  maxMarks: z.number().min(0),
  dueDate: z.string().min(1),
  status: z.enum(['draft', 'published', 'closed', 'graded']).optional(),
  coMappings: z.array(z.object({ coCode: z.string(), weight: z.number().min(0).max(1) })).optional(),
  attachments: z.array(z.string()).optional(),
});
export const updateAssignmentSchema = createAssignmentSchema.partial();

// ═══ W02: Submissions ═══════════════════════════════════════

export const createSubmissionSchema = z.object({
  assignmentId: z.string().min(1),
  studentId: z.string().min(1),
  content: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});
export const gradeSubmissionSchema = z.object({
  marksObtained: z.number().min(0),
  remarks: z.string().optional(),
});

// ═══ W02: Quizzes ═══════════════════════════════════════════

export const createQuizSchema = z.object({
  courseOfferingId: z.string().min(1),
  assessmentId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  maxMarks: z.number().min(0),
  duration: z.number().int().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.enum(['draft', 'published', 'active', 'closed', 'graded']).optional(),
  questions: z.array(z.object({
    questionText: z.string().min(1),
    type: z.enum(['mcq', 'true_false', 'short_answer']),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().min(1),
    marks: z.number().min(0),
    coCode: z.string().optional(),
  })),
  shuffleQuestions: z.boolean().optional(),
  showResults: z.boolean().optional(),
});
export const updateQuizSchema = createQuizSchema.partial();

// ═══ W02: Quiz Attempts ═════════════════════════════════════

export const submitQuizAttemptSchema = z.object({
  quizId: z.string().min(1),
  studentId: z.string().min(1),
  answers: z.array(z.object({
    questionIndex: z.number().int().min(0),
    answer: z.string(),
  })),
});

// ═══ W02: Hall Ticket Eligibility ═══════════════════════════

export const checkBulkEligibilitySchema = z.object({
  semesterId: z.string().min(1, 'Semester ID is required'),
});

// ═══ W02: Exam Fee & Seating ════════════════════════════════

export const generateExamFeeInvoiceSchema = z.object({
  studentId: z.string().min(1),
  semesterId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
  feeAmount: z.number().positive(),
});

export const createSeatingPlanSchema_w02 = z.object({
  examScheduleId: z.string().min(1),
  roomName: z.string().min(1),
  capacity: z.number().int().positive(),
  assignments: z.array(z.object({
    seatNumber: z.string().min(1),
    studentId: z.string().min(1),
    examRegistrationId: z.string().min(1),
  })).optional(),
  status: z.enum(['draft', 'published']).optional(),
});
export const updateSeatingPlanSchema = createSeatingPlanSchema_w02.partial();

export const createInvigilationRosterSchema = z.object({
  examScheduleId: z.string().min(1),
  duties: z.array(z.object({
    facultyId: z.string().min(1),
    roomName: z.string().min(1),
    role: z.enum(['chief', 'assistant', 'flying_squad']),
  })),
  status: z.enum(['draft', 'published']).optional(),
});
export const updateInvigilationRosterSchema = createInvigilationRosterSchema.partial();

// ═══ W02: Hall Tickets ══════════════════════════════════════

export const generateHallTicketsSchema = z.object({
  semesterId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
});

// ═══ W02: Bulk Mark Entry ═══════════════════════════════════

export const bulkEnterExternalMarksSchema = z.object({
  semesterId: z.string().min(1),
  courseId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary', 'improvement']),
  marks: z.array(z.object({
    studentId: z.string().min(1),
    marksObtained: z.number().min(0),
    maxMarks: z.number().positive(),
  })).min(1),
});

export const validateExternalMarksSchema = z.object({
  semesterId: z.string().min(1),
  courseId: z.string().min(1),
});

// ═══ W02: Grade Computation ═════════════════════════════════

export const computeGradesSchema = z.object({
  semesterId: z.string().min(1),
});

// ═══ W02: SGPA/CGPA Computation ═══════════════════════════════

export const computeSemesterResultsSchema = z.object({
  semesterId: z.string().min(1, 'Semester ID is required'),
});

// ═══ W02: Result Publication ═════════════════════════════════

export const transitionResultStatusSchema = z.object({
  semesterId: z.string().min(1),
  targetStatus: z.enum(['board_review', 'approved', 'published']),
  boardDecision: z.string().optional(),
});

// ═══ W02: Revaluation Requests ═══════════════════════════════

export const submitRevaluationRequestSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  semesterId: z.string().min(1),
  examType: z.enum(['regular', 'supplementary']),
  originalMarks: z.number().min(0),
  reason: z.string().min(1),
});

export const processRevaluationRequestSchema = z.object({
  action: z.enum(['forward', 'complete', 'reject']),
  revaluedMarks: z.number().min(0).optional(),
  outcome: z.enum(['marks_increased', 'marks_decreased', 'no_change']).optional(),
});

// ═══ W02: Backlogs ══════════════════════════════════════════

export const updateBacklogSchema_w02 = z.object({
  currentStatus: z.enum(['created', 'registered_for_supplementary', 'appeared', 'cleared', 'persists']).optional(),
  clearedGrade: z.string().optional(),
});

// ═══ W02: Supplementary Exams ═══════════════════════════════

export const scheduleSupplementaryExamsSchema = z.object({
  semesterId: z.string().min(1),
});

// ═══ W02: Backlog Clearance ══════════════════════════════════

export const clearBacklogSchema = z.object({
  clearedGrade: z.string().min(1),
  clearedInSemesterId: z.string().min(1),
});

// ═══ W02: Promotion/Detention ════════════════════════════════

export const determinePromotionsSchema = z.object({
  academicYearId: z.string().min(1),
  year: z.number().int().min(1).max(6),
});

export const updatePromotionDecisionSchema_w02 = z.object({
  decision: z.enum(['promoted', 'detained', 'year_back', 'graduated', 'rusticated']).optional(),
  reason: z.string().optional(),
  boardMeetingDate: z.string().optional(),
  effectiveDate: z.string().optional(),
});

// ═══ W02: OBE Attainment ════════════════════════════════════

export const computeCOAttainmentSchema = z.object({
  semesterId: z.string().min(1),
  threshold: z.number().min(0).max(100).optional().default(50),
});

export const computePOAttainmentSchema = z.object({
  programmeId: z.string().min(1),
  semesterId: z.string().min(1),
});

export const computeProgrammeHealthSchema = z.object({
  programmeId: z.string().min(1),
  semesterId: z.string().min(1),
});

// ═══ W02 Phase 3: Compliance / Dashboards / Risk ════════════════

export const feedComplianceEvidenceSchema = z.object({
  semesterId: z.string().min(1),
});

export const generateRiskAlertsSchema = z.object({
  semesterId: z.string().min(1),
});

// ═══ W02 Phase 3: Student Lifecycle ═════════════════════════════

export const transitionStudentStatesSchema = z.object({
  semesterId: z.string().min(1),
});

export const appendAcademicHistorySchema = z.object({
  semesterId: z.string().min(1),
});

export const generateTranscriptSchema = z.object({
  studentId: z.string().min(1),
  transcriptType: z.enum(['semester', 'consolidated', 'provisional']),
  semesterId: z.string().min(1).optional(),
});

// ═══ W02 Phase 3: Notifications & JNTU Integration ═══════════════════

export const dispatchAcademicNotificationsSchema = z.object({
  semesterId: z.string().min(1),
  eventType: z.enum(['result_published', 'attendance_warning', 'exam_scheduled', 'assignment_due']),
});

export const submitResultsToJNTUSchema = z.object({
  semesterId: z.string().min(1),
});
