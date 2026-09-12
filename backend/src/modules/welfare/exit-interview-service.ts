import { ExitInterview } from '../../models/welfare/ExitInterview';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
// ===========================================================================
// W10-L2-007: List Exit Interviews
// ===========================================================================

export async function listExitInterviews(
  collegeId: string,
  page = 1,
  limit = 20,
  studentId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (studentId) filter.studentId = studentId;
  return paginate(ExitInterview, filter, page, limit, { interviewDate: -1 }, ['studentId', 'interviewerId']);
}

// ===========================================================================
// W10-L2-008: Get Exit Interview
// ===========================================================================

export async function getExitInterview(collegeId: string, id: string) {
  const doc = await ExitInterview.findOne({ _id: id, collegeId })
    .populate('studentId')
    .populate('interviewerId');
  if (!doc) throw new AppError(404, 'Exit interview not found');
  return doc;
}

// ===========================================================================
// W10-L2-009: Record Exit Interview
// ===========================================================================

export async function recordExitInterview(
  collegeId: string,
  data: {
    studentId: string;
    exitRequestId?: string;
    interviewerId: string;
    interviewDate: Date;
    primaryReason: string;
    secondaryReasons?: string[];
    institutionalFeedback?: {
      teachingQuality: number;
      infrastructure: number;
      support: number;
      overallSatisfaction: number;
      suggestions?: string;
    };
    followUpRequired?: boolean;
    followUpNotes?: string;
  },
  performedBy: string,
) {
  const doc = await ExitInterview.create({
    collegeId,
    studentId: data.studentId,
    exitRequestId: data.exitRequestId,
    interviewerId: data.interviewerId,
    interviewDate: data.interviewDate,
    primaryReason: data.primaryReason,
    secondaryReasons: data.secondaryReasons ?? [],
    institutionalFeedback: data.institutionalFeedback,
    followUpRequired: data.followUpRequired ?? false,
    followUpNotes: data.followUpNotes,
    status: 'completed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'ExitInterview',
    entityId: String(doc._id),
    entityName: `Exit Interview: ${data.primaryReason}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'completed' },
      { field: 'primaryReason', displayName: 'Primary Reason', oldValue: null, newValue: data.primaryReason },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W10-L2-010: Schedule Exit Interview
// ===========================================================================

export async function scheduleExitInterview(
  collegeId: string,
  data: {
    studentId: string;
    exitRequestId?: string;
    interviewerId: string;
    interviewDate: Date;
  },
  performedBy: string,
) {
  const doc = await ExitInterview.create({
    collegeId,
    studentId: data.studentId,
    exitRequestId: data.exitRequestId,
    interviewerId: data.interviewerId,
    interviewDate: data.interviewDate,
    status: 'scheduled',
  });

  await createAuditLog({
    collegeId,
    entityType: 'ExitInterview',
    entityId: String(doc._id),
    entityName: 'Exit Interview (scheduled)',
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'scheduled' },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W10-L2-011: Decline Exit Interview
// ===========================================================================

export async function declineExitInterview(
  collegeId: string,
  interviewId: string,
  performedBy: string,
) {
  const doc = await ExitInterview.findOne({ _id: interviewId, collegeId });
  if (!doc) throw new AppError(404, 'Exit interview not found');

  const oldStatus = doc.status;
  doc.status = 'student_declined';

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ExitInterview',
    entityId: String(doc._id),
    entityName: `Exit Interview: ${doc.primaryReason ?? 'scheduled'}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'student_declined' },
    ],
    performedBy,
  });

  return doc;
}
