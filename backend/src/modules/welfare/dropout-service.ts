import { DropoutRiskAlert } from '../../models/welfare/DropoutRiskAlert';
import { ExitInterview } from '../../models/welfare/ExitInterview';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// W10-L2-001: List Dropout Risk Alerts
// ===========================================================================

export async function listDropoutRiskAlerts(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
  minScore?: number,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  if (minScore !== undefined) filter.riskScore = { $gte: minScore };
  return paginate(DropoutRiskAlert, filter, page, limit, { createdAt: -1 }, ['studentId', 'assignedTo', 'mentorId']);
}

// ===========================================================================
// W10-L2-002: Get Dropout Risk Alert
// ===========================================================================

export async function getDropoutRiskAlert(collegeId: string, id: string) {
  const doc = await DropoutRiskAlert.findOne({ _id: id, collegeId })
    .populate('studentId')
    .populate('assignedTo')
    .populate('mentorId');
  if (!doc) throw new AppError(404, 'Dropout risk alert not found');
  return doc;
}

// ===========================================================================
// W10-L2-003: Create Dropout Risk Alert
// ===========================================================================

export async function createDropoutRiskAlert(
  collegeId: string,
  data: {
    studentId: string;
    riskScore: number;
    signals: Array<{
      source: string;
      signalType: string;
      description: string;
      weight: number;
      dataRef?: string;
    }>;
  },
  performedBy: string,
) {
  const doc = await DropoutRiskAlert.create({
    collegeId,
    studentId: data.studentId,
    riskScore: data.riskScore,
    signals: data.signals,
    status: 'active',
    outreachAttempts: [],
  });

  await createAuditLog({
    collegeId,
    entityType: 'DropoutRiskAlert',
    entityId: String(doc._id),
    entityName: `Dropout Alert (score ${data.riskScore})`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
      { field: 'riskScore', displayName: 'Risk Score', oldValue: null, newValue: data.riskScore },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W10-L2-004: Assign Dropout Alert
// ===========================================================================

export async function assignDropoutAlert(
  collegeId: string,
  alertId: string,
  data: { assignedTo: string; mentorId?: string },
  performedBy: string,
) {
  const alert = await DropoutRiskAlert.findOne({ _id: alertId, collegeId });
  if (!alert) throw new AppError(404, 'Dropout risk alert not found');

  const oldStatus = alert.status;
  alert.assignedTo = data.assignedTo as any;
  if (data.mentorId) alert.mentorId = data.mentorId as any;
  alert.status = 'under_outreach';

  await alert.save();

  await createAuditLog({
    collegeId,
    entityType: 'DropoutRiskAlert',
    entityId: String(alert._id),
    entityName: `Dropout Alert (score ${alert.riskScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'under_outreach' },
      { field: 'assignedTo', displayName: 'Assigned To', oldValue: null, newValue: data.assignedTo },
    ],
    performedBy,
  });

  return alert;
}

// ===========================================================================
// W10-L2-005: Log Outreach Attempt
// ===========================================================================

export async function logOutreachAttempt(
  collegeId: string,
  alertId: string,
  data: { method: string; contactedBy: string; outcome: string; notes?: string },
  performedBy: string,
) {
  const alert = await DropoutRiskAlert.findOne({ _id: alertId, collegeId });
  if (!alert) throw new AppError(404, 'Dropout risk alert not found');

  alert.outreachAttempts.push({
    date: new Date(),
    method: data.method,
    contactedBy: data.contactedBy as any,
    outcome: data.outcome,
    notes: data.notes,
  });

  await alert.save();

  await createAuditLog({
    collegeId,
    entityType: 'DropoutRiskAlert',
    entityId: String(alert._id),
    entityName: `Dropout Alert (score ${alert.riskScore})`,
    action: 'update',
    changes: [
      { field: 'outreachAttempts', displayName: 'Outreach Attempt', oldValue: null, newValue: `${data.method}: ${data.outcome}` },
    ],
    performedBy,
  });

  return alert;
}

// ===========================================================================
// W10-L2-006: Resolve Dropout Alert
// ===========================================================================

export async function resolveDropoutAlert(
  collegeId: string,
  alertId: string,
  data: { resolution: string; resolvedBy: string },
  performedBy: string,
) {
  const alert = await DropoutRiskAlert.findOne({ _id: alertId, collegeId });
  if (!alert) throw new AppError(404, 'Dropout risk alert not found');

  if (alert.status !== 'active' && alert.status !== 'under_outreach') {
    throw new AppError(400, 'Alert must be active or under_outreach to resolve');
  }

  const oldStatus = alert.status;
  let newStatus: 'resolved_retained' | 'resolved_exited' | 'false_positive';

  if (data.resolution.includes('retained')) {
    newStatus = 'resolved_retained';
  } else if (data.resolution.includes('exited')) {
    newStatus = 'resolved_exited';
  } else if (data.resolution.includes('false_positive')) {
    newStatus = 'false_positive';
  } else {
    newStatus = 'resolved_retained';
  }

  alert.status = newStatus;
  alert.resolution = data.resolution;
  alert.resolvedAt = new Date();
  alert.resolvedBy = data.resolvedBy as any;

  await alert.save();

  await createAuditLog({
    collegeId,
    entityType: 'DropoutRiskAlert',
    entityId: String(alert._id),
    entityName: `Dropout Alert (score ${alert.riskScore})`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: newStatus },
      { field: 'resolution', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return alert;
}

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
