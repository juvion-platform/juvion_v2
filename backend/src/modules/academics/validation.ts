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
  status: z.enum(['requested', 'allocated', 'rejected']).optional(),
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
