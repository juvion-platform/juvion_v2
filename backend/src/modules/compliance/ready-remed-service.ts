import { ReadinessScore } from '../../models/compliance/ReadinessScore';
import { ReadinessSnapshot } from '../../models/compliance/ReadinessSnapshot';
import { GapRecord } from '../../models/compliance/GapRecord';
import { RemediationPlan } from '../../models/compliance/RemediationPlan';
import { EvidenceRecord } from '../../models/compliance/EvidenceRecord';
import { CriterionEvidenceMapping } from '../../models/compliance/CriterionEvidenceMapping';
import { ComplianceCriteria } from '../../models/compliance/ComplianceCriteria';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══════════════════════════════════════════════════════════════
//  Readiness Scoring
// ═══════════════════════════════════════════════════════════════

export async function listReadinessScores(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (status) filter.status = status;
  return paginate(ReadinessScore, filter, page, limit, { computedAt: -1 });
}

export async function computeReadiness(
  collegeId: string,
  bodyId: string,
  programmeId: string | undefined,
  performedBy: string,
) {
  const criteriaFilter: Record<string, unknown> = { collegeId, bodyId };
  const criteria = await ComplianceCriteria.find(criteriaFilter).lean();
  if (criteria.length === 0) throw new AppError(404, 'No criteria found for this body');

  const criterionScores: Array<{
    criterionId: string;
    score: number;
    maxPossibleScore: number;
    evidenceCount: number;
    evidenceWithGaps: number;
    trend: string;
  }> = [];

  for (const criterion of criteria) {
    const criterionId = String(criterion._id);

    // Get evidence mappings for this criterion
    const mappings = await CriterionEvidenceMapping.find({
      collegeId,
      criterionId: criterion._id,
    }).lean();

    const requiredMappings = mappings.length || 1; // avoid divide-by-zero

    // Count evidence records for this criterion that are verified or collected
    const evidenceFilter: Record<string, unknown> = {
      collegeId,
      criterionCode: criterion.criterionNumber,
      status: { $in: ['collected', 'verified'] },
    };
    if (programmeId) evidenceFilter.programmeId = programmeId;

    const evidenceRecords = await EvidenceRecord.find(evidenceFilter).lean();
    const evidenceCount = evidenceRecords.length;
    const evidenceWithGaps = evidenceRecords.filter(
      (e) => !e.scores || (e.scores.composite ?? 0) < 50,
    ).length;

    // Compute score based on evidence coverage
    const rawScore = (evidenceCount / requiredMappings) * 100;
    const score = Math.min(Math.round(rawScore * 100) / 100, 100);
    const maxPossibleScore = criterion.maxScore;

    // Compare to previous score for trend
    const previous = await ReadinessScore.findOne({
      collegeId,
      bodyId,
      criterionId: criterion._id,
      ...(programmeId ? { programmeId } : {}),
    })
      .sort({ computedAt: -1 })
      .lean();

    const previousScore = previous?.score;
    let trend: string;
    if (previousScore === undefined || previousScore === null) {
      trend = 'stable';
    } else if (score > previousScore) {
      trend = 'improving';
    } else if (score < previousScore) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Upsert ReadinessScore
    await ReadinessScore.findOneAndUpdate(
      {
        collegeId,
        bodyId,
        criterionId: criterion._id,
        ...(programmeId ? { programmeId } : {}),
      },
      {
        collegeId,
        bodyId,
        criterionId: criterion._id,
        ...(programmeId ? { programmeId } : {}),
        score,
        maxPossibleScore,
        evidenceCount,
        evidenceWithGaps,
        trend,
        previousScore: previousScore ?? undefined,
        computedAt: new Date(),
        status: 'current',
      },
      { upsert: true, new: true },
    );

    criterionScores.push({
      criterionId,
      score,
      maxPossibleScore,
      evidenceCount,
      evidenceWithGaps,
      trend,
    });
  }

  const overallScore =
    criterionScores.length > 0
      ? Math.round(
          (criterionScores.reduce((sum, c) => sum + c.score, 0) /
            criterionScores.length) *
            100,
        ) / 100
      : 0;

  await createAuditLog({
    collegeId,
    entityType: 'ReadinessScore',
    entityId: bodyId,
    entityName: `Readiness compute for body ${bodyId}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return { criterionScores, overallScore };
}

export async function listReadinessSnapshots(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  return paginate(ReadinessSnapshot, filter, page, limit, { snapshotDate: -1 });
}

export async function createReadinessSnapshot(
  collegeId: string,
  data: { bodyId: string; programmeId?: string; trigger: string; createdBy: string },
  performedBy: string,
) {
  // Get all ReadinessScores for body
  const scoreFilter: Record<string, unknown> = {
    collegeId,
    bodyId: data.bodyId,
    status: 'current',
  };
  const scores = await ReadinessScore.find(scoreFilter).lean();

  // Compute weighted average by criterion weightage
  let totalWeight = 0;
  let weightedSum = 0;
  const criterionScores: Array<{ criterionId: unknown; score: number; maxScore: number }> = [];

  for (const s of scores) {
    // Look up the criterion to get its weightage
    const criterion = await ComplianceCriteria.findOne({
      _id: s.criterionId,
      collegeId,
    }).lean();

    const weight = criterion?.weightage ?? 1;
    weightedSum += s.score * weight;
    totalWeight += weight;

    criterionScores.push({
      criterionId: s.criterionId,
      score: s.score,
      maxScore: s.maxPossibleScore,
    });
  }

  const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  // Predict grade
  let predictedGrade: string;
  if (overallScore >= 75) predictedGrade = 'A++';
  else if (overallScore >= 65) predictedGrade = 'A+';
  else if (overallScore >= 55) predictedGrade = 'A';
  else if (overallScore >= 45) predictedGrade = 'B++';
  else if (overallScore >= 35) predictedGrade = 'B+';
  else predictedGrade = 'B';

  const doc = await ReadinessSnapshot.create({
    collegeId,
    bodyId: data.bodyId,
    programmeId: data.programmeId,
    snapshotDate: new Date(),
    trigger: data.trigger,
    overallScore,
    criterionScores,
    predictedGrade,
    createdBy: data.createdBy,
  });

  await createAuditLog({
    collegeId,
    entityType: 'ReadinessSnapshot',
    entityId: String(doc._id),
    entityName: `Snapshot ${predictedGrade} (${overallScore})`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function getReadinessDashboard(collegeId: string, bodyId: string) {
  // Latest scores per criterion
  const scores = await ReadinessScore.find({
    collegeId,
    bodyId,
    status: 'current',
  }).lean();

  const overallScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 100,
        ) / 100
      : 0;

  const criterionBreakdown = scores.map((s) => ({
    criterionId: s.criterionId,
    score: s.score,
    maxPossibleScore: s.maxPossibleScore,
    evidenceCount: s.evidenceCount,
    evidenceWithGaps: s.evidenceWithGaps,
    trend: s.trend,
  }));

  // Gap counts by severity
  const [criticalGaps, majorGaps, minorGaps] = await Promise.all([
    GapRecord.countDocuments({ collegeId, bodyId, severity: 'critical', status: { $ne: 'resolved' } }),
    GapRecord.countDocuments({ collegeId, bodyId, severity: 'major', status: { $ne: 'resolved' } }),
    GapRecord.countDocuments({ collegeId, bodyId, severity: 'minor', status: { $ne: 'resolved' } }),
  ]);

  return {
    overallScore,
    criterionBreakdown,
    gapsSummary: {
      critical: criticalGaps,
      major: majorGaps,
      minor: minorGaps,
      total: criticalGaps + majorGaps + minorGaps,
    },
  };
}

export async function predictGrade(collegeId: string, bodyId: string) {
  const snapshot = await ReadinessSnapshot.findOne({ collegeId, bodyId })
    .sort({ snapshotDate: -1 })
    .lean();
  if (!snapshot) throw new AppError(404, 'No readiness snapshot found for this body');
  return {
    predictedGrade: snapshot.predictedGrade,
    overallScore: snapshot.overallScore,
    snapshotDate: snapshot.snapshotDate,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Gap Analysis
// ═══════════════════════════════════════════════════════════════

export async function listGaps(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
  severity?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (severity) filter.severity = severity;
  if (status) filter.status = status;
  return paginate(GapRecord, filter, page, limit, { createdAt: -1 });
}

export async function getGap(collegeId: string, id: string) {
  const doc = await GapRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Gap record not found');
  return doc;
}

export async function detectGaps(collegeId: string, bodyId: string, performedBy: string) {
  const criteria = await ComplianceCriteria.find({ collegeId, bodyId }).lean();
  let newGaps = 0;

  for (const criterion of criteria) {
    // Get mandatory evidence mappings
    const mandatoryMappings = await CriterionEvidenceMapping.find({
      collegeId,
      criterionId: criterion._id,
      isMandatory: true,
    }).lean();

    for (const mapping of mandatoryMappings) {
      // Check for missing evidence
      const evidenceExists = await EvidenceRecord.findOne({
        collegeId,
        criterionCode: criterion.criterionNumber,
        evidenceTypeId: mapping.evidenceTypeId,
        status: { $in: ['collected', 'verified'] },
      }).lean();

      if (!evidenceExists) {
        // Check if gap already recorded
        const existingGap = await GapRecord.findOne({
          collegeId,
          bodyId,
          criterionId: criterion._id,
          evidenceTypeId: mapping.evidenceTypeId,
          gapType: 'missing_evidence',
          status: { $nin: ['resolved', 'cancelled'] },
        }).lean();

        if (!existingGap) {
          await GapRecord.create({
            collegeId,
            bodyId,
            criterionId: criterion._id,
            evidenceTypeId: mapping.evidenceTypeId,
            gapType: 'missing_evidence',
            severity: 'critical',
            difficulty: 'moderate',
            description: `Missing mandatory evidence for criterion ${criterion.criterionNumber} - ${criterion.title}`,
            recommendedAction: 'Collect and upload required evidence',
            deadlineUrgency: 'immediate',
            status: 'open',
          });
          newGaps++;
        }
        continue;
      }

      // Check for low quality evidence (composite < 50)
      if (evidenceExists.scores && (evidenceExists.scores.composite ?? 100) < 50) {
        const existingQualityGap = await GapRecord.findOne({
          collegeId,
          bodyId,
          criterionId: criterion._id,
          evidenceTypeId: mapping.evidenceTypeId,
          gapType: 'low_quality',
          status: { $nin: ['resolved', 'cancelled'] },
        }).lean();

        if (!existingQualityGap) {
          await GapRecord.create({
            collegeId,
            bodyId,
            criterionId: criterion._id,
            evidenceTypeId: mapping.evidenceTypeId,
            gapType: 'low_quality',
            severity: 'major',
            difficulty: 'moderate',
            description: `Low quality evidence (composite score: ${evidenceExists.scores.composite}) for criterion ${criterion.criterionNumber}`,
            recommendedAction: 'Improve evidence quality or provide supplementary documentation',
            deadlineUrgency: 'this_quarter',
            status: 'open',
          });
          newGaps++;
        }
      }

      // Check for stale evidence (> 365 days old)
      const evidenceDoc = evidenceExists as unknown as { updatedAt?: Date; createdAt?: Date };
      const updatedAt = evidenceDoc.updatedAt ?? evidenceDoc.createdAt;
      if (updatedAt) {
        const ageMs = Date.now() - new Date(updatedAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > 365) {
          const existingStaleGap = await GapRecord.findOne({
            collegeId,
            bodyId,
            criterionId: criterion._id,
            evidenceTypeId: mapping.evidenceTypeId,
            gapType: 'stale_expired',
            status: { $nin: ['resolved', 'cancelled'] },
          }).lean();

          if (!existingStaleGap) {
            await GapRecord.create({
              collegeId,
              bodyId,
              criterionId: criterion._id,
              evidenceTypeId: mapping.evidenceTypeId,
              gapType: 'stale_expired',
              severity: 'minor',
              difficulty: 'easy',
              description: `Stale evidence (${Math.floor(ageDays)} days old) for criterion ${criterion.criterionNumber}`,
              recommendedAction: 'Refresh evidence with current data',
              deadlineUrgency: 'this_year',
              status: 'open',
            });
            newGaps++;
          }
        }
      }
    }
  }

  const totalGaps = await GapRecord.countDocuments({
    collegeId,
    bodyId,
    status: { $nin: ['resolved', 'cancelled'] },
  });

  await createAuditLog({
    collegeId,
    entityType: 'GapRecord',
    entityId: bodyId,
    entityName: `Gap detection for body ${bodyId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { newGaps, totalGaps };
}

export async function assignGap(
  collegeId: string,
  gapId: string,
  data: { assignedTo: string },
  performedBy: string,
) {
  const doc = await GapRecord.findOneAndUpdate(
    { _id: gapId, collegeId },
    { assignedTo: data.assignedTo, status: 'in_progress' },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Gap record not found');
  await createAuditLog({
    collegeId,
    entityType: 'GapRecord',
    entityId: gapId,
    entityName: doc.description.slice(0, 50),
    action: 'update',
    changes: [{ field: 'assignedTo', displayName: 'Assigned To', oldValue: null, newValue: data.assignedTo }],
    performedBy,
  });
  return doc;
}

export async function updateGapPriority(
  collegeId: string,
  gapId: string,
  data: { priority: number },
  performedBy: string,
) {
  const doc = await GapRecord.findOneAndUpdate(
    { _id: gapId, collegeId },
    { priority: data.priority },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Gap record not found');
  await createAuditLog({
    collegeId,
    entityType: 'GapRecord',
    entityId: gapId,
    entityName: doc.description.slice(0, 50),
    action: 'update',
    changes: [{ field: 'priority', displayName: 'Priority', oldValue: null, newValue: data.priority }],
    performedBy,
  });
  return doc;
}

export async function resolveGap(collegeId: string, gapId: string, performedBy: string) {
  const doc = await GapRecord.findOneAndUpdate(
    { _id: gapId, collegeId, status: { $ne: 'resolved' } },
    { status: 'resolved', resolvedAt: new Date() },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Gap record not found or already resolved');
  await createAuditLog({
    collegeId,
    entityType: 'GapRecord',
    entityId: gapId,
    entityName: doc.description.slice(0, 50),
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'open', newValue: 'resolved' }],
    performedBy,
  });
  return doc;
}

export async function getGapStats(collegeId: string, bodyId?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;

  const [
    criticalCount,
    majorCount,
    minorCount,
    openCount,
    inProgressCount,
    resolvedCount,
    deferredCount,
    missingEvidenceCount,
    lowQualityCount,
    staleExpiredCount,
    incompleteEvidenceCount,
  ] = await Promise.all([
    GapRecord.countDocuments({ ...filter, severity: 'critical' }),
    GapRecord.countDocuments({ ...filter, severity: 'major' }),
    GapRecord.countDocuments({ ...filter, severity: 'minor' }),
    GapRecord.countDocuments({ ...filter, status: 'open' }),
    GapRecord.countDocuments({ ...filter, status: 'in_progress' }),
    GapRecord.countDocuments({ ...filter, status: 'resolved' }),
    GapRecord.countDocuments({ ...filter, status: 'deferred' }),
    GapRecord.countDocuments({ ...filter, gapType: 'missing_evidence' }),
    GapRecord.countDocuments({ ...filter, gapType: 'low_quality' }),
    GapRecord.countDocuments({ ...filter, gapType: 'stale_expired' }),
    GapRecord.countDocuments({ ...filter, gapType: 'incomplete_evidence' }),
  ]);

  return {
    bySeverity: { critical: criticalCount, major: majorCount, minor: minorCount },
    byStatus: { open: openCount, in_progress: inProgressCount, resolved: resolvedCount, deferred: deferredCount },
    byGapType: {
      missing_evidence: missingEvidenceCount,
      low_quality: lowQualityCount,
      stale_expired: staleExpiredCount,
      incomplete_evidence: incompleteEvidenceCount,
    },
    total: criticalCount + majorCount + minorCount,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Remediation
// ═══════════════════════════════════════════════════════════════

export async function listRemediationPlans(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (status) filter.status = status;
  return paginate(RemediationPlan, filter, page, limit, { createdAt: -1 });
}

export async function getRemediationPlan(collegeId: string, id: string) {
  const doc = await RemediationPlan.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Remediation plan not found');
  return doc;
}

export async function createRemediationPlan(
  collegeId: string,
  data: {
    bodyId: string;
    accreditationCycleId?: string;
    title: string;
    targetCompletionDate: Date;
    tasks: Array<{
      gapRecordId?: string;
      description: string;
      assignedTo?: string;
      dueDate: Date;
      priority: string;
    }>;
    createdBy: string;
  },
  performedBy: string,
) {
  const tasks = data.tasks.map((t) => ({
    ...t,
    status: 'pending' as const,
    progress: 0,
  }));

  const doc = await RemediationPlan.create({
    collegeId,
    bodyId: data.bodyId,
    accreditationCycleId: data.accreditationCycleId,
    title: data.title,
    targetCompletionDate: data.targetCompletionDate,
    tasks,
    overallProgress: 0,
    status: 'active',
    createdBy: data.createdBy,
  });

  await createAuditLog({
    collegeId,
    entityType: 'RemediationPlan',
    entityId: String(doc._id),
    entityName: data.title,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateRemediationPlan(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  // Only update top-level fields, not tasks
  const { tasks: _tasks, ...updateData } = data;
  const doc = await RemediationPlan.findOneAndUpdate(
    { _id: id, collegeId },
    updateData,
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Remediation plan not found');
  await createAuditLog({
    collegeId,
    entityType: 'RemediationPlan',
    entityId: id,
    entityName: doc.title,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateRemediationTask(
  collegeId: string,
  planId: string,
  taskIdx: number,
  data: { status?: string; progress?: number; milestones?: string[] },
  performedBy: string,
) {
  const plan = await RemediationPlan.findOne({ _id: planId, collegeId });
  if (!plan) throw new AppError(404, 'Remediation plan not found');
  if (taskIdx < 0 || taskIdx >= plan.tasks.length) {
    throw new AppError(400, 'Invalid task index');
  }

  const task = plan.tasks[taskIdx]!;
  if (data.status !== undefined) task.status = data.status;
  if (data.progress !== undefined) task.progress = data.progress;
  if (data.milestones !== undefined) task.milestones = data.milestones;

  // If stalled, set stalledSince
  if (data.status === 'stalled') {
    task.stalledSince = new Date();
  }

  // Recompute overallProgress = avg of all task progresses
  const totalProgress = plan.tasks.reduce((sum, t) => sum + t.progress, 0);
  plan.overallProgress = Math.round((totalProgress / plan.tasks.length) * 100) / 100;

  // If all tasks completed or verified, set plan status to completed
  const allDone = plan.tasks.every(
    (t) => t.status === 'completed' || t.status === 'verified',
  );
  if (allDone) {
    plan.status = 'completed';
  }

  await plan.save();

  await createAuditLog({
    collegeId,
    entityType: 'RemediationPlan',
    entityId: planId,
    entityName: `${plan.title} - Task ${taskIdx}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return plan;
}

export async function verifyRemediationTask(
  collegeId: string,
  planId: string,
  taskIdx: number,
  data: { verifiedBy: string },
  performedBy: string,
) {
  const plan = await RemediationPlan.findOne({ _id: planId, collegeId });
  if (!plan) throw new AppError(404, 'Remediation plan not found');
  if (taskIdx < 0 || taskIdx >= plan.tasks.length) {
    throw new AppError(400, 'Invalid task index');
  }

  const task = plan.tasks[taskIdx]!;
  task.status = 'verified';
  task.verifiedBy = data.verifiedBy as any;
  task.verifiedAt = new Date();
  task.progress = 100;

  // Recompute overallProgress
  const totalProgress = plan.tasks.reduce((sum, t) => sum + t.progress, 0);
  plan.overallProgress = Math.round((totalProgress / plan.tasks.length) * 100) / 100;

  // If all tasks completed or verified, set plan status to completed
  const allDone = plan.tasks.every(
    (t) => t.status === 'completed' || t.status === 'verified',
  );
  if (allDone) {
    plan.status = 'completed';
  }

  await plan.save();

  await createAuditLog({
    collegeId,
    entityType: 'RemediationPlan',
    entityId: planId,
    entityName: `${plan.title} - Task ${taskIdx} verified`,
    action: 'update',
    changes: [{ field: 'taskStatus', displayName: 'Task Status', oldValue: null, newValue: 'verified' }],
    performedBy,
  });

  return plan;
}

export async function closeRemediationPlan(
  collegeId: string,
  planId: string,
  data: { effectiveness?: string; lessonsLearned?: string },
  performedBy: string,
) {
  const doc = await RemediationPlan.findOneAndUpdate(
    { _id: planId, collegeId },
    {
      status: 'completed',
      ...(data.effectiveness ? { effectiveness: data.effectiveness } : {}),
      ...(data.lessonsLearned ? { lessonsLearned: data.lessonsLearned } : {}),
    },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Remediation plan not found');

  await createAuditLog({
    collegeId,
    entityType: 'RemediationPlan',
    entityId: planId,
    entityName: doc.title,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'active', newValue: 'completed' }],
    performedBy,
  });

  return doc;
}

export async function getRemediationProgress(collegeId: string, planId: string) {
  const plan = await RemediationPlan.findOne({ _id: planId, collegeId });
  if (!plan) throw new AppError(404, 'Remediation plan not found');

  const totalTasks = plan.tasks.length;
  let completed = 0;
  let stalled = 0;
  let verified = 0;
  let pending = 0;
  let inProgress = 0;

  for (const task of plan.tasks) {
    switch (task.status) {
      case 'completed':
        completed++;
        break;
      case 'stalled':
        stalled++;
        break;
      case 'verified':
        verified++;
        break;
      case 'pending':
        pending++;
        break;
      case 'in_progress':
        inProgress++;
        break;
    }
  }

  return {
    planId: String(plan._id),
    title: plan.title,
    status: plan.status,
    totalTasks,
    pending,
    inProgress,
    completed,
    stalled,
    verified,
    overallProgress: plan.overallProgress,
    targetCompletionDate: plan.targetCompletionDate,
  };
}
