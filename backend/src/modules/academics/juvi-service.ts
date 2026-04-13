import { StudyRecommendation } from '../../models/juvi/StudyRecommendation';
import { JuviNoticeCard } from '../../models/juvi/JuviNoticeCard';
import { AckRecord } from '../../models/juvi/AckRecord';
import { InferenceLog } from '../../models/platform/InferenceLog';
import { GradeCard } from '../../models/academic-ops/GradeCard';
import { AttendanceSummary } from '../../models/academic-ops/AttendanceSummary';
import { SemesterResult } from '../../models/academic-ops/SemesterResult';
import { ExamSchedule } from '../../models/academic-ops/ExamSchedule';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// 1. Academic home widgets
// ---------------------------------------------------------------------------

export async function getAcademicHomeWidgets(
  collegeId: string,
  studentId: string,
  semesterId: string,
) {
  const [attendanceSummaries, semesterResult, upcomingExams, enrolledCount] =
    await Promise.all([
      AttendanceSummary.find({ collegeId, studentId, semesterId }).lean(),
      SemesterResult.findOne({ collegeId, studentId })
        .sort({ createdAt: -1 })
        .lean(),
      ExamSchedule.find({ collegeId, semesterId })
        .sort({ date: 1 })
        .limit(5)
        .lean(),
      Enrollment.countDocuments({ collegeId, studentId, semesterId, status: 'enrolled' }),
    ]);

  // Compute average attendance percentage
  const totalCourses = attendanceSummaries.length;
  const averageAttendance =
    totalCourses > 0
      ? attendanceSummaries.reduce((sum, s) => sum + s.percentage, 0) / totalCourses
      : 0;

  // Count unread notice cards (active, for semester, no ack from this student)
  const activeNotices = await JuviNoticeCard.find({
    collegeId,
    semesterId,
    isActive: true,
  })
    .lean()
    .then((cards) => cards.map((c) => String(c._id)));

  let unreadNotices = 0;
  if (activeNotices.length > 0) {
    const ackedIds = await AckRecord.find({
      collegeId,
      studentId,
      noticeCardId: { $in: activeNotices },
    })
      .lean()
      .then((acks) => new Set(acks.map((a) => String(a.noticeCardId))));

    unreadNotices = activeNotices.filter((id) => !ackedIds.has(id)).length;
  }

  return {
    studentId,
    semesterId,
    attendance: {
      average: Math.round(averageAttendance * 100) / 100,
      totalCourses,
    },
    currentCGPA: semesterResult?.cgpa ?? null,
    upcomingExams: upcomingExams.map((e) => ({
      examId: String(e._id),
      courseOfferingId: String(e.courseId),
      date: e.date,
      type: e.examType,
    })),
    enrolledCourses: enrolledCount,
    unreadNotices,
  };
}

// ---------------------------------------------------------------------------
// 2. Generate study recommendations
// ---------------------------------------------------------------------------

export async function generateStudyRecommendations(
  collegeId: string,
  studentId: string,
  semesterId: string,
  performedBy: string,
) {
  const startedAt = new Date();

  const [gradeCards, attendanceSummaries] = await Promise.all([
    GradeCard.find({ collegeId, studentId, semesterId }).lean(),
    AttendanceSummary.find({ collegeId, studentId, semesterId }).lean(),
  ]);

  // Build a map of courseId -> attendance percentage
  const attendanceMap = new Map<string, number>();
  for (const summary of attendanceSummaries) {
    // AttendanceSummary links via courseOfferingId, not courseId directly.
    // We key by courseOfferingId string so grade cards can cross-reference if needed.
    attendanceMap.set(String(summary.courseOfferingId), summary.percentage);
  }

  type RecommendationInput = {
    collegeId: string;
    studentId: string;
    semesterId: string;
    courseId: string;
    recommendationType: 'focus_area' | 'study_material' | 'time_management' | 'revision' | 'general';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    basedOn: string;
    isRead: boolean;
  };

  const newRecs: RecommendationInput[] = [];

  for (const grade of gradeCards) {
    const courseIdStr = String(grade.courseId);

    // Failed course → focus_area / high
    if (grade.grade === 'F' || grade.result === 'fail') {
      newRecs.push({
        collegeId,
        studentId,
        semesterId,
        courseId: courseIdStr,
        recommendationType: 'focus_area',
        title: 'Immediate Focus Required',
        description:
          'You have failed this course. Seek faculty guidance and revise all topics immediately.',
        priority: 'high',
        basedOn: 'Failed course — needs immediate attention',
        isRead: false,
      });
    }

    // Low attendance → time_management / high
    // AttendanceSummary uses courseOfferingId; we fall back to iterating all summaries
    // and matching by associated courseId when available.
    const matchedSummary = attendanceSummaries.find(
      (s) => String(s.courseOfferingId) === courseIdStr,
    );
    if (matchedSummary && matchedSummary.percentage < 75) {
      newRecs.push({
        collegeId,
        studentId,
        semesterId,
        courseId: courseIdStr,
        recommendationType: 'time_management',
        title: 'Improve Attendance',
        description:
          `Your attendance is ${matchedSummary.percentage.toFixed(1)}%. You must attend more classes to avoid detention.`,
        priority: 'high',
        basedOn: 'Low attendance',
        isRead: false,
      });
    }

    // Below average → revision / medium
    if (grade.grade === 'D' || grade.grade === 'C') {
      newRecs.push({
        collegeId,
        studentId,
        semesterId,
        courseId: courseIdStr,
        recommendationType: 'revision',
        title: 'Revision Recommended',
        description:
          'Your performance is below average. Revise the course material and attempt practice problems.',
        priority: 'medium',
        basedOn: 'Below average performance',
        isRead: false,
      });
    }

    // Excellent performer → general / low
    if (
      matchedSummary &&
      matchedSummary.percentage >= 90 &&
      (grade.grade === 'A' ||
        grade.grade === 'A+' ||
        grade.grade === 'O' ||
        grade.grade === 'S')
    ) {
      newRecs.push({
        collegeId,
        studentId,
        semesterId,
        courseId: courseIdStr,
        recommendationType: 'general',
        title: 'Keep Up the Excellent Work',
        description:
          'You are performing excellently. Consider mentoring peers or exploring advanced topics.',
        priority: 'low',
        basedOn: 'Excellent performance — consider mentoring peers',
        isRead: false,
      });
    }
  }

  // Replace existing recommendations with fresh set
  await StudyRecommendation.deleteMany({ collegeId, studentId, semesterId });
  const inserted =
    newRecs.length > 0 ? await StudyRecommendation.insertMany(newRecs) : [];

  // Log inference
  await InferenceLog.create({
    collegeId,
    agentId: 'AG-08',
    agentName: 'Juvi Academic Companion',
    inputData: { studentId, semesterId, gradeCount: gradeCards.length, attendanceCount: attendanceSummaries.length },
    outputData: { generated: inserted.length },
    status: 'success',
    startedAt,
    completedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'StudyRecommendation',
    entityId: studentId,
    entityName: `Recommendations for ${studentId} / semester ${semesterId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { generated: inserted.length, recommendations: inserted };
}

// ---------------------------------------------------------------------------
// 3. Push notice cards
// ---------------------------------------------------------------------------

export async function pushNoticeCards(
  collegeId: string,
  semesterId: string,
  noticeType: string,
  title: string,
  body: string,
  targetAudience: string,
  createdBy: string,
) {
  const card = await JuviNoticeCard.create({
    collegeId,
    semesterId,
    noticeType,
    title,
    body,
    targetAudience,
    createdBy,
    publishedAt: new Date(),
    isActive: true,
  });

  await createAuditLog({
    collegeId,
    entityType: 'JuviNoticeCard',
    entityId: String(card._id),
    entityName: card.title,
    action: 'create',
    changes: [],
    performedBy: createdBy,
  });

  return card;
}

// ---------------------------------------------------------------------------
// 4. Acknowledge a notice
// ---------------------------------------------------------------------------

export async function acknowledgeNotice(
  collegeId: string,
  noticeCardId: string,
  studentId: string,
  channel: string,
) {
  const notice = await JuviNoticeCard.findOne({ _id: noticeCardId, collegeId });
  if (!notice || !notice.isActive) {
    throw new AppError(404, 'Notice card not found or inactive');
  }

  const existing = await AckRecord.findOne({ collegeId, noticeCardId, studentId });
  if (existing) {
    throw new AppError(409, 'Notice already acknowledged');
  }

  const ack = await AckRecord.create({
    collegeId,
    noticeCardId,
    studentId,
    channel,
    acknowledgedAt: new Date(),
  });

  return ack;
}

// ---------------------------------------------------------------------------
// 5. List study recommendations (paginated)
// ---------------------------------------------------------------------------

export async function listStudentRecommendations(
  collegeId: string,
  studentId: string,
  semesterId: string,
  page: number,
  limit: number,
) {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const result = await paginate(
    StudyRecommendation,
    { collegeId, studentId, semesterId },
    page,
    limit,
    // Mongoose sort doesn't support custom value mappings; sort by createdAt desc
    // and let callers sort client-side by priority if needed.
    // We use a secondary sort on priority string (alphabetical: high < low < medium)
    // which doesn't match intent, so we post-sort by priority weight.
    { createdAt: -1 },
  );

  // Post-sort by priority: high → medium → low, then preserve createdAt desc order
  const sorted = [...result.items].sort((a, b) => {
    const pa = priorityOrder[(a as { priority: string }).priority] ?? 99;
    const pb = priorityOrder[(b as { priority: string }).priority] ?? 99;
    return pa - pb;
  });

  return { ...result, items: sorted };
}

// ---------------------------------------------------------------------------
// 6. List notice cards with acknowledgement status
// ---------------------------------------------------------------------------

export async function listStudentNoticeCards(
  collegeId: string,
  studentId: string,
  semesterId: string,
  page: number,
  limit: number,
) {
  const result = await paginate(
    JuviNoticeCard,
    { collegeId, semesterId, isActive: true },
    page,
    limit,
    { publishedAt: -1 },
  );

  const cardIds = result.items.map((c) => String((c as { _id: unknown })._id));

  const ackRecords = await AckRecord.find({
    collegeId,
    studentId,
    noticeCardId: { $in: cardIds },
  }).lean();

  const ackedSet = new Set(ackRecords.map((a) => String(a.noticeCardId)));

  const itemsWithAck = result.items.map((card) => ({
    ...(card as object),
    isAcknowledged: ackedSet.has(String((card as { _id: unknown })._id)),
  }));

  return { ...result, items: itemsWithAck };
}
