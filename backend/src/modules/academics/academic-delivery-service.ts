import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { CurriculumMap } from '../../models/academic-ops/CurriculumMap';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { AttendanceSummary } from '../../models/academic-ops/AttendanceSummary';
import { AttendanceAlert } from '../../models/academic-ops/AttendanceAlert';
import { CondonationRequest } from '../../models/academic-ops/CondonationRequest';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { InternalMark } from '../../models/academic-ops/InternalMark';
import { ExternalMark } from '../../models/academic-ops/ExternalMark';
import { GradeCard } from '../../models/academic-ops/GradeCard';
import { SemesterResult } from '../../models/academic-ops/SemesterResult';
import { ExamSchedule } from '../../models/academic-ops/ExamSchedule';
import { ExamRegistration } from '../../models/academic-ops/ExamRegistration';
import { HallTicket } from '../../models/academic-ops/HallTicket';
import { Backlog } from '../../models/academic-ops/Backlog';
import { RevaluationRequest } from '../../models/academic-ops/RevaluationRequest';
import { PromotionDecision } from '../../models/academic-ops/PromotionDecision';
import { SeatingPlan } from '../../models/academic-ops/SeatingPlan';
import { InvigilationRoster } from '../../models/academic-ops/InvigilationRoster';
import { COAttainmentRecord } from '../../models/academic-ops/COAttainmentRecord';
import { POAttainmentRecord } from '../../models/academic-ops/POAttainmentRecord';
import { ProgrammeHealthMetrics } from '../../models/academic-ops/ProgrammeHealthMetrics';
import { AttainmentRun } from '../../models/academic-ops/AttainmentRun';
import { Section } from '../../models/academic-structure/Section';
import { ElectiveAllocation } from '../../models/academic-ops/ElectiveAllocation';
import { CourseOutcome } from '../../models/academic-ops/CourseOutcome';
import { Course } from '../../models/academic-ops/Course';
import { LessonPlan } from '../../models/academic-ops/LessonPlan';
import { Student } from '../../models/people/Student';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate as _paginate } from '../../shared/pagination';


// ═══════════════════════════════════════════════════════════════
// §1  Curriculum & Scheduling (6 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Instantiate curriculum — creates CourseOfferings from CurriculumMap entries
 */
export async function instantiateCurriculum(
  collegeId: string,
  data: { semesterId: string; regulationId: string; programmeId: string; branchId: string; academicYearId: string },
  performedBy: string,
) {
  const entries = await CurriculumMap.find({
    collegeId,
    regulationId: data.regulationId,
    programmeId: data.programmeId,
    branchId: data.branchId,
  }).lean();

  if (!entries.length) {
    throw new AppError(404, 'No curriculum map entries found for the given regulation, programme, and branch');
  }

  // Find a default section for the branch (first available)
  const defaultSection = await Section.findOne({ collegeId, branchId: data.branchId }).lean();
  const sectionId = defaultSection ? String(defaultSection._id) : data.branchId; // fallback

  let created = 0;
  for (const entry of entries) {
    const existing = await CourseOffering.findOne({
      collegeId,
      courseId: entry.courseId,
      semesterId: data.semesterId,
    });
    if (!existing) {
      await CourseOffering.create({
        collegeId,
        courseId: entry.courseId,
        semesterId: data.semesterId,
        sectionId,
        facultyId: data.programmeId, // placeholder — must be assigned later
        status: 'draft',
      });
      created++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'CourseOffering',
    entityId: data.semesterId,
    entityName: `Curriculum instantiation (${created} offerings)`,
    action: 'create',
    changes: [{ field: 'count', displayName: 'Offerings Created', oldValue: 0, newValue: created }],
    performedBy,
  });

  return { created, total: entries.length };
}

/**
 * 2. Form sections — divide batch students into sections
 */
export async function formSections(
  collegeId: string,
  data: { batchId: string; semesterId: string; maxPerSection?: number },
  performedBy: string,
) {
  const maxPerSection = data.maxPerSection ?? 60;

  const studentCount = await Student.countDocuments({
    collegeId,
    batchId: data.batchId,
    status: 'active',
  });

  if (studentCount === 0) {
    throw new AppError(404, 'No active students found in this batch');
  }

  const sectionCount = Math.ceil(studentCount / maxPerSection);
  const students = await Student.find({
    collegeId,
    batchId: data.batchId,
    status: 'active',
  }).select('_id branchId').lean();

  // Determine branch from first student
  const branchId = students[0]?.branchId ? String(students[0].branchId) : '';
  if (!branchId) {
    throw new AppError(400, 'Students in this batch do not have a branch assigned');
  }

  const sectionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const createdSections: string[] = [];

  for (let i = 0; i < sectionCount; i++) {
    const sectionName = sectionLetters[i] || `S${i + 1}`;
    const sectionStudents = students.slice(i * maxPerSection, (i + 1) * maxPerSection);

    await Section.findOneAndUpdate(
      { collegeId, batchId: data.batchId, branchId, name: sectionName },
      {
        collegeId,
        name: sectionName,
        branchId,
        batchId: data.batchId,
        year: 1,
        semester: 1,
        capacity: maxPerSection,
        studentIds: sectionStudents.map(s => s._id),
      },
      { upsert: true, new: true },
    );
    createdSections.push(sectionName);
  }

  await createAuditLog({
    collegeId,
    entityType: 'Section',
    entityId: data.batchId,
    entityName: `Section formation (${sectionCount} sections)`,
    action: 'create',
    changes: [{ field: 'sections', displayName: 'Sections Formed', oldValue: null, newValue: createdSections }],
    performedBy,
  });

  return { sectionsCreated: sectionCount, sections: createdSections, totalStudents: studentCount };
}

/**
 * 3. Assign faculty to a course offering
 */
export async function assignFacultyToOffering(
  collegeId: string,
  offeringId: string,
  data: { facultyId: string; coFacultyIds?: string[] },
  performedBy: string,
) {
  const offering = await CourseOffering.findOne({ _id: offeringId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');

  const oldFacultyId = offering.facultyId ? String(offering.facultyId) : null;
  offering.facultyId = data.facultyId as any;
  if (data.coFacultyIds) {
    offering.coFacultyIds = data.coFacultyIds as any;
  }
  await offering.save();

  await createAuditLog({
    collegeId,
    entityType: 'CourseOffering',
    entityId: String(offering._id),
    entityName: `Faculty assignment for offering ${String(offering._id)}`,
    action: 'update',
    changes: [{ field: 'facultyId', displayName: 'Faculty', oldValue: oldFacultyId, newValue: data.facultyId }],
    performedBy,
  });

  return offering;
}

/**
 * 4. Optimize elective allocation — AI placeholder: first-preference allocation
 */
export async function optimizeElectiveAllocation(
  collegeId: string,
  data: { semesterId: string; electiveGroupId: string },
  performedBy: string,
) {
  const preferences = await ElectiveAllocation.find({
    collegeId,
    semesterId: data.semesterId,
    electiveGroup: data.electiveGroupId,
    status: 'requested',
  }).sort({ preference: 1 }).lean();

  if (!preferences.length) {
    throw new AppError(404, 'No elective preferences found for this group');
  }

  // Get course capacities from offerings
  const courseIds = [...new Set(preferences.map(p => String(p.courseId)))];
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId: data.semesterId,
    courseId: { $in: courseIds },
  }).lean();

  const capacityMap = new Map<string, number>();
  const allocatedMap = new Map<string, number>();
  for (const o of offerings) {
    capacityMap.set(String(o.courseId), o.maxEnrollment);
    allocatedMap.set(String(o.courseId), 0);
  }

  let allocated = 0;
  let overflow = 0;
  const allocatedStudents = new Set<string>();

  // First pass: allocate first preferences
  for (const pref of preferences) {
    if (pref.preference !== 1) continue;
    const courseKey = String(pref.courseId);
    const current = allocatedMap.get(courseKey) ?? 0;
    const capacity = capacityMap.get(courseKey) ?? 60;

    if (current < capacity) {
      await ElectiveAllocation.updateOne({ _id: pref._id }, { status: 'allocated' });
      allocatedMap.set(courseKey, current + 1);
      allocatedStudents.add(String(pref.studentId));
      allocated++;
    }
  }

  // Second pass: allocate second preferences for unallocated students
  for (const pref of preferences) {
    if (pref.preference !== 2) continue;
    if (allocatedStudents.has(String(pref.studentId))) continue;

    const courseKey = String(pref.courseId);
    const current = allocatedMap.get(courseKey) ?? 0;
    const capacity = capacityMap.get(courseKey) ?? 60;

    if (current < capacity) {
      await ElectiveAllocation.updateOne({ _id: pref._id }, { status: 'allocated' });
      allocatedMap.set(courseKey, current + 1);
      allocatedStudents.add(String(pref.studentId));
      allocated++;
    } else {
      overflow++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'ElectiveAllocation',
    entityId: data.electiveGroupId,
    entityName: `Elective optimization for group ${data.electiveGroupId}`,
    action: 'update',
    changes: [{ field: 'allocation', displayName: 'Allocation', oldValue: null, newValue: { allocated, overflow } }],
    performedBy,
  });

  return { allocated, overflow, totalPreferences: preferences.length };
}

/**
 * 5. Finalize elective allocation — mark as confirmed
 */
export async function finalizeElectiveAllocation(
  collegeId: string,
  data: { semesterId: string; electiveGroupId: string },
  performedBy: string,
) {
  const result = await ElectiveAllocation.updateMany(
    { collegeId, semesterId: data.semesterId, electiveGroup: data.electiveGroupId, status: 'allocated' },
    { status: 'finalized' },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ElectiveAllocation',
    entityId: data.electiveGroupId,
    entityName: `Elective finalization for group ${data.electiveGroupId}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'allocated', newValue: 'finalized' }],
    performedBy,
  });

  return { finalized: result.modifiedCount };
}

/**
 * 6. Detect timetable conflicts — placeholder
 */
export async function detectTimetableConflicts(
  _collegeId: string,
  _timetableId: string,
) {
  // Placeholder: full conflict detection would check room overlaps,
  // faculty double-booking, and student section clashes.
  return { conflicts: [] as string[], hasConflicts: false };
}


// ═══════════════════════════════════════════════════════════════
// §2  Attendance (5 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 7. Compute attendance summary for a student in a course offering
 */
export async function computeAttendanceSummary(
  collegeId: string,
  studentId: string,
  courseOfferingId: string,
) {
  const sessions = await AttendanceSession.find({
    collegeId,
    courseOfferingId,
    status: 'closed',
  }).select('_id').lean();

  const sessionIds = sessions.map(s => s._id);
  const totalClasses = sessionIds.length;

  const attended = await AttendanceRecord.countDocuments({
    collegeId,
    studentId,
    sessionId: { $in: sessionIds },
    status: { $in: ['present', 'late', 'od'] },
  });

  const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 10000) / 100 : 0;

  let category: string;
  if (percentage >= 85) category = 'safe';
  else if (percentage >= 75) category = 'warning';
  else if (percentage >= 65) category = 'at_risk';
  else category = 'detained';

  // Get the offering to find semesterId
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId }).select('semesterId').lean();
  const semesterId = offering ? String(offering.semesterId) : '';

  const summary = await AttendanceSummary.findOneAndUpdate(
    { collegeId, studentId, courseOfferingId },
    {
      collegeId,
      studentId,
      courseOfferingId,
      semesterId,
      totalClasses,
      attended,
      percentage,
      category,
      lastUpdatedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  return summary;
}

/**
 * 8. Check attendance threshold for exam eligibility
 */
export async function checkAttendanceThreshold(
  collegeId: string,
  studentId: string,
  courseOfferingId: string,
  threshold = 75,
) {
  let summary = await AttendanceSummary.findOne({
    collegeId,
    studentId,
    courseOfferingId,
  }).lean();

  if (!summary) {
    const computed = await computeAttendanceSummary(collegeId, studentId, courseOfferingId);
    return {
      meetsThreshold: computed.percentage >= threshold,
      percentage: computed.percentage,
      threshold,
    };
  }

  return {
    meetsThreshold: summary.percentage >= threshold,
    percentage: summary.percentage,
    threshold,
  };
}

/**
 * 9. Generate attendance alerts for students below threshold
 */
export async function generateAttendanceAlerts(
  collegeId: string,
  courseOfferingId: string,
  performedBy: string,
) {
  const enrollments = await Enrollment.find({
    collegeId,
    courseOfferingId,
    status: 'enrolled',
  }).select('studentId').lean();

  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId }).select('semesterId').lean();
  if (!offering) throw new AppError(404, 'Course offering not found');
  const semesterId = String(offering.semesterId);

  let alertCount = 0;
  for (const enrollment of enrollments) {
    const summary = await computeAttendanceSummary(collegeId, String(enrollment.studentId), courseOfferingId);
    const pct = summary.percentage;

    if (pct < 75) {
      let alertType: string;
      if (pct < 65) alertType = 'detained';
      else if (pct < 75) alertType = 'at_risk';
      else alertType = 'warning';

      await AttendanceAlert.create({
        collegeId,
        studentId: enrollment.studentId,
        courseOfferingId,
        semesterId,
        alertType,
        attendancePercent: pct,
        threshold: 75,
        message: `Attendance is ${pct}% which is below the 75% threshold`,
        isRead: false,
        isNotified: false,
      });
      alertCount++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'AttendanceAlert',
    entityId: courseOfferingId,
    entityName: `Attendance alerts for offering ${courseOfferingId}`,
    action: 'create',
    changes: [{ field: 'alertCount', displayName: 'Alerts Generated', oldValue: 0, newValue: alertCount }],
    performedBy,
  });

  return { alertCount, totalStudents: enrollments.length };
}

/**
 * 10. Submit condonation request
 */
export async function submitCondonationRequest(
  collegeId: string,
  data: { studentId: string; courseOfferingId: string; reason: string; supportingDocUrl?: string },
  performedBy: string,
) {
  const offering = await CourseOffering.findOne({ _id: data.courseOfferingId, collegeId }).select('semesterId').lean();
  if (!offering) throw new AppError(404, 'Course offering not found');

  const request = await CondonationRequest.create({
    collegeId,
    studentId: data.studentId,
    courseOfferingId: data.courseOfferingId,
    semesterId: offering.semesterId,
    reason: data.reason,
    description: data.reason,
    supportingDocuments: data.supportingDocUrl ? [data.supportingDocUrl] : [],
    classesRequested: 0,
    status: 'submitted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'CondonationRequest',
    entityId: String(request._id),
    entityName: `Condonation request for student ${data.studentId}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'submitted' }],
    performedBy,
  });

  return request;
}

/**
 * 11. Resolve condonation request
 */
export async function resolveCondonationRequest(
  collegeId: string,
  requestId: string,
  data: { approved: boolean; approvedBy: string; remarks?: string },
  performedBy: string,
) {
  const request = await CondonationRequest.findOne({ _id: requestId, collegeId });
  if (!request) throw new AppError(404, 'Condonation request not found');

  if (request.status !== 'submitted' && request.status !== 'under_review') {
    throw new AppError(400, 'Request has already been resolved');
  }

  const oldStatus = request.status;
  request.status = data.approved ? 'approved' : 'rejected';
  request.reviewedBy = data.approvedBy as any;
  request.reviewedAt = new Date();
  request.reviewRemarks = data.remarks ?? '';
  if (data.approved) {
    request.linkedToEligibility = true;
  }
  await request.save();

  await createAuditLog({
    collegeId,
    entityType: 'CondonationRequest',
    entityId: String(request._id),
    entityName: `Condonation request ${String(request._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: request.status }],
    performedBy,
  });

  return request;
}


// ═══════════════════════════════════════════════════════════════
// §3  CIE & Marks (5 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 12. Compute CIE for a single student in a course offering
 */
export async function computeCIE(
  collegeId: string,
  data: { courseOfferingId: string; studentId: string },
  _performedBy: string,
) {
  const assessments = await InternalAssessment.find({
    collegeId,
    courseOfferingId: data.courseOfferingId,
  }).lean();

  if (!assessments.length) {
    throw new AppError(404, 'No internal assessments found for this course offering');
  }

  const marks = await InternalMark.find({
    collegeId,
    studentId: data.studentId,
    assessmentId: { $in: assessments.map(a => a._id) },
  }).lean();

  let weightedSum = 0;
  let totalWeightage = 0;
  const breakdown: Array<{ assessmentName: string; marksObtained: number; maxMarks: number; weightage: number; scaledMarks: number }> = [];

  for (const assessment of assessments) {
    const mark = marks.find(m => String(m.assessmentId) === String(assessment._id));
    const obtained = mark ? mark.marksObtained : 0;
    const scaled = assessment.maxMarks > 0
      ? (obtained / assessment.maxMarks) * assessment.weightage
      : 0;

    weightedSum += scaled;
    totalWeightage += assessment.weightage;

    breakdown.push({
      assessmentName: assessment.name,
      marksObtained: obtained,
      maxMarks: assessment.maxMarks,
      weightage: assessment.weightage,
      scaledMarks: Math.round(scaled * 100) / 100,
    });
  }

  const cieMarks = totalWeightage > 0
    ? Math.round((weightedSum / totalWeightage) * 100 * 100) / 100
    : 0;

  return { cieMarks, breakdown };
}

/**
 * 13. Compute CIE for all enrolled students in a course offering
 */
export async function computeBatchCIE(
  collegeId: string,
  courseOfferingId: string,
  performedBy: string,
) {
  const enrollments = await Enrollment.find({
    collegeId,
    courseOfferingId,
    status: 'enrolled',
  }).select('studentId').lean();

  let computed = 0;
  for (const enrollment of enrollments) {
    try {
      await computeCIE(collegeId, { courseOfferingId, studentId: String(enrollment.studentId) }, performedBy);
      computed++;
    } catch {
      // Skip students with no marks
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'InternalMark',
    entityId: courseOfferingId,
    entityName: `Batch CIE computation for offering ${courseOfferingId}`,
    action: 'update',
    changes: [{ field: 'computed', displayName: 'Students Computed', oldValue: 0, newValue: computed }],
    performedBy,
  });

  return { computed, total: enrollments.length };
}

/**
 * 14. Bulk enter external marks
 */
export async function bulkEnterExternalMarks(
  collegeId: string,
  data: { examScheduleId: string; marks: Array<{ studentId: string; marksObtained: number }> },
  performedBy: string,
) {
  const schedule = await ExamSchedule.findOne({ _id: data.examScheduleId, collegeId }).lean();
  if (!schedule) throw new AppError(404, 'Exam schedule not found');

  const created: string[] = [];
  for (const m of data.marks) {
    const result = m.marksObtained >= 100 * 0.4 ? 'pass' : 'fail';
    await ExternalMark.findOneAndUpdate(
      { collegeId, studentId: m.studentId, courseId: schedule.courseId, semesterId: schedule.semesterId, examType: schedule.examType },
      {
        collegeId,
        studentId: m.studentId,
        courseId: schedule.courseId,
        semesterId: schedule.semesterId,
        examType: schedule.examType,
        maxMarks: 100,
        marksObtained: m.marksObtained,
        result,
        enteredBy: performedBy,
      },
      { upsert: true, new: true },
    );
    created.push(m.studentId);
  }

  await createAuditLog({
    collegeId,
    entityType: 'ExternalMark',
    entityId: data.examScheduleId,
    entityName: `Bulk external marks entry for exam ${data.examScheduleId}`,
    action: 'create',
    changes: [{ field: 'count', displayName: 'Marks Entered', oldValue: 0, newValue: created.length }],
    performedBy,
  });

  return { entered: created.length };
}

/**
 * 15. Validate external marks for an exam schedule
 */
export async function validateExternalMarks(
  collegeId: string,
  examScheduleId: string,
  data: { validatedBy: string },
  performedBy: string,
) {
  const schedule = await ExamSchedule.findOne({ _id: examScheduleId, collegeId }).lean();
  if (!schedule) throw new AppError(404, 'Exam schedule not found');

  const result = await ExternalMark.updateMany(
    {
      collegeId,
      courseId: schedule.courseId,
      semesterId: schedule.semesterId,
      examType: schedule.examType,
      validatedBy: { $exists: false },
    },
    {
      validatedBy: data.validatedBy,
      validatedAt: new Date(),
    },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ExternalMark',
    entityId: examScheduleId,
    entityName: `External marks validation for exam ${examScheduleId}`,
    action: 'update',
    changes: [{ field: 'validated', displayName: 'Marks Validated', oldValue: 0, newValue: result.modifiedCount }],
    performedBy,
  });

  return { validated: result.modifiedCount };
}

/**
 * 16. Compute grade from CIE + external marks (pure helper, not async)
 */
export function computeGrade(
  cieMarks: number,
  externalMarks: number,
  _totalMarks: number,
): { totalMarks: number; grade: string; gradePoints: number } {
  // Internal = 40%, External = 60%
  const total = Math.round((cieMarks * 0.4 + externalMarks * 0.6) * 100) / 100;

  let grade: string;
  let gradePoints: number;

  if (total >= 90) { grade = 'S'; gradePoints = 10; }
  else if (total >= 80) { grade = 'A'; gradePoints = 9; }
  else if (total >= 70) { grade = 'B'; gradePoints = 8; }
  else if (total >= 60) { grade = 'C'; gradePoints = 7; }
  else if (total >= 50) { grade = 'D'; gradePoints = 6; }
  else if (total >= 40) { grade = 'E'; gradePoints = 5; }
  else { grade = 'F'; gradePoints = 0; }

  return { totalMarks: total, grade, gradePoints };
}


// ═══════════════════════════════════════════════════════════════
// §4  Results & Promotion (6 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 17. Compute semester results for all students in a programme+semester
 */
export async function computeSemesterResults(
  collegeId: string,
  data: { semesterId: string; programmeId: string },
  performedBy: string,
) {
  // Get all enrollments for this semester
  const enrollments = await Enrollment.find({
    collegeId,
    semesterId: data.semesterId,
    status: { $in: ['enrolled', 'completed'] },
  }).lean();

  // Group enrollments by student
  const studentCourseMap = new Map<string, Array<{ courseOfferingId: string }>>();
  for (const e of enrollments) {
    const sid = String(e.studentId);
    if (!studentCourseMap.has(sid)) studentCourseMap.set(sid, []);
    studentCourseMap.get(sid)!.push({ courseOfferingId: String(e.courseOfferingId) });
  }

  // Filter to students in the given programme
  const programmeStudents = await Student.find({
    collegeId,
    programmeId: data.programmeId,
    status: 'active',
  }).select('_id').lean();

  const programmeStudentIds = new Set(programmeStudents.map(s => String(s._id)));

  let computed = 0;
  let total = 0;

  for (const [studentId, courses] of studentCourseMap) {
    if (!programmeStudentIds.has(studentId)) continue;
    total++;

    // Get course offerings with their courses to find credits
    const offeringIds = courses.map(c => c.courseOfferingId);
    const courseOfferings = await CourseOffering.find({
      _id: { $in: offeringIds },
      collegeId,
    }).lean();

    const courseIds = courseOfferings.map(co => co.courseId);
    const courseDocs = await Course.find({
      _id: { $in: courseIds },
      collegeId,
    }).lean();

    const creditMap = new Map<string, number>();
    for (const c of courseDocs) {
      creditMap.set(String(c._id), c.credits);
    }

    let totalCreditsRegistered = 0;
    let totalCreditsEarned = 0;
    let sumWeightedGP = 0;
    let backlogCount = 0;

    for (const co of courseOfferings) {
      const courseId = String(co.courseId);
      const credits = creditMap.get(courseId) ?? 0;
      totalCreditsRegistered += credits;

      // Get external mark
      const extMark = await ExternalMark.findOne({
        collegeId,
        studentId,
        courseId: co.courseId,
        semesterId: data.semesterId,
      }).lean();

      // Compute CIE
      let cieScore = 0;
      try {
        const cieResult = await computeCIE(collegeId, { courseOfferingId: String(co._id), studentId }, performedBy);
        cieScore = cieResult.cieMarks;
      } catch {
        // No internal marks available
      }

      const extScore = extMark ? extMark.marksObtained : 0;
      const gradeResult = computeGrade(cieScore, extScore, 100);

      // Create/update GradeCard
      await GradeCard.findOneAndUpdate(
        { collegeId, studentId, semesterId: data.semesterId, courseId: co.courseId },
        {
          collegeId,
          studentId,
          semesterId: data.semesterId,
          courseId: co.courseId,
          internalMarks: Math.round(cieScore * 0.4 * 100) / 100,
          externalMarks: Math.round(extScore * 0.6 * 100) / 100,
          totalMarks: gradeResult.totalMarks,
          grade: gradeResult.grade,
          gradePoints: gradeResult.gradePoints,
          credits,
          result: gradeResult.grade === 'F' ? 'fail' : 'pass',
        },
        { upsert: true, new: true },
      );

      if (gradeResult.grade === 'F') {
        backlogCount++;
      } else {
        totalCreditsEarned += credits;
      }
      sumWeightedGP += credits * gradeResult.gradePoints;
    }

    const sgpa = totalCreditsRegistered > 0
      ? Math.round((sumWeightedGP / totalCreditsRegistered) * 100) / 100
      : 0;

    const resultStatus = backlogCount > 0 ? 'fail' : 'pass';

    await SemesterResult.findOneAndUpdate(
      { collegeId, studentId, semesterId: data.semesterId },
      {
        collegeId,
        studentId,
        semesterId: data.semesterId,
        sgpa,
        cgpa: sgpa, // CGPA requires aggregation across semesters; set to SGPA initially
        totalCreditsEarned,
        totalCreditsRegistered,
        backlogs: backlogCount,
        result: resultStatus,
        status: 'computed',
      },
      { upsert: true, new: true },
    );

    computed++;
  }

  await createAuditLog({
    collegeId,
    entityType: 'SemesterResult',
    entityId: data.semesterId,
    entityName: `Semester results computation`,
    action: 'create',
    changes: [{ field: 'computed', displayName: 'Results Computed', oldValue: 0, newValue: computed }],
    performedBy,
  });

  return { computed, total };
}

/**
 * 18. Publish results
 */
export async function publishResults(
  collegeId: string,
  data: { semesterId: string; programmeId: string; publishedBy: string },
  performedBy: string,
) {
  // Verify all results are computed
  const pending = await SemesterResult.countDocuments({
    collegeId,
    semesterId: data.semesterId,
    status: { $in: ['draft'] },
  });

  if (pending > 0) {
    throw new AppError(400, `${pending} results are still in draft state. Compute all results before publishing.`);
  }

  const result = await SemesterResult.updateMany(
    { collegeId, semesterId: data.semesterId, status: 'computed' },
    { status: 'published', publishedAt: new Date() },
  );

  await createAuditLog({
    collegeId,
    entityType: 'SemesterResult',
    entityId: data.semesterId,
    entityName: `Results publication for semester ${data.semesterId}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'computed', newValue: 'published' }],
    performedBy,
  });

  return { published: result.modifiedCount };
}

/**
 * 19. Promote students based on semester results
 */
export async function promoteStudents(
  collegeId: string,
  data: { semesterId: string; programmeId: string },
  performedBy: string,
) {
  const results = await SemesterResult.find({
    collegeId,
    semesterId: data.semesterId,
    status: { $in: ['computed', 'published'] },
  }).lean();

  // Filter by programme
  const programmeStudents = await Student.find({
    collegeId,
    programmeId: data.programmeId,
    status: 'active',
  }).select('_id').lean();
  const programmeStudentIds = new Set(programmeStudents.map(s => String(s._id)));

  let promoted = 0;
  let detained = 0;
  let yearBack = 0;

  for (const r of results) {
    if (!programmeStudentIds.has(String(r.studentId))) continue;

    let decision: string;
    let reason: string;

    if (r.backlogs === 0 && r.sgpa >= 5.0) {
      decision = 'promoted';
      reason = 'All courses cleared with SGPA >= 5.0';
      promoted++;
    } else if (r.backlogs > 0 && r.backlogs <= 4) {
      decision = 'detained';
      reason = `${r.backlogs} backlog(s) pending`;
      detained++;
    } else {
      decision = 'year_back';
      reason = r.sgpa < 5.0 ? `SGPA ${r.sgpa} below minimum 5.0` : `${r.backlogs} backlogs exceed limit`;
      yearBack++;
    }

    await PromotionDecision.findOneAndUpdate(
      { collegeId, studentId: r.studentId, academicYearId: data.semesterId },
      {
        collegeId,
        studentId: r.studentId,
        academicYearId: data.semesterId,
        fromYear: 1,
        decision,
        reason,
        totalBacklogs: r.backlogs,
      },
      { upsert: true, new: true },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'PromotionDecision',
    entityId: data.semesterId,
    entityName: `Student promotions for semester ${data.semesterId}`,
    action: 'create',
    changes: [{ field: 'promotions', displayName: 'Promotions', oldValue: null, newValue: { promoted, detained, yearBack } }],
    performedBy,
  });

  return { promoted, detained, yearBack };
}

/**
 * 20. Register a backlog
 */
export async function registerBacklog(
  collegeId: string,
  data: { studentId: string; courseOfferingId: string; semesterId: string; examType?: string },
  performedBy: string,
) {
  const offering = await CourseOffering.findOne({ _id: data.courseOfferingId, collegeId }).lean();
  if (!offering) throw new AppError(404, 'Course offering not found');

  const backlog = await Backlog.create({
    collegeId,
    studentId: data.studentId,
    courseId: offering.courseId,
    semesterId: data.semesterId,
    originalExamType: data.examType ?? 'regular',
    attempts: 1,
    currentStatus: 'registered_for_supplementary',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Backlog',
    entityId: String(backlog._id),
    entityName: `Backlog registration for student ${data.studentId}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'registered_for_supplementary' }],
    performedBy,
  });

  return backlog;
}

/**
 * 21. Clear a backlog
 */
export async function clearBacklog(
  collegeId: string,
  backlogId: string,
  data: { grade: string; gradePoints: number },
  performedBy: string,
) {
  const backlog = await Backlog.findOne({ _id: backlogId, collegeId });
  if (!backlog) throw new AppError(404, 'Backlog not found');

  const oldStatus = backlog.currentStatus;
  backlog.currentStatus = 'cleared';
  backlog.clearedGrade = data.grade;
  backlog.clearedAt = new Date();
  await backlog.save();

  // Check if all backlogs for this student+semester are cleared
  const remainingBacklogs = await Backlog.countDocuments({
    collegeId,
    studentId: backlog.studentId,
    semesterId: backlog.semesterId,
    currentStatus: { $ne: 'cleared' },
  });

  // If all cleared, recompute CGPA (update SemesterResult)
  if (remainingBacklogs === 0) {
    const semResult = await SemesterResult.findOne({
      collegeId,
      studentId: backlog.studentId,
      semesterId: backlog.semesterId,
    });
    if (semResult) {
      // Update the grade card for the cleared course
      await GradeCard.findOneAndUpdate(
        { collegeId, studentId: backlog.studentId, semesterId: backlog.semesterId, courseId: backlog.courseId },
        { grade: data.grade, gradePoints: data.gradePoints, result: 'pass' },
      );

      // Recompute SGPA from all grade cards
      const gradeCards = await GradeCard.find({
        collegeId,
        studentId: backlog.studentId,
        semesterId: backlog.semesterId,
      }).lean();

      let sumWGP = 0;
      let sumCredits = 0;
      for (const gc of gradeCards) {
        sumWGP += gc.credits * gc.gradePoints;
        sumCredits += gc.credits;
      }
      const newSgpa = sumCredits > 0 ? Math.round((sumWGP / sumCredits) * 100) / 100 : 0;
      semResult.sgpa = newSgpa;
      semResult.backlogs = 0;
      semResult.result = 'pass';
      await semResult.save();
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'Backlog',
    entityId: String(backlog._id),
    entityName: `Backlog clearance ${String(backlog._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cleared' }],
    performedBy,
  });

  return backlog;
}

/**
 * 22. Submit revaluation request
 */
export async function submitRevaluationRequest(
  collegeId: string,
  data: { studentId: string; examScheduleId: string; courseOfferingId: string; reason: string },
  performedBy: string,
) {
  const schedule = await ExamSchedule.findOne({ _id: data.examScheduleId, collegeId }).lean();
  if (!schedule) throw new AppError(404, 'Exam schedule not found');

  const extMark = await ExternalMark.findOne({
    collegeId,
    studentId: data.studentId,
    courseId: schedule.courseId,
    semesterId: schedule.semesterId,
  }).lean();

  const request = await RevaluationRequest.create({
    collegeId,
    studentId: data.studentId,
    courseId: schedule.courseId,
    semesterId: schedule.semesterId,
    examType: schedule.examType,
    originalMarks: extMark ? extMark.marksObtained : 0,
    reason: data.reason,
    status: 'submitted',
    feePaid: false,
    submittedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'RevaluationRequest',
    entityId: String(request._id),
    entityName: `Revaluation request for student ${data.studentId}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'submitted' }],
    performedBy,
  });

  return request;
}


// ═══════════════════════════════════════════════════════════════
// §5  Exam Management (4 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 23. Check hall ticket eligibility
 */
export async function checkHallTicketEligibility(
  collegeId: string,
  studentId: string,
  semesterId: string,
) {
  const reasons: string[] = [];

  // Check attendance for all enrolled courses
  const enrollments = await Enrollment.find({
    collegeId,
    studentId,
    semesterId,
    status: 'enrolled',
  }).lean();

  for (const enrollment of enrollments) {
    const summary = await AttendanceSummary.findOne({
      collegeId,
      studentId,
      courseOfferingId: enrollment.courseOfferingId,
    }).lean();

    if (summary && summary.percentage < 75) {
      // Check for approved condonation
      const condonation = await CondonationRequest.findOne({
        collegeId,
        studentId,
        courseOfferingId: enrollment.courseOfferingId,
        status: 'approved',
      }).lean();

      if (!condonation) {
        reasons.push(`Attendance below 75% (${summary.percentage}%) in course offering ${String(enrollment.courseOfferingId)}`);
      }
    }
  }

  // Check financial holds
  const financialHold = await FinancialHold.findOne({
    collegeId,
    studentId,
    holdStatus: 'active',
    holdType: { $in: ['exam_debarment', 'full_clearance_block'] },
  }).lean();

  if (financialHold) {
    reasons.push('Active financial hold prevents exam eligibility');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * 24. Generate hall tickets for eligible students
 */
export async function generateHallTickets(
  collegeId: string,
  data: { semesterId: string; programmeId: string },
  performedBy: string,
) {
  const students = await Student.find({
    collegeId,
    programmeId: data.programmeId,
    status: 'active',
  }).select('_id rollNumber').lean();

  let generated = 0;
  let ineligible = 0;

  for (const student of students) {
    const eligibility = await checkHallTicketEligibility(collegeId, String(student._id), data.semesterId);

    if (eligibility.eligible) {
      // Get exam schedules for student's courses
      const enrollments = await Enrollment.find({
        collegeId,
        studentId: student._id,
        semesterId: data.semesterId,
        status: 'enrolled',
      }).lean();

      const offeringIds = enrollments.map(e => e.courseOfferingId);
      const offerings = await CourseOffering.find({
        _id: { $in: offeringIds },
        collegeId,
      }).lean();

      const courseIds = offerings.map(o => o.courseId);
      const schedules = await ExamSchedule.find({
        collegeId,
        semesterId: data.semesterId,
        courseId: { $in: courseIds },
      }).lean();

      const courses = schedules.map(s => ({
        courseId: s.courseId,
        examDate: s.date,
        venue: s.venue,
      }));

      const htNumber = `HT-${data.semesterId.slice(-4)}-${(student.rollNumber ?? String(student._id).slice(-6)).toUpperCase()}`;

      await HallTicket.findOneAndUpdate(
        { collegeId, studentId: student._id, semesterId: data.semesterId },
        {
          collegeId,
          studentId: student._id,
          semesterId: data.semesterId,
          hallTicketNumber: htNumber,
          examType: 'regular',
          courses,
          eligibilityStatus: 'eligible',
          issuedAt: new Date(),
          status: 'issued',
        },
        { upsert: true, new: true },
      );
      generated++;
    } else {
      ineligible++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'HallTicket',
    entityId: data.semesterId,
    entityName: `Hall ticket generation for semester ${data.semesterId}`,
    action: 'create',
    changes: [{ field: 'generated', displayName: 'Hall Tickets', oldValue: 0, newValue: generated }],
    performedBy,
  });

  return { generated, ineligible };
}

/**
 * 25. Generate seating plan — AI placeholder
 */
export async function generateSeatingPlan(
  collegeId: string,
  examScheduleId: string,
  data: { venues: string[]; studentsPerRoom?: number },
  performedBy: string,
) {
  const schedule = await ExamSchedule.findOne({ _id: examScheduleId, collegeId }).lean();
  if (!schedule) throw new AppError(404, 'Exam schedule not found');

  const studentsPerRoom = data.studentsPerRoom ?? 30;

  // Get registered students
  const registrations = await ExamRegistration.find({
    collegeId,
    semesterId: schedule.semesterId,
    status: { $in: ['registered', 'approved'] },
  }).select('studentId _id').lean();

  let studentIndex = 0;
  for (const venue of data.venues) {
    const assignments: Array<{ seatNumber: string; studentId: any; examRegistrationId: any }> = [];
    for (let seat = 1; seat <= studentsPerRoom && studentIndex < registrations.length; seat++) {
      const reg = registrations[studentIndex]!;
      assignments.push({
        seatNumber: `${venue}-${String(seat).padStart(3, '0')}`,
        studentId: reg.studentId,
        examRegistrationId: reg._id,
      });
      studentIndex++;
    }

    if (assignments.length > 0) {
      await SeatingPlan.create({
        collegeId,
        examScheduleId,
        roomName: venue,
        capacity: studentsPerRoom,
        assignments,
        status: 'draft',
        generatedBy: performedBy,
      });
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'SeatingPlan',
    entityId: examScheduleId,
    entityName: `Seating plan for exam ${examScheduleId}`,
    action: 'create',
    changes: [{ field: 'venues', displayName: 'Venues', oldValue: null, newValue: data.venues }],
    performedBy,
  });

  return { seatedStudents: studentIndex, totalVenues: data.venues.length };
}

/**
 * 26. Assign invigilation duty
 */
export async function assignInvigilationDuty(
  collegeId: string,
  examScheduleId: string,
  data: { facultyIds: string[] },
  performedBy: string,
) {
  const schedule = await ExamSchedule.findOne({ _id: examScheduleId, collegeId }).lean();
  if (!schedule) throw new AppError(404, 'Exam schedule not found');

  // Get seating plans to know the rooms
  const seatingPlans = await SeatingPlan.find({ collegeId, examScheduleId }).lean();
  const rooms = seatingPlans.map(sp => sp.roomName);

  const duties: Array<{ facultyId: any; roomName: string; role: string }> = [];
  for (let i = 0; i < data.facultyIds.length; i++) {
    const room = rooms[i % rooms.length] ?? `Room-${i + 1}`;
    duties.push({
      facultyId: data.facultyIds[i] as any,
      roomName: room,
      role: i === 0 ? 'chief' : 'assistant',
    });
  }

  const roster = await InvigilationRoster.create({
    collegeId,
    examScheduleId,
    duties,
    status: 'draft',
    generatedBy: performedBy,
  });

  await createAuditLog({
    collegeId,
    entityType: 'InvigilationRoster',
    entityId: String(roster._id),
    entityName: `Invigilation roster for exam ${examScheduleId}`,
    action: 'create',
    changes: [{ field: 'duties', displayName: 'Duties Assigned', oldValue: 0, newValue: duties.length }],
    performedBy,
  });

  return roster;
}


// ═══════════════════════════════════════════════════════════════
// §6  OBE — Outcome-Based Education (4 functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 27. Compute CO attainment for a course offering
 */
export async function computeCOAttainment(
  collegeId: string,
  data: { courseOfferingId: string; semesterId: string; threshold?: number },
  performedBy: string,
) {
  const threshold = data.threshold ?? 50;

  const offering = await CourseOffering.findOne({ _id: data.courseOfferingId, collegeId }).lean();
  if (!offering) throw new AppError(404, 'Course offering not found');

  // Get COs mapped to this course
  const cos = await CourseOutcome.find({ collegeId, courseId: offering.courseId }).lean();
  if (!cos.length) throw new AppError(404, 'No course outcomes found for this course');

  // Get enrolled students
  const enrollments = await Enrollment.find({
    collegeId,
    courseOfferingId: data.courseOfferingId,
    status: { $in: ['enrolled', 'completed'] },
  }).lean();
  const totalStudents = enrollments.length;

  if (totalStudents === 0) throw new AppError(400, 'No students enrolled in this course offering');

  // Get assessments with CO mappings
  const assessments = await InternalAssessment.find({
    collegeId,
    courseOfferingId: data.courseOfferingId,
  }).lean();

  const results: Array<{ coCode: string; attainment: number }> = [];

  for (const co of cos) {
    // Find assessments that map to this CO
    const relevantAssessments = assessments.filter(a =>
      a.coMappings?.some(m => m.coCode === co.code),
    );

    if (relevantAssessments.length === 0) {
      await COAttainmentRecord.findOneAndUpdate(
        { collegeId, courseOfferingId: data.courseOfferingId, coCode: co.code },
        {
          collegeId,
          courseOfferingId: data.courseOfferingId,
          semesterId: data.semesterId,
          coCode: co.code,
          directAttainment: 0,
          indirectAttainment: 0,
          overallAttainment: 0,
          attainmentLevel: 0,
          threshold,
          studentsAboveThreshold: 0,
          totalStudents,
        },
        { upsert: true, new: true },
      );
      results.push({ coCode: co.code, attainment: 0 });
      continue;
    }

    // Count students scoring above threshold in relevant assessments
    let studentsAbove = 0;
    for (const enrollment of enrollments) {
      const studentMarks = await InternalMark.find({
        collegeId,
        studentId: enrollment.studentId,
        assessmentId: { $in: relevantAssessments.map(a => a._id) },
      }).lean();

      const avgPercent = relevantAssessments.length > 0
        ? studentMarks.reduce((sum, m) => {
            const assess = relevantAssessments.find(a => String(a._id) === String(m.assessmentId));
            return sum + (assess && assess.maxMarks > 0 ? (m.marksObtained / assess.maxMarks) * 100 : 0);
          }, 0) / relevantAssessments.length
        : 0;

      if (avgPercent >= threshold) studentsAbove++;
    }

    const directAttainment = Math.round((studentsAbove / totalStudents) * 100 * 100) / 100;
    const attainmentLevel = directAttainment >= 70 ? 3 : directAttainment >= 50 ? 2 : directAttainment >= 30 ? 1 : 0;

    await COAttainmentRecord.findOneAndUpdate(
      { collegeId, courseOfferingId: data.courseOfferingId, coCode: co.code },
      {
        collegeId,
        courseOfferingId: data.courseOfferingId,
        semesterId: data.semesterId,
        coCode: co.code,
        directAttainment,
        indirectAttainment: 0, // Indirect requires survey data
        overallAttainment: directAttainment, // Direct only for now
        attainmentLevel,
        threshold,
        studentsAboveThreshold: studentsAbove,
        totalStudents,
      },
      { upsert: true, new: true },
    );

    results.push({ coCode: co.code, attainment: directAttainment });
  }

  await createAuditLog({
    collegeId,
    entityType: 'COAttainmentRecord',
    entityId: data.courseOfferingId,
    entityName: `CO attainment for offering ${data.courseOfferingId}`,
    action: 'create',
    changes: [{ field: 'cos', displayName: 'COs Computed', oldValue: 0, newValue: results.length }],
    performedBy,
  });

  return { coAttainments: results, totalCOs: cos.length };
}

/**
 * 28. Aggregate PO attainment from COs
 */
export async function aggregatePOAttainment(
  collegeId: string,
  data: { programmeId: string; semesterId: string },
  performedBy: string,
) {
  // Get all CO attainment records for the semester
  const coRecords = await COAttainmentRecord.find({
    collegeId,
    semesterId: data.semesterId,
  }).lean();

  if (!coRecords.length) throw new AppError(404, 'No CO attainment records found for this semester');

  // Get all course outcomes with PO mappings for courses in the programme
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId: data.semesterId,
  }).lean();

  const courseIds = offerings.map(o => o.courseId);
  const courseOutcomes = await CourseOutcome.find({
    collegeId,
    courseId: { $in: courseIds },
  }).lean();

  // Build PO -> CO contributions map
  const poContributions = new Map<string, Array<{ coCode: string; courseOfferingId: string; coAttainment: number; mappingLevel: number }>>();

  for (const co of courseOutcomes) {
    const coRecord = coRecords.find(r => r.coCode === co.code);
    if (!coRecord) continue;

    for (const poMapping of (co.poMappings ?? [])) {
      if (!poContributions.has(poMapping.poCode)) {
        poContributions.set(poMapping.poCode, []);
      }
      poContributions.get(poMapping.poCode)!.push({
        coCode: co.code,
        courseOfferingId: String(coRecord.courseOfferingId),
        coAttainment: coRecord.overallAttainment,
        mappingLevel: poMapping.level,
      });
    }
  }

  const results: Array<{ poCode: string; attainment: number }> = [];

  for (const [poCode, contributions] of poContributions) {
    // Weighted average: sum(attainment * mappingLevel) / sum(mappingLevel)
    let weightedSum = 0;
    let totalWeight = 0;
    for (const c of contributions) {
      weightedSum += c.coAttainment * c.mappingLevel;
      totalWeight += c.mappingLevel;
    }
    const attainment = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
    const attainmentLevel = attainment >= 70 ? 3 : attainment >= 50 ? 2 : attainment >= 30 ? 1 : 0;

    await POAttainmentRecord.findOneAndUpdate(
      { collegeId, programmeId: data.programmeId, semesterId: data.semesterId, poCode },
      {
        collegeId,
        programmeId: data.programmeId,
        semesterId: data.semesterId,
        poCode,
        attainment,
        attainmentLevel,
        contributingCOs: contributions,
      },
      { upsert: true, new: true },
    );

    results.push({ poCode, attainment });
  }

  await createAuditLog({
    collegeId,
    entityType: 'POAttainmentRecord',
    entityId: data.programmeId,
    entityName: `PO attainment for programme ${data.programmeId}`,
    action: 'create',
    changes: [{ field: 'pos', displayName: 'POs Computed', oldValue: 0, newValue: results.length }],
    performedBy,
  });

  return { poAttainments: results, totalPOs: results.length };
}

/**
 * 29. Compute programme health metrics
 */
export async function computeProgrammeHealth(
  collegeId: string,
  data: { programmeId: string; semesterId: string },
  performedBy: string,
) {
  // Pass rate
  const totalResults = await SemesterResult.countDocuments({
    collegeId,
    semesterId: data.semesterId,
  });
  const passResults = await SemesterResult.countDocuments({
    collegeId,
    semesterId: data.semesterId,
    result: 'pass',
  });
  const passRate = totalResults > 0 ? Math.round((passResults / totalResults) * 100 * 100) / 100 : 0;

  // Avg SGPA
  const sgpaAgg = await SemesterResult.aggregate([
    { $match: { collegeId: { $exists: true }, semesterId: data.semesterId } },
    { $group: { _id: null, avgSgpa: { $avg: '$sgpa' } } },
  ]);
  const avgSGPA = sgpaAgg.length > 0 ? Math.round((sgpaAgg[0]?.avgSgpa ?? 0) * 100) / 100 : 0;

  // CO attainment avg
  const coAgg = await COAttainmentRecord.aggregate([
    { $match: { collegeId: { $exists: true }, semesterId: data.semesterId } },
    { $group: { _id: null, avg: { $avg: '$overallAttainment' } } },
  ]);
  const coAttainmentAvg = coAgg.length > 0 ? Math.round((coAgg[0]?.avg ?? 0) * 100) / 100 : 0;

  // PO attainment avg
  const poAgg = await POAttainmentRecord.aggregate([
    { $match: { collegeId: { $exists: true }, programmeId: data.programmeId, semesterId: data.semesterId } },
    { $group: { _id: null, avg: { $avg: '$attainment' } } },
  ]);
  const poAttainmentAvg = poAgg.length > 0 ? Math.round((poAgg[0]?.avg ?? 0) * 100) / 100 : 0;

  // Backlog rate
  const backlogStudents = await SemesterResult.countDocuments({
    collegeId,
    semesterId: data.semesterId,
    backlogs: { $gt: 0 },
  });
  const backlogRatio = totalResults > 0 ? Math.round((backlogStudents / totalResults) * 100 * 100) / 100 : 0;

  // Attendance avg
  const attendanceAgg = await AttendanceSummary.aggregate([
    { $match: { collegeId: { $exists: true }, semesterId: data.semesterId } },
    { $group: { _id: null, avg: { $avg: '$percentage' } } },
  ]);
  const attendanceAvg = attendanceAgg.length > 0 ? Math.round((attendanceAgg[0]?.avg ?? 0) * 100) / 100 : 0;

  const metrics = await ProgrammeHealthMetrics.findOneAndUpdate(
    { collegeId, programmeId: data.programmeId, semesterId: data.semesterId },
    {
      collegeId,
      programmeId: data.programmeId,
      semesterId: data.semesterId,
      passRate,
      avgCGPA: avgSGPA,
      backlogRatio,
      attendanceAvg,
      coAttainmentAvg,
      poAttainmentAvg,
      syllabusCompletion: 0, // Requires LessonPlan data per programme
      feedbackAvg: 0, // Requires CourseFeedback aggregation
    },
    { upsert: true, new: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ProgrammeHealthMetrics',
    entityId: data.programmeId,
    entityName: `Programme health for ${data.programmeId}`,
    action: 'update',
    changes: [{ field: 'metrics', displayName: 'Health Metrics', oldValue: null, newValue: { passRate, avgSGPA, backlogRatio } }],
    performedBy,
  });

  return metrics;
}

/**
 * 30. Create attainment run record
 */
export async function createAttainmentRun(
  collegeId: string,
  data: { semesterId: string; programmeId: string; runType: string },
  performedBy: string,
) {
  const run = await AttainmentRun.create({
    collegeId,
    semesterId: data.semesterId,
    runType: data.runType,
    status: 'running',
    triggeredBy: performedBy,
    startedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'AttainmentRun',
    entityId: String(run._id),
    entityName: `Attainment run (${data.runType}) for semester ${data.semesterId}`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'running' }],
    performedBy,
  });

  return run;
}


// ═══════════════════════════════════════════════════════════════
// §7  Cross-module reads (5 helper functions)
// ═══════════════════════════════════════════════════════════════

/**
 * 31. Get student attendance report for all courses in a semester
 */
export async function getStudentAttendanceReport(
  collegeId: string,
  studentId: string,
  semesterId: string,
) {
  const summaries = await AttendanceSummary.find({
    collegeId,
    studentId,
    semesterId,
  }).populate('courseOfferingId').lean();

  return summaries;
}

/**
 * 32. Get student academic summary — all semester results + CGPA
 */
export async function getStudentAcademicSummary(
  collegeId: string,
  studentId: string,
) {
  const semesterResults = await SemesterResult.find({
    collegeId,
    studentId,
  }).sort({ createdAt: 1 }).lean();

  let totalCredits = 0;
  let totalWeightedGP = 0;
  const backlogs = await Backlog.countDocuments({
    collegeId,
    studentId,
    currentStatus: { $ne: 'cleared' },
  });

  for (const r of semesterResults) {
    totalCredits += r.totalCreditsEarned;
    totalWeightedGP += r.sgpa * r.totalCreditsRegistered;
  }

  const totalRegistered = semesterResults.reduce((s, r) => s + r.totalCreditsRegistered, 0);
  const cgpa = totalRegistered > 0
    ? Math.round((totalWeightedGP / totalRegistered) * 100) / 100
    : 0;

  return {
    semesterResults,
    cgpa,
    totalCredits,
    backlogs,
  };
}

/**
 * 33. Get course delivery progress (lesson plan completion)
 */
export async function getCourseDeliveryProgress(
  collegeId: string,
  courseOfferingId: string,
) {
  const total = await LessonPlan.countDocuments({ collegeId, courseOfferingId });
  const completed = await LessonPlan.countDocuments({ collegeId, courseOfferingId, status: 'completed' });
  const percentage = total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;

  return { total, completed, percentage };
}

/**
 * 34. Get exam calendar for a semester
 */
export async function getExamCalendar(
  collegeId: string,
  semesterId: string,
) {
  const schedules = await ExamSchedule.find({
    collegeId,
    semesterId,
  }).sort({ date: 1 }).populate('courseId').lean();

  return schedules;
}

/**
 * 35. Get semester enrollment count
 */
export async function getSemesterEnrollmentCount(
  collegeId: string,
  semesterId: string,
  programmeId?: string,
) {
  if (programmeId) {
    // Find students in the programme first
    const students = await Student.find({
      collegeId,
      programmeId,
      status: 'active',
    }).select('_id').lean();

    const studentIds = students.map(s => s._id);

    return Enrollment.countDocuments({
      collegeId,
      semesterId,
      studentId: { $in: studentIds },
      status: 'enrolled',
    });
  }

  return Enrollment.countDocuments({
    collegeId,
    semesterId,
    status: 'enrolled',
  });
}
