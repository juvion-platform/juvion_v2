import { StudentGrievance } from '../../models/welfare/StudentGrievance';
import { GrievanceAssignment } from '../../models/welfare/GrievanceAssignment';
import { SystemicPattern } from '../../models/welfare/SystemicPattern';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
import { FieldChange } from '../../shared/types';

// ─── SLA Helper ──────────────────────────────────────────────────────────────

const SLA_HOURS: Record<string, number> = { P1: 24, P2: 72, P3: 168 };

function computeSLADeadline(severity: string): Date {
  const hours = SLA_HOURS[severity] ?? SLA_HOURS['P3']!;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ===========================================================================
// W06-L2-001: File Routine Grievance
// ===========================================================================

export async function fileGrievance(
  collegeId: string,
  data: {
    studentId: string;
    category: string;
    subject: string;
    description: string;
    isAnonymous?: boolean;
    encryptedIdentity?: string;
  },
  performedBy: string,
) {
  const defaultSeverity = 'P3';
  const doc = await StudentGrievance.create({
    collegeId,
    studentId: data.studentId,
    category: data.category,
    subject: data.subject,
    description: data.description,
    isAnonymous: data.isAnonymous ?? false,
    encryptedIdentity: data.encryptedIdentity,
    severity: defaultSeverity,
    status: 'open',
    sla: {
      deadline: computeSLADeadline(defaultSeverity),
      breached: false,
      escalationLevel: 0,
    },
    reopenCount: 0,
  });

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(doc._id),
    entityName: `Grievance: ${data.subject}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'open' },
      { field: 'severity', displayName: 'Severity', oldValue: null, newValue: defaultSeverity },
      { field: 'category', displayName: 'Category', oldValue: null, newValue: data.category },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W06-L2-002: Auto-Triage & Route Grievance
// ===========================================================================

export async function triageGrievance(
  collegeId: string,
  grievanceId: string,
  data: {
    suggestedCategory?: string;
    suggestedSeverity?: 'P1' | 'P2' | 'P3';
    confidence?: number;
    duplicateCandidates?: string[];
    handlerDepartment?: string;
    assignedTo?: string;
  },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const changes: FieldChange[] = [];
  const oldSeverity = grievance.severity;

  // Update AI classification
  grievance.aiClassification = {
    suggestedCategory: data.suggestedCategory,
    suggestedSeverity: data.suggestedSeverity,
    confidence: data.confidence,
    duplicateCandidates: data.duplicateCandidates,
    classifiedAt: new Date(),
  };

  // Update severity and SLA if suggested
  if (data.suggestedSeverity && data.suggestedSeverity !== oldSeverity) {
    changes.push({ field: 'severity', displayName: 'Severity', oldValue: oldSeverity, newValue: data.suggestedSeverity });
    grievance.severity = data.suggestedSeverity;
    grievance.sla = {
      ...grievance.sla,
      deadline: computeSLADeadline(data.suggestedSeverity),
      breached: false,
      escalationLevel: grievance.sla?.escalationLevel ?? 0,
    };
  }

  if (data.handlerDepartment) {
    changes.push({ field: 'handlerDepartment', displayName: 'Handler Department', oldValue: grievance.handlerDepartment, newValue: data.handlerDepartment });
    grievance.handlerDepartment = data.handlerDepartment;
  }

  const confidence = data.confidence ?? 0;
  const oldStatus = grievance.status;

  if (confidence >= 0.7 && data.assignedTo) {
    // Auto-assign
    grievance.assignedTo = data.assignedTo as any;
    grievance.status = 'in_progress';
    changes.push({ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'in_progress' });
    changes.push({ field: 'assignedTo', displayName: 'Assigned To', oldValue: null, newValue: data.assignedTo });

    await GrievanceAssignment.create({
      collegeId,
      grievanceId,
      assignedTo: data.assignedTo,
      assignedBy: performedBy,
      department: data.handlerDepartment,
      assignedAt: new Date(),
      status: 'pending',
    });
  } else {
    // Low confidence — needs manual triage
    if (grievance.status !== 'open') {
      grievance.status = 'open';
      changes.push({ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'open' });
    }
  }

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes,
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// W06-L2-003: Investigate & Resolve Grievance
// ===========================================================================

export async function resolveGrievance(
  collegeId: string,
  grievanceId: string,
  data: { resolution: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const oldStatus = grievance.status;
  grievance.status = 'awaiting_feedback';
  grievance.resolution = data.resolution;

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'awaiting_feedback' },
      { field: 'resolution', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// W06-L2-004: Escalate Overdue Grievance
// ===========================================================================

export async function escalateGrievance(
  collegeId: string,
  grievanceId: string,
  data: { reason: string; escalateTo: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const oldStatus = grievance.status;
  const oldLevel = grievance.sla?.escalationLevel ?? 0;
  const newLevel = oldLevel + 1;

  // Update SLA escalation level
  grievance.sla = {
    ...grievance.sla,
    escalationLevel: newLevel,
  };

  // Add to escalation history
  grievance.escalationHistory.push({
    from: grievance.assignedTo,
    to: data.escalateTo,
    reason: data.reason,
    escalatedAt: new Date(),
    escalatedBy: performedBy,
  });

  grievance.status = 'escalated';

  await grievance.save();

  // Create new assignment for escalation target
  await GrievanceAssignment.create({
    collegeId,
    grievanceId,
    assignedTo: data.escalateTo,
    assignedBy: performedBy,
    assignedAt: new Date(),
    status: 'pending',
  });

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'escalated' },
      { field: 'sla.escalationLevel', displayName: 'Escalation Level', oldValue: oldLevel, newValue: newLevel },
      { field: 'escalateTo', displayName: 'Escalated To', oldValue: null, newValue: data.escalateTo },
    ],
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// W06-L2-005: Close & Feedback Grievance
// ===========================================================================

export async function feedbackGrievance(
  collegeId: string,
  grievanceId: string,
  data: { rating: number; comment?: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const oldStatus = grievance.status;
  grievance.feedbackRating = data.rating;
  if (data.comment) grievance.feedbackComment = data.comment;

  if (data.rating >= 3) {
    grievance.status = 'closed';
    grievance.resolvedAt = new Date();
  } else {
    // Unsatisfied — handler can respond further
    grievance.status = 'awaiting_feedback';
  }

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: grievance.status },
      { field: 'feedbackRating', displayName: 'Feedback Rating', oldValue: null, newValue: data.rating },
    ],
    performedBy,
  });

  return grievance;
}

export async function closeGrievance(
  collegeId: string,
  grievanceId: string,
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const oldStatus = grievance.status;
  grievance.status = 'closed';
  grievance.resolvedAt = new Date();

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'closed' },
    ],
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// W06-L2-006: Reopen Grievance
// ===========================================================================

export async function reopenGrievance(
  collegeId: string,
  grievanceId: string,
  data: { reason: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  if (grievance.reopenCount >= 2) {
    throw new AppError(400, 'Maximum reopen limit (2) reached for this grievance');
  }

  const oldStatus = grievance.status;
  grievance.reopenCount += 1;
  grievance.reopenHistory.push({ reason: data.reason, at: new Date() });
  grievance.status = 'reopened';
  grievance.resolvedAt = undefined;

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'reopened' },
      { field: 'reopenCount', displayName: 'Reopen Count', oldValue: grievance.reopenCount - 1, newValue: grievance.reopenCount },
    ],
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// W06-L2-007: Detect Systemic Pattern
// ===========================================================================

export async function detectSystemicPatterns(collegeId: string, performedBy: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Aggregate grievances by category in last 30 days
  const categoryAgg = await StudentGrievance.aggregate([
    {
      $match: {
        collegeId: StudentGrievance.base.Types.ObjectId.createFromHexString(collegeId),
        createdAt: { $gte: thirtyDaysAgo },
        status: { $in: ['open', 'in_progress', 'escalated', 'reopened'] },
      },
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        subjects: { $push: '$subject' },
        grievanceIds: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 5 } } },
  ]);

  const detectedPatterns = [];

  for (const group of categoryAgg) {
    const category = group._id as string;
    const grievanceIds = group.grievanceIds as string[];
    const subjects = group.subjects as string[];
    const frequency = group.count as number;

    // Determine severity based on frequency
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (frequency > 20) severity = 'high';
    else if (frequency > 10) severity = 'medium';

    // Check if an active pattern already exists for this category
    const existing = await SystemicPattern.findOne({
      collegeId,
      category,
      status: { $in: ['detected', 'reviewed'] },
    });

    if (existing) {
      // Update existing pattern with new data
      existing.grievanceIds = grievanceIds as any;
      existing.frequency = frequency;
      existing.severity = severity;
      existing.detectedAt = new Date();
      await existing.save();
      detectedPatterns.push(existing);
    } else {
      // Summarize the pattern from subjects
      const uniqueSubjects = Array.from(new Set(subjects)).slice(0, 5);
      const patternSummary = `Recurring ${category} grievances (${frequency} in 30 days): ${uniqueSubjects.join(', ')}`;

      const doc = await SystemicPattern.create({
        collegeId,
        category,
        pattern: patternSummary,
        grievanceIds,
        frequency,
        severity,
        status: 'detected',
        detectedAt: new Date(),
      });

      await createAuditLog({
        collegeId,
        entityType: 'SystemicPattern',
        entityId: String(doc._id),
        entityName: `Pattern: ${category}`,
        action: 'create',
        changes: [
          { field: 'status', displayName: 'Status', oldValue: null, newValue: 'detected' },
          { field: 'frequency', displayName: 'Frequency', oldValue: null, newValue: frequency },
        ],
        performedBy,
      });

      detectedPatterns.push(doc);
    }
  }

  return detectedPatterns;
}

// ===========================================================================
// W06-L2-008: Grievance Analytics
// ===========================================================================

export async function getGrievanceAnalytics(
  collegeId: string,
  filters?: { from?: string; to?: string },
) {
  const match: Record<string, any> = {
    collegeId: StudentGrievance.base.Types.ObjectId.createFromHexString(collegeId),
  };

  if (filters?.from || filters?.to) {
    match.createdAt = {};
    if (filters.from) match.createdAt.$gte = new Date(filters.from);
    if (filters.to) match.createdAt.$lte = new Date(filters.to);
  }

  const [totals, byCategory, bySeverity, slaCompliance, avgResolution] = await Promise.all([
    // Total counts by status
    StudentGrievance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    // By category
    StudentGrievance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    // By severity
    StudentGrievance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]),

    // SLA compliance
    StudentGrievance.aggregate([
      { $match: { ...match, status: 'closed' } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          breached: { $sum: { $cond: ['$sla.breached', 1, 0] } },
        },
      },
    ]),

    // Average resolution time (closed grievances)
    StudentGrievance.aggregate([
      { $match: { ...match, status: 'closed', resolvedAt: { $exists: true } } },
      {
        $project: {
          resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: '$resolutionMs' },
        },
      },
    ]),
  ]);

  const total = totals.reduce((sum: number, t: { count: number }) => sum + t.count, 0);
  const byStatus = Object.fromEntries(totals.map((t: { _id: string; count: number }) => [t._id, t.count]));

  const slaData = slaCompliance[0] as { total: number; breached: number } | undefined;
  const slaRate = slaData && slaData.total > 0
    ? ((slaData.total - slaData.breached) / slaData.total) * 100
    : 100;

  const avgData = avgResolution[0] as { avgMs: number } | undefined;
  const avgResolutionHours = avgData ? Math.round(avgData.avgMs / (1000 * 60 * 60)) : 0;

  return {
    total,
    byStatus,
    byCategory: Object.fromEntries(byCategory.map((c: { _id: string; count: number }) => [c._id, c.count])),
    bySeverity: Object.fromEntries(bySeverity.map((s: { _id: string; count: number }) => [s._id, s.count])),
    slaComplianceRate: Math.round(slaRate * 100) / 100,
    avgResolutionHours,
  };
}

// ===========================================================================
// Additional Helpers
// ===========================================================================

export async function addInternalNote(
  collegeId: string,
  grievanceId: string,
  data: { note: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  grievance.internalNotes.push({
    note: data.note,
    by: performedBy,
    at: new Date(),
  });

  await grievance.save();

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes: [
      { field: 'internalNotes', displayName: 'Internal Note', oldValue: null, newValue: data.note },
    ],
    performedBy,
  });

  return grievance;
}

export async function assignGrievance(
  collegeId: string,
  grievanceId: string,
  data: { assignedTo: string; department?: string },
  performedBy: string,
) {
  const grievance = await StudentGrievance.findOne({ _id: grievanceId, collegeId });
  if (!grievance) throw new AppError(404, 'Grievance not found');

  const oldAssigned = grievance.assignedTo ? String(grievance.assignedTo) : null;
  const oldStatus = grievance.status;
  const oldDept = grievance.handlerDepartment;

  grievance.assignedTo = data.assignedTo as any;
  grievance.status = 'in_progress';
  if (data.department) grievance.handlerDepartment = data.department;

  await grievance.save();

  await GrievanceAssignment.create({
    collegeId,
    grievanceId,
    assignedTo: data.assignedTo,
    assignedBy: performedBy,
    department: data.department,
    assignedAt: new Date(),
    status: 'pending',
  });

  const changes: FieldChange[] = [
    { field: 'assignedTo', displayName: 'Assigned To', oldValue: oldAssigned, newValue: data.assignedTo },
    { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'in_progress' },
  ];
  if (data.department) {
    changes.push({ field: 'handlerDepartment', displayName: 'Handler Department', oldValue: oldDept, newValue: data.department });
  }

  await createAuditLog({
    collegeId,
    entityType: 'StudentGrievance',
    entityId: String(grievance._id),
    entityName: `Grievance: ${grievance.subject}`,
    action: 'update',
    changes,
    performedBy,
  });

  return grievance;
}

// ===========================================================================
// SLA Dashboard
// ===========================================================================

export async function getGrievanceSLADashboard(collegeId: string) {
  const now = new Date();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const [totalOpen, breached, atRisk, bySeverity] = await Promise.all([
    StudentGrievance.countDocuments({
      collegeId,
      status: { $in: ['open', 'in_progress', 'escalated', 'reopened'] },
    }),
    StudentGrievance.countDocuments({
      collegeId,
      status: { $in: ['open', 'in_progress', 'escalated', 'reopened'] },
      'sla.breached': true,
    }),
    StudentGrievance.countDocuments({
      collegeId,
      status: { $in: ['open', 'in_progress', 'escalated', 'reopened'] },
      'sla.breached': { $ne: true },
      'sla.deadline': { $lte: fourHoursFromNow, $gt: now },
    }),
    StudentGrievance.aggregate([
      {
        $match: {
          collegeId: StudentGrievance.base.Types.ObjectId.createFromHexString(collegeId),
          status: { $in: ['open', 'in_progress', 'escalated', 'reopened'] },
        },
      },
      {
        $group: {
          _id: '$severity',
          total: { $sum: 1 },
          breached: { $sum: { $cond: ['$sla.breached', 1, 0] } },
        },
      },
    ]),
  ]);

  return {
    totalOpen,
    breached,
    atRisk,
    bySeverity: Object.fromEntries(
      bySeverity.map((s: { _id: string; total: number; breached: number }) => [
        s._id,
        { total: s.total, breached: s.breached },
      ]),
    ),
  };
}

// ===========================================================================
// CRUD: GrievanceAssignment
// ===========================================================================

export async function listGrievanceAssignments(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { grievanceId?: string; assignedTo?: string; status?: string },
) {
  const filter: Record<string, any> = { collegeId };
  if (filters?.grievanceId) filter.grievanceId = filters.grievanceId;
  if (filters?.assignedTo) filter.assignedTo = filters.assignedTo;
  if (filters?.status) filter.status = filters.status;
  return paginate(GrievanceAssignment, filter, page, limit, { createdAt: -1 }, ['grievanceId', 'assignedTo']);
}

export async function getGrievanceAssignment(collegeId: string, id: string) {
  const doc = await GrievanceAssignment.findOne({ _id: id, collegeId })
    .populate('grievanceId')
    .populate('assignedTo');
  if (!doc) throw new AppError(404, 'Grievance assignment not found');
  return doc;
}

// ===========================================================================
// CRUD: SystemicPattern
// ===========================================================================

export async function listSystemicPatterns(collegeId: string, page = 1, limit = 20) {
  return paginate(SystemicPattern, { collegeId }, page, limit, { detectedAt: -1 });
}

export async function getSystemicPattern(collegeId: string, id: string) {
  const doc = await SystemicPattern.findOne({ _id: id, collegeId }).populate('grievanceIds');
  if (!doc) throw new AppError(404, 'Systemic pattern not found');
  return doc;
}

export async function reviewSystemicPattern(
  collegeId: string,
  id: string,
  data: { status: string },
  performedBy: string,
) {
  const doc = await SystemicPattern.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Systemic pattern not found');

  const oldStatus = doc.status;
  doc.status = data.status;
  doc.reviewedBy = performedBy as any;

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'SystemicPattern',
    entityId: String(doc._id),
    entityName: `Pattern: ${doc.category}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status },
    ],
    performedBy,
  });

  return doc;
}
