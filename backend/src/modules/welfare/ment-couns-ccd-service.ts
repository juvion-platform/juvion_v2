import mongoose from 'mongoose';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';
import { MentorSession } from '../../models/welfare/MentorSession';
import { MentorConcern } from '../../models/welfare/MentorConcern';
import { CounsellingReferral } from '../../models/welfare/CounsellingReferral';
import { RiskSignal } from '../../models/welfare/RiskSignal';
import { CrisisAlert } from '../../models/welfare/CrisisAlert';
import { CCDThreshold } from '../../models/welfare/CCDThreshold';
import { CCDIntervention } from '../../models/welfare/CCDIntervention';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
import { FieldChange } from '../../shared/types';

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL WEIGHT CONSTANTS (CCD)
// ═══════════════════════════════════════════════════════════════════════════

const SIGNAL_WEIGHTS: Record<string, { base: number; firstGenModifier: number }> = {
  attendance_drop: { base: 25, firstGenModifier: 0 },
  failing_grades: { base: 40, firstGenModifier: 0 },
  backlog_accumulation: { base: 25, firstGenModifier: 0 },
  fee_default: { base: 25, firstGenModifier: 25 },
  scholarship_loss: { base: 15, firstGenModifier: 25 },
  warden_concern: { base: 25, firstGenModifier: 0 },
  mess_attendance_drop: { base: 15, firstGenModifier: 0 },
  messaging_withdrawal: { base: 10, firstGenModifier: 0 },
  sentiment_anomaly: { base: 10, firstGenModifier: 0 },
  isolation_indicators: { base: 15, firstGenModifier: 0 },
  grievance_filed: { base: 10, firstGenModifier: 0 },
  counselling_active: { base: 10, firstGenModifier: 0 },
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
// MENTORING — W06-L2-034: Assign Mentors
// ═══════════════════════════════════════════════════════════════════════════

export async function assignMentor(
  collegeId: string,
  data: {
    mentorId: string; studentId: string; academicYearId: string;
    semesterId?: string; aiSuggested?: boolean;
  },
  performedBy: string,
) {
  const doc = await MentorAssignment.create({
    collegeId,
    mentorId: data.mentorId,
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    semesterId: data.semesterId,
    assignedBy: performedBy,
    status: 'active',
    aiSuggested: data.aiSuggested ?? false,
  });

  await createAuditLog({
    collegeId, entityType: 'MentorAssignment', entityId: String(doc._id),
    entityName: `MentorAssignment`, action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
      { field: 'mentorId', displayName: 'Mentor', oldValue: null, newValue: data.mentorId },
      { field: 'studentId', displayName: 'Student', oldValue: null, newValue: data.studentId },
    ],
    performedBy,
  });
  return doc;
}

export async function bulkAssignMentors(
  collegeId: string,
  data: {
    assignments: Array<{
      mentorId: string; studentId: string; academicYearId: string; aiSuggested?: boolean;
    }>;
  },
  performedBy: string,
) {
  const docs = await MentorAssignment.insertMany(
    data.assignments.map((a) => ({
      collegeId,
      mentorId: a.mentorId,
      studentId: a.studentId,
      academicYearId: a.academicYearId,
      assignedBy: performedBy,
      status: 'active',
      aiSuggested: a.aiSuggested ?? false,
    })),
  );

  for (const doc of docs) {
    await createAuditLog({
      collegeId, entityType: 'MentorAssignment', entityId: String(doc._id),
      entityName: 'MentorAssignment', action: 'create',
      changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' }],
      performedBy,
    });
  }
  return { count: docs.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTORING — W06-L2-035: Conduct Mentor Session
// ═══════════════════════════════════════════════════════════════════════════

export async function recordMentorSession(
  collegeId: string,
  data: {
    assignmentId: string; mentorId: string; studentId: string;
    sessionDate: string; duration?: number; mode: 'in_person' | 'online';
    topicsSummary?: string; concernFlagged?: boolean;
    concernType?: string; referralMade?: boolean; referralType?: string;
  },
  performedBy: string,
) {
  const doc = await MentorSession.create({
    collegeId,
    assignmentId: data.assignmentId,
    mentorId: data.mentorId,
    studentId: data.studentId,
    sessionDate: new Date(data.sessionDate),
    duration: data.duration,
    mode: data.mode,
    topicsSummary: data.topicsSummary,
    concernFlagged: data.concernFlagged ?? false,
    concernType: data.concernType,
    referralMade: data.referralMade ?? false,
    referralType: data.referralType,
  });

  if (data.concernFlagged && data.concernType) {
    await MentorConcern.create({
      collegeId,
      mentorId: data.mentorId,
      studentId: data.studentId,
      sessionId: doc._id,
      concernType: data.concernType,
      description: data.topicsSummary ?? 'Concern flagged during mentor session',
      severity: 'medium',
      status: 'open',
    });
  }

  await createAuditLog({
    collegeId, entityType: 'MentorSession', entityId: String(doc._id),
    entityName: `Session: ${data.sessionDate}`, action: 'create',
    changes: [
      { field: 'mode', displayName: 'Mode', oldValue: null, newValue: data.mode },
      { field: 'concernFlagged', displayName: 'Concern Flagged', oldValue: null, newValue: data.concernFlagged ?? false },
    ],
    performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTORING — W06-L2-036: Flag At-Risk Mentee
// ═══════════════════════════════════════════════════════════════════════════

export async function flagMentorConcern(
  collegeId: string,
  data: {
    mentorId: string; studentId: string; sessionId?: string;
    concernType: string; description: string; severity: string;
    actionTaken?: string;
  },
  performedBy: string,
) {
  const doc = await MentorConcern.create({
    collegeId,
    mentorId: data.mentorId,
    studentId: data.studentId,
    sessionId: data.sessionId,
    concernType: data.concernType,
    description: data.description,
    severity: data.severity,
    actionTaken: data.actionTaken,
    status: 'open',
  });

  await createAuditLog({
    collegeId, entityType: 'MentorConcern', entityId: String(doc._id),
    entityName: `Concern: ${data.concernType}`, action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'open' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: data.severity },
    ],
    performedBy,
  });
  return doc;
}

export async function escalateConcernToCCD(
  collegeId: string,
  concernId: string,
  performedBy: string,
) {
  const concern = await MentorConcern.findOne({ _id: concernId, collegeId });
  if (!concern) throw new AppError(404, 'Mentor concern not found');

  const changes: FieldChange[] = [
    { field: 'escalatedToCCD', displayName: 'Escalated to CCD', oldValue: concern.escalatedToCCD, newValue: true },
    { field: 'status', displayName: 'Status', oldValue: concern.status, newValue: 'escalated' },
  ];

  // Create a risk signal for this escalation
  const signalWeights = SIGNAL_WEIGHTS['counselling_active']!;
  const signal = await RiskSignal.create({
    collegeId,
    studentId: concern.studentId,
    source: 'M06',
    signalType: 'counselling_active',
    baseWeight: signalWeights.base,
    firstGenModifier: 0,
    computedWeight: signalWeights.base,
    triggerData: { concernId: String(concern._id), concernType: concern.concernType },
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    status: 'active',
  });

  concern.escalatedToCCD = true;
  concern.status = 'escalated';
  (concern as any).riskSignalId = signal._id;
  await concern.save();

  // Recompute CCD alert
  await computeAndUpdateCCDAlert(collegeId, String(concern.studentId));

  await createAuditLog({
    collegeId, entityType: 'MentorConcern', entityId: String(concern._id),
    entityName: `Concern: ${concern.concernType}`, action: 'update',
    changes, performedBy,
  });
  return concern;
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTORING — W06-L2-037: Refer Mentee to Counselling
// ═══════════════════════════════════════════════════════════════════════════

export async function referToCounselling(
  collegeId: string,
  data: {
    studentId: string; referralSource: string;
    triggeringCaseId?: string; triggeringCaseType?: string;
  },
  performedBy: string,
) {
  const doc = await CounsellingReferral.create({
    collegeId,
    studentId: data.studentId,
    referredBy: performedBy,
    referralSource: data.referralSource,
    triggeringCaseId: data.triggeringCaseId,
    triggeringCaseType: data.triggeringCaseType,
    status: 'referred',
    followUpStatus: 'pending',
  });

  await createAuditLog({
    collegeId, entityType: 'CounsellingReferral', entityId: String(doc._id),
    entityName: `Referral: ${data.referralSource}`, action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'referred' },
      { field: 'referralSource', displayName: 'Source', oldValue: null, newValue: data.referralSource },
    ],
    performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTORING — W06-L2-038: Mentor Engagement Analytics
// ═══════════════════════════════════════════════════════════════════════════

export async function getMentorEngagementAnalytics(
  collegeId: string,
  filters?: { academicYearId?: string },
) {
  const matchBase: Record<string, unknown> = { collegeId };
  if (filters?.academicYearId) matchBase['academicYearId'] = filters.academicYearId;

  const [assignmentStats] = await MentorAssignment.aggregate([
    { $match: { ...matchBase, status: 'active' } },
    {
      $group: {
        _id: null,
        totalMentors: { $addToSet: '$mentorId' },
        totalMentees: { $addToSet: '$studentId' },
      },
    },
    {
      $project: {
        _id: 0,
        totalMentors: { $size: '$totalMentors' },
        totalMentees: { $size: '$totalMentees' },
      },
    },
  ]);

  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregations actually match documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const sessionsPerMentor = await MentorSession.aggregate([
    { $match: { collegeId: cidObj } },
    { $group: { _id: '$mentorId', sessionCount: { $sum: 1 } } },
    { $group: { _id: null, avgSessions: { $avg: '$sessionCount' }, totalSessions: { $sum: '$sessionCount' } } },
    { $project: { _id: 0, avgSessions: { $round: ['$avgSessions', 1] }, totalSessions: 1 } },
  ]);

  const concernStats = await MentorConcern.aggregate([
    { $match: { collegeId: cidObj } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const concernsByStatus: Record<string, number> = {};
  for (const c of concernStats) { concernsByStatus[c._id as string] = c.count as number; }

  return {
    totalMentors: assignmentStats?.totalMentors ?? 0,
    totalMentees: assignmentStats?.totalMentees ?? 0,
    totalSessions: sessionsPerMentor[0]?.totalSessions ?? 0,
    avgSessionsPerMentor: sessionsPerMentor[0]?.avgSessions ?? 0,
    concernsFlagged: concernsByStatus,
  };
}

// ─── Mentor Support ─────────────────────────────────────────────────────

export async function getMyMentees(collegeId: string, mentorId: string) {
  return MentorAssignment.find({ collegeId, mentorId, status: 'active' })
    .populate('studentId', 'name rollNumber')
    .lean();
}

export async function getAtRiskMentees(
  collegeId: string,
  filters?: { academicYearId?: string },
) {
  const match: Record<string, unknown> = {
    collegeId,
    $or: [{ severity: 'high' }, { escalatedToCCD: true }],
    status: { $in: ['open', 'escalated'] },
  };
  if (filters?.academicYearId) match['academicYearId'] = filters.academicYearId;

  return MentorConcern.find(match)
    .populate('studentId', 'name rollNumber')
    .populate('mentorId', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

// ─── Mentor CRUD ────────────────────────────────────────────────────────

export async function listMentorAssignments(
  collegeId: string, page: number, limit: number,
  filters?: { mentorId?: string; academicYearId?: string; status?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.mentorId) filter['mentorId'] = filters.mentorId;
  if (filters?.academicYearId) filter['academicYearId'] = filters.academicYearId;
  if (filters?.status) filter['status'] = filters.status;
  return paginate(MentorAssignment, filter, page, limit);
}

export async function getMentorAssignment(collegeId: string, id: string) {
  const doc = await MentorAssignment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentor assignment not found');
  return doc;
}

export async function updateMentorAssignment(
  collegeId: string, id: string,
  data: { status?: string; mentorId?: string; semesterId?: string },
  performedBy: string,
) {
  const doc = await MentorAssignment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentor assignment not found');

  const changes: FieldChange[] = [];
  if (data.status !== undefined && data.status !== doc.status) {
    changes.push({ field: 'status', displayName: 'Status', oldValue: doc.status, newValue: data.status });
    doc.status = data.status;
  }
  if (data.mentorId !== undefined && data.mentorId !== String(doc.mentorId)) {
    changes.push({ field: 'mentorId', displayName: 'Mentor', oldValue: String(doc.mentorId), newValue: data.mentorId });
    (doc as any).mentorId = data.mentorId;
  }
  if (data.semesterId !== undefined) {
    (doc as any).semesterId = data.semesterId;
  }

  await doc.save();
  if (changes.length > 0) {
    await createAuditLog({
      collegeId, entityType: 'MentorAssignment', entityId: String(doc._id),
      entityName: 'MentorAssignment', action: 'update', changes, performedBy,
    });
  }
  return doc;
}

export async function listMentorSessions(
  collegeId: string, page: number, limit: number,
  filters?: { mentorId?: string; studentId?: string; assignmentId?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.mentorId) filter['mentorId'] = filters.mentorId;
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  if (filters?.assignmentId) filter['assignmentId'] = filters.assignmentId;
  return paginate(MentorSession, filter, page, limit);
}

export async function getMentorSession(collegeId: string, id: string) {
  const doc = await MentorSession.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentor session not found');
  return doc;
}

export async function listMentorConcerns(
  collegeId: string, page: number, limit: number,
  filters?: { studentId?: string; mentorId?: string; status?: string; severity?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  if (filters?.mentorId) filter['mentorId'] = filters.mentorId;
  if (filters?.status) filter['status'] = filters.status;
  if (filters?.severity) filter['severity'] = filters.severity;
  return paginate(MentorConcern, filter, page, limit);
}

export async function getMentorConcern(collegeId: string, id: string) {
  const doc = await MentorConcern.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentor concern not found');
  return doc;
}

export async function updateMentorConcern(
  collegeId: string, id: string,
  data: { status?: string; actionTaken?: string; severity?: string },
  performedBy: string,
) {
  const doc = await MentorConcern.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mentor concern not found');

  const changes: FieldChange[] = [];
  if (data.status !== undefined && data.status !== doc.status) {
    changes.push({ field: 'status', displayName: 'Status', oldValue: doc.status, newValue: data.status });
    doc.status = data.status;
  }
  if (data.severity !== undefined && data.severity !== doc.severity) {
    changes.push({ field: 'severity', displayName: 'Severity', oldValue: doc.severity, newValue: data.severity });
    doc.severity = data.severity;
  }
  if (data.actionTaken !== undefined) {
    changes.push({ field: 'actionTaken', displayName: 'Action Taken', oldValue: doc.actionTaken, newValue: data.actionTaken });
    doc.actionTaken = data.actionTaken;
  }

  await doc.save();
  if (changes.length > 0) {
    await createAuditLog({
      collegeId, entityType: 'MentorConcern', entityId: String(doc._id),
      entityName: `Concern: ${doc.concernType}`, action: 'update', changes, performedBy,
    });
  }
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNSELLING — W06-L2-039: Create Referral (alias for referToCounselling)
// ═══════════════════════════════════════════════════════════════════════════

export const createCounsellingReferral = referToCounselling;

// ═══════════════════════════════════════════════════════════════════════════
// COUNSELLING — W06-L2-040: Track Follow-Up
// ═══════════════════════════════════════════════════════════════════════════

export async function updateCounsellingReferral(
  collegeId: string, referralId: string,
  data: { status?: string; appointmentDates?: string[]; followUpStatus?: string },
  performedBy: string,
) {
  const doc = await CounsellingReferral.findOne({ _id: referralId, collegeId });
  if (!doc) throw new AppError(404, 'Counselling referral not found');

  const changes: FieldChange[] = [];
  if (data.status !== undefined && data.status !== doc.status) {
    changes.push({ field: 'status', displayName: 'Status', oldValue: doc.status, newValue: data.status });
    doc.status = data.status;
  }
  if (data.appointmentDates !== undefined) {
    changes.push({ field: 'appointmentDates', displayName: 'Appointment Dates', oldValue: doc.appointmentDates, newValue: data.appointmentDates });
    doc.appointmentDates = data.appointmentDates.map((d) => new Date(d));
  }
  if (data.followUpStatus !== undefined && data.followUpStatus !== doc.followUpStatus) {
    changes.push({ field: 'followUpStatus', displayName: 'Follow-Up Status', oldValue: doc.followUpStatus, newValue: data.followUpStatus });
    doc.followUpStatus = data.followUpStatus;
  }

  await doc.save();
  if (changes.length > 0) {
    await createAuditLog({
      collegeId, entityType: 'CounsellingReferral', entityId: String(doc._id),
      entityName: `Referral: ${doc.referralSource}`, action: 'update', changes, performedBy,
    });
  }
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNSELLING — W06-L2-041: Close Referral
// ═══════════════════════════════════════════════════════════════════════════

export async function closeCounsellingReferral(
  collegeId: string, referralId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await CounsellingReferral.findOne({ _id: referralId, collegeId });
  if (!doc) throw new AppError(404, 'Counselling referral not found');

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'completed' },
    { field: 'closedAt', displayName: 'Closed At', oldValue: null, newValue: new Date() },
  ];

  doc.status = 'completed';
  doc.closedAt = new Date();
  doc.closedReason = data.reason;
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'CounsellingReferral', entityId: String(doc._id),
    entityName: `Referral: ${doc.referralSource}`, action: 'update', changes, performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNSELLING — W06-L2-042: Aggregate Report
// ═══════════════════════════════════════════════════════════════════════════

export async function getCounsellingAggregateReport(
  collegeId: string,
  filters?: { from?: string; to?: string },
) {
  const match: Record<string, unknown> = { collegeId };
  if (filters?.from || filters?.to) {
    const dateFilter: Record<string, Date> = {};
    if (filters.from) dateFilter['$gte'] = new Date(filters.from);
    if (filters.to) dateFilter['$lte'] = new Date(filters.to);
    match['createdAt'] = dateFilter;
  }

  const [byStatus, bySource, totals] = await Promise.all([
    CounsellingReferral.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CounsellingReferral.aggregate([
      { $match: match },
      { $group: { _id: '$referralSource', count: { $sum: 1 } } },
    ]),
    CounsellingReferral.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of byStatus) { statusMap[s._id as string] = s.count as number; }
  const sourceMap: Record<string, number> = {};
  for (const s of bySource) { sourceMap[s._id as string] = s.count as number; }

  const total = totals[0]?.total ?? 0;
  const completed = totals[0]?.completed ?? 0;

  return {
    total,
    byStatus: statusMap,
    bySource: sourceMap,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// ─── Counselling CRUD ───────────────────────────────────────────────────

export async function listCounsellingReferrals(
  collegeId: string, page: number, limit: number,
  filters?: { studentId?: string; status?: string; referralSource?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  if (filters?.status) filter['status'] = filters.status;
  if (filters?.referralSource) filter['referralSource'] = filters.referralSource;
  return paginate(CounsellingReferral, filter, page, limit);
}

export async function getCounsellingReferral(collegeId: string, id: string) {
  const doc = await CounsellingReferral.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Counselling referral not found');
  return doc;
}

export async function getFollowUpDashboard(collegeId: string) {
  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregation actually matches documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const stats = await CounsellingReferral.aggregate([
    { $match: { collegeId: cidObj, status: { $nin: ['completed', 'declined'] } } },
    { $group: { _id: '$followUpStatus', count: { $sum: 1 } } },
  ]);

  const result: Record<string, number> = { pending: 0, on_track: 0, missed: 0, completed: 0 };
  for (const s of stats) { result[s._id as string] = s.count as number; }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — W06-L2-058/061/065/079: Ingest Risk Signal
// ═══════════════════════════════════════════════════════════════════════════

export async function ingestRiskSignal(
  collegeId: string,
  data: {
    studentId: string; source: string; signalType: string;
    triggerData?: Record<string, unknown>;
  },
  _performedBy: string,
) {
  const weights = SIGNAL_WEIGHTS[data.signalType];
  const baseWeight = weights?.base ?? 10;
  const isFirstGen = !!(data.triggerData?.isFirstGen);
  const firstGenMod = isFirstGen ? (weights?.firstGenModifier ?? 0) : 0;
  const computedWeight = baseWeight + firstGenMod;

  const doc = await RiskSignal.create({
    collegeId,
    studentId: data.studentId,
    source: data.source,
    signalType: data.signalType,
    baseWeight,
    firstGenModifier: firstGenMod,
    computedWeight,
    triggerData: data.triggerData,
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    status: 'active',
  });

  await computeAndUpdateCCDAlert(collegeId, data.studentId);
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — Compound Score Computation
// ═══════════════════════════════════════════════════════════════════════════

export async function computeRiskScore(
  collegeId: string,
  studentId: string,
): Promise<{
  score: number;
  priority: 'P1' | 'P2' | 'P3' | null;
  breakdown: {
    baseTotal: number; crossModuleMultiplier: number;
    temporalMultiplier: number; finalScore: number;
  };
}> {
  // Get active thresholds for temporal window config
  const thresholds = await CCDThreshold.find({ collegeId, isActive: true }).lean();
  const temporalWindowDays = thresholds[0]?.temporalWindowDays ?? 14;
  const temporalCutoff = new Date(Date.now() - temporalWindowDays * 24 * 60 * 60 * 1000);

  // Get active, non-expired signals
  const signals = await RiskSignal.find({
    collegeId,
    studentId,
    status: 'active',
    expiresAt: { $gte: new Date() },
  }).lean();

  if (signals.length === 0) {
    return { score: 0, priority: null, breakdown: { baseTotal: 0, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: 0 } };
  }

  const baseTotal = signals.reduce((sum, s) => sum + s.computedWeight, 0);

  // Cross-module multiplier: distinct source modules >= 3
  const distinctModules = new Set(signals.map((s) => s.source)).size;
  const crossModuleMultiplier = distinctModules >= 3 ? 1.5 : 1;

  // Temporal multiplier: >= 2 signals within temporal window
  const recentSignals = signals.filter((s) => s.receivedAt >= temporalCutoff);
  const temporalMultiplier = recentSignals.length >= 2 ? 1.5 : 1;

  const finalScore = Math.min(100, Math.round(baseTotal * crossModuleMultiplier * temporalMultiplier));
  const priority: 'P1' | 'P2' | 'P3' | null =
    finalScore >= 75 ? 'P1' : finalScore >= 50 ? 'P2' : finalScore >= 35 ? 'P3' : null;

  return {
    score: finalScore,
    priority,
    breakdown: { baseTotal, crossModuleMultiplier, temporalMultiplier, finalScore },
  };
}

// ─── Internal: Compute & Update CCD Alert ───────────────────────────────

async function computeAndUpdateCCDAlert(collegeId: string, studentId: string) {
  const result = await computeRiskScore(collegeId, studentId);
  if (!result.priority) return;

  const severityMap: Record<string, string> = { P1: 'critical', P2: 'high', P3: 'medium' };
  const severity = severityMap[result.priority] ?? 'medium';

  // Get active signals for the alert record
  const signals = await RiskSignal.find({
    collegeId, studentId, status: 'active', expiresAt: { $gte: new Date() },
  }).lean();

  const signalEntries = signals.map((s) => ({
    signalId: s._id,
    source: s.source,
    signalType: s.signalType,
    weight: s.computedWeight,
    receivedAt: s.receivedAt,
  }));

  // Check for existing active alert (double-alert suppression)
  const existing = await CrisisAlert.findOne({
    collegeId,
    studentId,
    status: { $nin: ['resolved', 'false_positive'] },
  });

  if (existing) {
    existing.signals = signalEntries;
    existing.compoundScore = result.score;
    existing.scoreBreakdown = result.breakdown;
    existing.priority = result.priority;
    existing.severity = severity;
    existing.suppressDoubleAlert = true;
    await existing.save();
    return existing;
  }

  const alert = await CrisisAlert.create({
    collegeId,
    reportedBy: '000000000000000000000000', // system-generated
    studentId,
    type: 'mental_health', // compound_risk maps to mental_health in enum
    severity,
    description: `CCD compound risk alert — score ${result.score} (${result.priority})`,
    status: 'generated',
    signals: signalEntries,
    compoundScore: result.score,
    scoreBreakdown: result.breakdown,
    priority: result.priority,
    falsePositive: false,
    suppressDoubleAlert: false,
  });

  // Mark signals as consumed
  await RiskSignal.updateMany(
    { _id: { $in: signals.map((s) => s._id) } },
    { $set: { consumedByAlertId: alert._id } },
  );

  return alert;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — W06-L2-059: Acknowledge Alert
// ═══════════════════════════════════════════════════════════════════════════

export async function acknowledgeCCDAlert(
  collegeId: string, alertId: string,
  data: { initialAssessment: string },
  performedBy: string,
) {
  const doc = await CrisisAlert.findOne({ _id: alertId, collegeId });
  if (!doc) throw new AppError(404, 'CCD alert not found');

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'acknowledged' },
  ];

  doc.status = 'acknowledged';
  doc.acknowledgment = {
    acknowledgedBy: performedBy,
    acknowledgedAt: new Date(),
    initialAssessment: data.initialAssessment,
  };
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'CrisisAlert', entityId: String(doc._id),
    entityName: `CCD Alert: ${doc.priority}`, action: 'update', changes, performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — W06-L2-060: Investigate Alert
// ═══════════════════════════════════════════════════════════════════════════

export async function investigateCCDAlert(
  collegeId: string, alertId: string,
  data: { findings?: string },
  performedBy: string,
) {
  const doc = await CrisisAlert.findOne({ _id: alertId, collegeId });
  if (!doc) throw new AppError(404, 'CCD alert not found');

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'investigating' },
  ];

  doc.status = 'investigating';
  doc.investigation = {
    investigatorId: performedBy,
    startedAt: new Date(),
    findings: data.findings,
  };
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'CrisisAlert', entityId: String(doc._id),
    entityName: `CCD Alert: ${doc.priority}`, action: 'update', changes, performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — W06-L2-062: Execute Intervention
// ═══════════════════════════════════════════════════════════════════════════

export async function recordCCDIntervention(
  collegeId: string, alertId: string,
  data: {
    type: string; description: string; followUpDate?: string;
    linkedEntityId?: string; linkedEntityType?: string;
  },
  performedBy: string,
) {
  const alert = await CrisisAlert.findOne({ _id: alertId, collegeId });
  if (!alert) throw new AppError(404, 'CCD alert not found');

  const intervention = await CCDIntervention.create({
    collegeId,
    alertId,
    studentId: alert.studentId,
    type: data.type,
    description: data.description,
    executedBy: performedBy,
    executedAt: new Date(),
    followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    followUpStatus: data.followUpDate ? 'pending' : undefined,
    linkedEntityId: data.linkedEntityId,
    linkedEntityType: data.linkedEntityType,
  });

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: alert.status, newValue: 'intervening' },
  ];

  alert.status = 'intervening';
  alert.intervention = {
    type: data.type,
    description: data.description,
    executedBy: performedBy,
    executedAt: new Date(),
    followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
  };
  await alert.save();

  await createAuditLog({
    collegeId, entityType: 'CCDIntervention', entityId: String(intervention._id),
    entityName: `Intervention: ${data.type}`, action: 'create',
    changes: [{ field: 'type', displayName: 'Type', oldValue: null, newValue: data.type }],
    performedBy,
  });

  await createAuditLog({
    collegeId, entityType: 'CrisisAlert', entityId: String(alert._id),
    entityName: `CCD Alert: ${alert.priority}`, action: 'update', changes, performedBy,
  });

  return intervention;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — Resolve & False Positive
// ═══════════════════════════════════════════════════════════════════════════

export async function resolveCCDAlert(
  collegeId: string, alertId: string, performedBy: string,
) {
  const doc = await CrisisAlert.findOne({ _id: alertId, collegeId });
  if (!doc) throw new AppError(404, 'CCD alert not found');

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'resolved' },
  ];

  doc.status = 'resolved';
  doc.resolvedAt = new Date();
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'CrisisAlert', entityId: String(doc._id),
    entityName: `CCD Alert: ${doc.priority}`, action: 'update', changes, performedBy,
  });
  return doc;
}

export async function markCCDFalsePositive(
  collegeId: string, alertId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await CrisisAlert.findOne({ _id: alertId, collegeId });
  if (!doc) throw new AppError(404, 'CCD alert not found');

  const changes: FieldChange[] = [
    { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'false_positive' },
    { field: 'falsePositive', displayName: 'False Positive', oldValue: false, newValue: true },
  ];

  doc.falsePositive = true;
  doc.falsePositiveReason = data.reason;
  doc.status = 'false_positive';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'CrisisAlert', entityId: String(doc._id),
    entityName: `CCD Alert: ${doc.priority}`, action: 'update', changes, performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════════
// CCD — Support Functions
// ═══════════════════════════════════════════════════════════════════════════

export async function getStudentRiskProfile(collegeId: string, studentId: string) {
  const [signals, scoreResult, activeAlerts, pastInterventions] = await Promise.all([
    RiskSignal.find({ collegeId, studentId, status: 'active', expiresAt: { $gte: new Date() } })
      .sort({ receivedAt: -1 }).lean(),
    computeRiskScore(collegeId, studentId),
    CrisisAlert.find({ collegeId, studentId, status: { $nin: ['resolved', 'false_positive'] } })
      .sort({ createdAt: -1 }).lean(),
    CCDIntervention.find({ collegeId, studentId }).sort({ executedAt: -1 }).lean(),
  ]);

  return {
    activeSignals: signals,
    riskScore: scoreResult,
    activeAlerts,
    pastInterventions,
  };
}

export async function getCCDDashboard(collegeId: string) {
  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregations actually match documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const [byPriority, unacknowledged, interventionOutcomes] = await Promise.all([
    CrisisAlert.aggregate([
      { $match: { collegeId: cidObj, status: { $nin: ['resolved', 'false_positive'] } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    CrisisAlert.countDocuments({ collegeId, status: 'generated' }),
    CCDIntervention.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: '$followUpStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const priorityMap: Record<string, number> = { P1: 0, P2: 0, P3: 0 };
  for (const p of byPriority) { if (p._id) priorityMap[p._id as string] = p.count as number; }

  const outcomeMap: Record<string, number> = {};
  for (const o of interventionOutcomes) { if (o._id) outcomeMap[o._id as string] = o.count as number; }

  return {
    activeAlertsByPriority: priorityMap,
    unacknowledgedCount: unacknowledged,
    interventionOutcomes: outcomeMap,
  };
}

export async function recomputeStudentScore(collegeId: string, studentId: string) {
  return computeAndUpdateCCDAlert(collegeId, studentId);
}

export async function decayExpiredSignals(collegeId: string) {
  const expired = await RiskSignal.find({
    collegeId, status: 'active', expiresAt: { $lt: new Date() },
  }).lean();

  if (expired.length === 0) return { decayedCount: 0 };

  await RiskSignal.updateMany(
    { _id: { $in: expired.map((s) => s._id) } },
    { $set: { status: 'decayed', decayed: true } },
  );

  // Recompute scores for affected students
  const affectedStudents = Array.from(new Set(expired.map((s) => String(s.studentId))));
  for (const sid of affectedStudents) {
    await computeAndUpdateCCDAlert(collegeId, sid);
  }

  return { decayedCount: expired.length, studentsRecomputed: affectedStudents.length };
}

// ─── CCD CRUD ───────────────────────────────────────────────────────────

export async function listRiskSignals(
  collegeId: string, page: number, limit: number,
  filters?: { studentId?: string; source?: string; signalType?: string; status?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  if (filters?.source) filter['source'] = filters.source;
  if (filters?.signalType) filter['signalType'] = filters.signalType;
  if (filters?.status) filter['status'] = filters.status;
  return paginate(RiskSignal, filter, page, limit);
}

export async function getRiskSignal(collegeId: string, id: string) {
  const doc = await RiskSignal.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Risk signal not found');
  return doc;
}

export async function listCCDAlerts(
  collegeId: string, page: number, limit: number,
  filters?: { priority?: string; status?: string; studentId?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.priority) filter['priority'] = filters.priority;
  if (filters?.status) filter['status'] = filters.status;
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  return paginate(CrisisAlert, filter, page, limit);
}

export async function getCCDAlert(collegeId: string, id: string) {
  const doc = await CrisisAlert.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'CCD alert not found');
  return doc;
}

export async function listCCDInterventions(
  collegeId: string, page: number, limit: number,
  filters?: { alertId?: string; studentId?: string; type?: string },
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters?.alertId) filter['alertId'] = filters.alertId;
  if (filters?.studentId) filter['studentId'] = filters.studentId;
  if (filters?.type) filter['type'] = filters.type;
  return paginate(CCDIntervention, filter, page, limit);
}

export async function getCCDIntervention(collegeId: string, id: string) {
  const doc = await CCDIntervention.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'CCD intervention not found');
  return doc;
}

export async function listCCDThresholds(collegeId: string, page: number, limit: number) {
  return paginate(CCDThreshold, { collegeId }, page, limit);
}

export async function getCCDThreshold(collegeId: string, id: string) {
  const doc = await CCDThreshold.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'CCD threshold not found');
  return doc;
}

export async function createCCDThreshold(
  collegeId: string,
  data: {
    name: string; priority: string; scoreThreshold: number;
    crossModuleMinimum?: number; temporalWindowDays?: number;
    compoundingMultiplier?: number; decayDays?: number;
  },
  performedBy: string,
) {
  const doc = await CCDThreshold.create({
    collegeId,
    name: data.name,
    priority: data.priority,
    scoreThreshold: data.scoreThreshold,
    crossModuleMinimum: data.crossModuleMinimum ?? 1,
    temporalWindowDays: data.temporalWindowDays ?? 14,
    compoundingMultiplier: data.compoundingMultiplier ?? 1.5,
    decayDays: data.decayDays ?? 30,
    isActive: true,
    updatedBy: performedBy,
  });

  await createAuditLog({
    collegeId, entityType: 'CCDThreshold', entityId: String(doc._id),
    entityName: `Threshold: ${data.name}`, action: 'create',
    changes: [
      { field: 'priority', displayName: 'Priority', oldValue: null, newValue: data.priority },
      { field: 'scoreThreshold', displayName: 'Score Threshold', oldValue: null, newValue: data.scoreThreshold },
    ],
    performedBy,
  });
  return doc;
}

export async function updateCCDThreshold(
  collegeId: string, id: string,
  data: {
    name?: string; scoreThreshold?: number; crossModuleMinimum?: number;
    temporalWindowDays?: number; compoundingMultiplier?: number;
    decayDays?: number; isActive?: boolean;
  },
  performedBy: string,
) {
  const doc = await CCDThreshold.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'CCD threshold not found');

  const changes: FieldChange[] = [];
  if (data.name !== undefined && data.name !== doc.name) {
    changes.push({ field: 'name', displayName: 'Name', oldValue: doc.name, newValue: data.name });
    doc.name = data.name;
  }
  if (data.scoreThreshold !== undefined && data.scoreThreshold !== doc.scoreThreshold) {
    changes.push({ field: 'scoreThreshold', displayName: 'Score Threshold', oldValue: doc.scoreThreshold, newValue: data.scoreThreshold });
    doc.scoreThreshold = data.scoreThreshold;
  }
  if (data.crossModuleMinimum !== undefined && data.crossModuleMinimum !== doc.crossModuleMinimum) {
    changes.push({ field: 'crossModuleMinimum', displayName: 'Cross-Module Minimum', oldValue: doc.crossModuleMinimum, newValue: data.crossModuleMinimum });
    doc.crossModuleMinimum = data.crossModuleMinimum;
  }
  if (data.temporalWindowDays !== undefined && data.temporalWindowDays !== doc.temporalWindowDays) {
    changes.push({ field: 'temporalWindowDays', displayName: 'Temporal Window Days', oldValue: doc.temporalWindowDays, newValue: data.temporalWindowDays });
    doc.temporalWindowDays = data.temporalWindowDays;
  }
  if (data.compoundingMultiplier !== undefined && data.compoundingMultiplier !== doc.compoundingMultiplier) {
    changes.push({ field: 'compoundingMultiplier', displayName: 'Compounding Multiplier', oldValue: doc.compoundingMultiplier, newValue: data.compoundingMultiplier });
    doc.compoundingMultiplier = data.compoundingMultiplier;
  }
  if (data.decayDays !== undefined && data.decayDays !== doc.decayDays) {
    changes.push({ field: 'decayDays', displayName: 'Decay Days', oldValue: doc.decayDays, newValue: data.decayDays });
    doc.decayDays = data.decayDays;
  }
  if (data.isActive !== undefined && data.isActive !== doc.isActive) {
    changes.push({ field: 'isActive', displayName: 'Active', oldValue: doc.isActive, newValue: data.isActive });
    doc.isActive = data.isActive;
  }

  doc.updatedBy = performedBy as any;
  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId, entityType: 'CCDThreshold', entityId: String(doc._id),
      entityName: `Threshold: ${doc.name}`, action: 'update', changes, performedBy,
    });
  }
  return doc;
}
