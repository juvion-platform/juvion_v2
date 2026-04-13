import { FDPRecord } from '../../models/hr/FDPRecord';
import { FDPComplianceSummary } from '../../models/hr/FDPComplianceSummary';
import { AppraisalCycle } from '../../models/hr/AppraisalCycle';
import { Appraisal } from '../../models/hr/Appraisal';
import { Employee } from '../../models/hr/Employee';
import { Promotion } from '../../models/hr/Promotion';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// FDP Workflow (W05-L2-034 to W05-L2-039)
// ---------------------------------------------------------------------------

/** W05-L2-034: Submit an FDP certificate for verification */
export async function submitFDPCertificate(
  collegeId: string,
  data: {
    facultyId: string;
    activityType: 'fdp' | 'workshop' | 'seminar' | 'conference' | 'certification';
    title: string;
    organiser: string;
    startDate: string;
    endDate: string;
    hours: number;
    certificateUrl?: string;
    complianceYear: number;
  },
  performedBy: string,
) {
  const doc = await FDPRecord.create({
    collegeId,
    ...data,
    verificationStatus: 'pending',
  });

  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'create',
    changes: [{ field: 'verificationStatus', displayName: 'Verification Status', oldValue: null, newValue: 'pending' }],
    performedBy,
  });

  return doc;
}

/** W05-L2-035: OCR-extract data from an FDP certificate (stub) */
export async function ocrExtractFDP(
  collegeId: string,
  fdpRecordId: string,
  _performedBy: string,
) {
  const doc = await FDPRecord.findOne({ _id: fdpRecordId, collegeId });
  if (!doc) throw new AppError(404, 'FDP record not found');

  // Stub: simulate OCR extraction
  const ocrConfidence = Math.round((0.7 + Math.random() * 0.29) * 100) / 100;
  const ocrExtractedData = {
    title: doc.title,
    organiser: doc.organiser,
    startDate: doc.startDate,
    endDate: doc.endDate,
    hours: doc.hours,
    extractedAt: new Date().toISOString(),
  };

  doc.ocrExtractedData = ocrExtractedData;
  doc.ocrConfidence = ocrConfidence;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [
      { field: 'ocrConfidence', displayName: 'OCR Confidence', oldValue: null, newValue: ocrConfidence },
      { field: 'ocrExtractedData', displayName: 'OCR Extracted Data', oldValue: null, newValue: 'extracted' },
    ],
    performedBy: _performedBy,
  });

  return doc;
}

/** W05-L2-036: Verify or reject an FDP certificate */
export async function verifyFDPCertificate(
  collegeId: string,
  fdpRecordId: string,
  data: { status: 'verified' | 'rejected'; remarks?: string },
  performedBy: string,
) {
  const doc = await FDPRecord.findOne({ _id: fdpRecordId, collegeId });
  if (!doc) throw new AppError(404, 'FDP record not found');

  const oldStatus = doc.verificationStatus;

  // Check for duplicates: same facultyId + title + organiser + startDate
  if (data.status === 'verified') {
    const duplicate = await FDPRecord.findOne({
      collegeId,
      facultyId: doc.facultyId,
      title: doc.title,
      organiser: doc.organiser,
      startDate: doc.startDate,
      _id: { $ne: doc._id },
      verificationStatus: 'verified',
    });
    if (duplicate) {
      doc.isDuplicate = true;
    }
  }

  doc.verificationStatus = data.status;
  doc.verifiedBy = performedBy as any;
  doc.verifiedAt = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [
      { field: 'verificationStatus', displayName: 'Verification Status', oldValue: oldStatus, newValue: data.status },
      ...(data.remarks ? [{ field: 'remarks', displayName: 'Remarks', oldValue: null, newValue: data.remarks }] : []),
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-037: Compute FDP compliance gap for a faculty member */
export async function computeFDPComplianceGap(
  collegeId: string,
  facultyId: string,
  academicYearId: string,
  performedBy: string,
) {
  // Sum verified FDP hours for this faculty
  const verifiedRecords = await FDPRecord.find({
    collegeId,
    facultyId,
    verificationStatus: 'verified',
  });
  const completedHours = verifiedRecords.reduce((sum, r) => sum + r.hours, 0);

  // Determine cadre from Employee designation
  const employee = await Employee.findOne({ _id: facultyId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const designation = (employee.designation || '').toLowerCase();
  let cadre: 'assistant_professor' | 'associate_professor' | 'professor';
  let requiredHours: number;

  if (designation.includes('associate professor') || designation.includes('associate_professor')) {
    cadre = 'associate_professor';
    requiredHours = 30;
  } else if (designation.includes('professor') && !designation.includes('assistant')) {
    cadre = 'professor';
    requiredHours = 20;
  } else {
    cadre = 'assistant_professor';
    requiredHours = 40;
  }

  const gap = Math.max(0, requiredHours - completedHours);
  let complianceStatus: 'compliant' | 'partial' | 'non_compliant';
  if (gap === 0) {
    complianceStatus = 'compliant';
  } else if (completedHours > 0) {
    complianceStatus = 'partial';
  } else {
    complianceStatus = 'non_compliant';
  }

  const summary = await FDPComplianceSummary.findOneAndUpdate(
    { collegeId, facultyId, academicYearId },
    {
      collegeId,
      facultyId,
      academicYearId,
      cadre,
      requiredHours,
      completedHours,
      gap,
      complianceStatus,
      lastComputedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'FDPComplianceSummary',
    entityId: String(summary._id),
    entityName: `FDP Compliance - ${employee.employeeId}`,
    action: 'update',
    changes: [
      { field: 'completedHours', displayName: 'Completed Hours', oldValue: null, newValue: completedHours },
      { field: 'gap', displayName: 'Gap', oldValue: null, newValue: gap },
      { field: 'complianceStatus', displayName: 'Compliance Status', oldValue: null, newValue: complianceStatus },
    ],
    performedBy,
  });

  return summary;
}

/** W05-L2-038: Nudge faculty with FDP shortfall (stub) */
export async function nudgeFDPShortfall(
  collegeId: string,
  academicYearId: string,
) {
  const shortfalls = await FDPComplianceSummary.find({
    collegeId,
    academicYearId,
    gap: { $gt: 0 },
  }).populate({ path: 'facultyId', populate: { path: 'personId' } });

  // Stub: just return the list — no actual notification sent
  return {
    count: shortfalls.length,
    facultyNeedingNudge: shortfalls.map((s) => ({
      facultyId: String(s.facultyId),
      gap: s.gap,
      completedHours: s.completedHours,
      requiredHours: s.requiredHours,
      complianceStatus: s.complianceStatus,
    })),
  };
}

/** W05-L2-039: Report FDP compliance to compliance module (stub) */
export async function reportFDPToCompliance(
  collegeId: string,
  academicYearId: string,
) {
  const summaries = await FDPComplianceSummary.find({ collegeId, academicYearId });

  const compliant = summaries.filter((s) => s.complianceStatus === 'compliant').length;
  const partial = summaries.filter((s) => s.complianceStatus === 'partial').length;
  const nonCompliant = summaries.filter((s) => s.complianceStatus === 'non_compliant').length;

  // Stub: return summary for M10 compliance push
  return {
    academicYearId,
    totalFaculty: summaries.length,
    compliant,
    partial,
    nonCompliant,
    complianceRate: summaries.length > 0 ? Math.round((compliant / summaries.length) * 100) : 0,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Appraisal Workflow (W05-L2-040 to W05-L2-049)
// ---------------------------------------------------------------------------

/** W05-L2-040: Configure an appraisal cycle */
export async function configureAppraisalCycle(
  collegeId: string,
  data: {
    academicYearId: string;
    name: string;
    startDate: string;
    endDate: string;
    selfAssessmentDeadline: string;
    reviewerDeadline: string;
    moderationDeadline: string;
    applicableTo: 'faculty' | 'staff' | 'both';
    weightageTemplate?: Record<string, number>;
  },
  performedBy: string,
) {
  const doc = await AppraisalCycle.create({
    collegeId,
    ...data,
    status: 'configured',
  });

  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'configured' }],
    performedBy,
  });

  return doc;
}

/** W05-L2-041: Initiate an appraisal cycle — bulk-create appraisals */
export async function initiateAppraisalCycle(
  collegeId: string,
  cycleId: string,
  performedBy: string,
) {
  const cycle = await AppraisalCycle.findOne({ _id: cycleId, collegeId });
  if (!cycle) throw new AppError(404, 'Appraisal cycle not found');
  if (cycle.status !== 'configured') throw new AppError(400, 'Cycle must be in configured state to initiate');

  // Determine which employees are eligible
  const employeeFilter: Record<string, unknown> = { collegeId, status: 'active' };
  if (cycle.applicableTo === 'faculty') {
    employeeFilter.employeeType = 'teaching';
  } else if (cycle.applicableTo === 'staff') {
    employeeFilter.employeeType = { $in: ['non_teaching', 'contract'] };
  }
  // 'both' => all active employees

  const employees = await Employee.find(employeeFilter);

  const appraisalDocs = employees.map((emp) => ({
    collegeId,
    employeeId: emp._id,
    academicYearId: cycle.academicYearId,
    reviewerId: emp.reportingToId || emp._id, // fallback to self if no manager
    appraisalCycleId: cycle._id,
    appraisalType: (emp.employeeType === 'teaching' ? 'faculty' : 'staff') as 'faculty' | 'staff',
    status: 'self_assessment_pending',
  }));

  const created = await Appraisal.insertMany(appraisalDocs);

  cycle.status = 'open';
  await cycle.save();

  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(cycle._id),
    entityName: cycle.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'configured', newValue: 'open' },
      { field: 'appraisalsCreated', displayName: 'Appraisals Created', oldValue: 0, newValue: created.length },
    ],
    performedBy,
  });

  return { cycle, appraisalsCreated: created.length };
}

/** W05-L2-042: Submit self-assessment for an appraisal */
export async function submitSelfAssessment(
  collegeId: string,
  appraisalId: string,
  data: { selfRating: number; selfAssessmentData: Record<string, unknown> },
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.status !== 'self_assessment_pending') throw new AppError(400, 'Appraisal is not awaiting self-assessment');

  const oldStatus = doc.status;
  doc.selfRating = data.selfRating;
  doc.selfAssessmentData = data.selfAssessmentData;
  doc.status = 'self_assessment_complete';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'selfRating', displayName: 'Self Rating', oldValue: null, newValue: data.selfRating },
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'self_assessment_complete' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-043: Aggregate faculty appraisal data from multiple modules (stub) */
export async function aggregateFacultyAppraisalData(
  collegeId: string,
  appraisalId: string,
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.status !== 'self_assessment_complete') throw new AppError(400, 'Self-assessment must be completed first');

  // Stub: generate simulated aggregated data with weighted sources
  const sources = [
    { source: 'teaching_feedback', module: 'academics', data: { score: 4.2 }, weight: 0.35 },
    { source: 'research_output', module: 'hr', data: { publications: 3, projects: 1 }, weight: 0.175 },
    { source: 'fdp_compliance', module: 'hr', data: { hours: 35, compliant: true }, weight: 0.125 },
    { source: 'advisory_duties', module: 'academics', data: { menteesCount: 15 }, weight: 0.075 },
    { source: 'mentoring', module: 'student_dev', data: { sessions: 12 }, weight: 0.075 },
    { source: 'attendance', module: 'hr', data: { percentage: 92 }, weight: 0.075 },
    { source: 'self_assessment', module: 'hr', data: { rating: doc.selfRating }, weight: 0.125 },
  ];

  const aggregatedScore = sources.reduce((total, s) => {
    const raw = typeof (s.data as Record<string, unknown>).score === 'number'
      ? (s.data as Record<string, unknown>).score as number
      : typeof (s.data as Record<string, unknown>).rating === 'number'
        ? (s.data as Record<string, unknown>).rating as number
        : typeof (s.data as Record<string, unknown>).percentage === 'number'
          ? ((s.data as Record<string, unknown>).percentage as number) / 20
          : 3.5; // default stub
    return total + raw * s.weight;
  }, 0);

  doc.aggregatedSources = sources;
  doc.aggregatedData = { aggregatedScore: Math.round(aggregatedScore * 100) / 100, sources: sources.length };
  doc.status = 'aggregation_complete';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'self_assessment_complete', newValue: 'aggregation_complete' },
      { field: 'aggregatedData', displayName: 'Aggregated Data', oldValue: null, newValue: 'computed' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-044: Aggregate staff appraisal data (stub) */
export async function aggregateStaffAppraisalData(
  collegeId: string,
  appraisalId: string,
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.status !== 'self_assessment_complete') throw new AppError(400, 'Self-assessment must be completed first');

  // Stub: generate simulated staff data (attendance 30%, training 20%, duty 50%)
  const sources = [
    { source: 'attendance', module: 'hr', data: { percentage: 95 }, weight: 0.30 },
    { source: 'training_completion', module: 'hr', data: { completed: 3, required: 4 }, weight: 0.20 },
    { source: 'duty_performance', module: 'hr', data: { rating: 3.8 }, weight: 0.50 },
  ];

  const aggregatedScore = sources.reduce((total, s) => {
    const raw = typeof (s.data as Record<string, unknown>).rating === 'number'
      ? (s.data as Record<string, unknown>).rating as number
      : typeof (s.data as Record<string, unknown>).percentage === 'number'
        ? ((s.data as Record<string, unknown>).percentage as number) / 20
        : 3.5;
    return total + raw * s.weight;
  }, 0);

  doc.aggregatedSources = sources;
  doc.aggregatedData = { aggregatedScore: Math.round(aggregatedScore * 100) / 100, sources: sources.length };
  doc.status = 'aggregation_complete';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'self_assessment_complete', newValue: 'aggregation_complete' },
      { field: 'aggregatedData', displayName: 'Aggregated Data', oldValue: null, newValue: 'computed' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-045: Submit reviewer assessment */
export async function submitReviewerAssessment(
  collegeId: string,
  appraisalId: string,
  data: { reviewerRating: number; reviewerComments: string },
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.status !== 'aggregation_complete') throw new AppError(400, 'Data aggregation must be completed first');

  const oldStatus = doc.status;
  doc.reviewerRating = data.reviewerRating;
  doc.reviewerComments = data.reviewerComments;
  doc.status = 'reviewer_complete';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'reviewerRating', displayName: 'Reviewer Rating', oldValue: null, newValue: data.reviewerRating },
      { field: 'reviewerComments', displayName: 'Reviewer Comments', oldValue: null, newValue: data.reviewerComments },
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'reviewer_complete' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-046: Moderate appraisal ratings */
export async function moderateAppraisalRatings(
  collegeId: string,
  appraisalId: string,
  data: { moderationAdjustment: number },
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.status !== 'reviewer_complete') throw new AppError(400, 'Reviewer assessment must be completed first');

  const oldStatus = doc.status;
  doc.moderationAdjustment = data.moderationAdjustment;
  doc.finalRating = (doc.reviewerRating || 0) + data.moderationAdjustment;
  doc.moderatedBy = performedBy as any;
  doc.status = 'moderated';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'moderationAdjustment', displayName: 'Moderation Adjustment', oldValue: null, newValue: data.moderationAdjustment },
      { field: 'finalRating', displayName: 'Final Rating', oldValue: null, newValue: doc.finalRating },
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'moderated' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-047: Finalize all appraisal ratings for a cycle */
export async function finalizeAppraisalRatings(
  collegeId: string,
  cycleId: string,
  performedBy: string,
) {
  const cycle = await AppraisalCycle.findOne({ _id: cycleId, collegeId });
  if (!cycle) throw new AppError(404, 'Appraisal cycle not found');

  const result = await Appraisal.updateMany(
    { collegeId, appraisalCycleId: cycleId, status: 'moderated' },
    { $set: { status: 'finalized' } },
  );

  cycle.status = 'closed';
  await cycle.save();

  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(cycle._id),
    entityName: cycle.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: cycle.status, newValue: 'closed' },
      { field: 'finalized', displayName: 'Appraisals Finalized', oldValue: 0, newValue: result.modifiedCount },
    ],
    performedBy,
  });

  return { cycle, appraisalsFinalized: result.modifiedCount };
}

/** W05-L2-048: Handle a rating dispute */
export async function handleRatingDispute(
  collegeId: string,
  appraisalId: string,
  data: { disputeText: string },
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');

  const oldStatus = doc.status;
  doc.disputeStatus = 'pending';
  doc.disputeText = data.disputeText;
  doc.status = 'disputed';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'disputeStatus', displayName: 'Dispute Status', oldValue: 'none', newValue: 'pending' },
      { field: 'disputeText', displayName: 'Dispute Text', oldValue: null, newValue: data.disputeText },
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'disputed' },
    ],
    performedBy,
  });

  return doc;
}

/** W05-L2-049: Resolve a rating dispute */
export async function resolveRatingDispute(
  collegeId: string,
  appraisalId: string,
  data: { resolution: 'confirmed' | 'revised'; revisedRating?: number },
  performedBy: string,
) {
  const doc = await Appraisal.findOne({ _id: appraisalId, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  if (doc.disputeStatus !== 'pending') throw new AppError(400, 'No pending dispute to resolve');

  const oldRating = doc.finalRating;
  if (data.resolution === 'revised' && data.revisedRating !== undefined) {
    doc.finalRating = data.revisedRating;
  }

  doc.disputeStatus = 'resolved';
  doc.disputeResolvedBy = performedBy as any;
  doc.status = 'dispute_resolved';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Appraisal',
    entityId: String(doc._id),
    entityName: `Appraisal ${String(doc.employeeId)}`,
    action: 'update',
    changes: [
      { field: 'disputeStatus', displayName: 'Dispute Status', oldValue: 'pending', newValue: 'resolved' },
      { field: 'resolution', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
      ...(data.resolution === 'revised' ? [{ field: 'finalRating', displayName: 'Final Rating', oldValue: oldRating, newValue: data.revisedRating }] : []),
      { field: 'status', displayName: 'Status', oldValue: 'disputed', newValue: 'dispute_resolved' },
    ],
    performedBy,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Promotion/PIP Recommendations (W05-L2-049b)
// ---------------------------------------------------------------------------

/** Generate promotion/PIP recommendations from finalized appraisals */
export async function generatePromotionPIPRecommendations(
  collegeId: string,
  cycleId: string,
  performedBy: string,
) {
  const appraisals = await Appraisal.find({
    collegeId,
    appraisalCycleId: cycleId,
    status: { $in: ['finalized', 'dispute_resolved'] },
    finalRating: { $ne: null },
  }).sort({ finalRating: -1 });

  if (appraisals.length === 0) throw new AppError(400, 'No finalized appraisals found for this cycle');

  const topCutoff = Math.max(1, Math.ceil(appraisals.length * 0.1));
  const bottomCutoff = Math.max(1, Math.ceil(appraisals.length * 0.1));

  const promotions: string[] = [];
  const pips: string[] = [];
  const standardIncrements: string[] = [];

  for (let i = 0; i < appraisals.length; i++) {
    const appraisal = appraisals[i]!;

    if (i < topCutoff) {
      // Top 10% -> promotion
      appraisal.outcomeType = 'promotion';
      await appraisal.save();

      // Create a Promotion record
      const employee = await Employee.findOne({ _id: appraisal.employeeId, collegeId });
      if (employee) {
        const promo = await Promotion.create({
          collegeId,
          employeeId: employee._id,
          fromDesignation: employee.designation,
          toDesignation: `Senior ${employee.designation}`,
          effectiveDate: new Date(),
          remarks: `Auto-recommended from appraisal cycle. Final rating: ${appraisal.finalRating}`,
          appraisalId: appraisal._id,
          status: 'proposed',
        });
        promotions.push(String(promo._id));
      }
    } else if (i >= appraisals.length - bottomCutoff) {
      // Bottom 10% -> pip
      appraisal.outcomeType = 'pip';
      await appraisal.save();
      pips.push(String(appraisal._id));
    } else {
      // Rest -> standard increment
      appraisal.outcomeType = 'standard_increment';
      await appraisal.save();
      standardIncrements.push(String(appraisal._id));
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: cycleId,
    entityName: `Promotion/PIP Recommendations`,
    action: 'create',
    changes: [
      { field: 'promotions', displayName: 'Promotions', oldValue: 0, newValue: promotions.length },
      { field: 'pips', displayName: 'PIPs', oldValue: 0, newValue: pips.length },
      { field: 'standardIncrements', displayName: 'Standard Increments', oldValue: 0, newValue: standardIncrements.length },
    ],
    performedBy,
  });

  return {
    totalAppraised: appraisals.length,
    promotions: promotions.length,
    pips: pips.length,
    standardIncrements: standardIncrements.length,
    promotionIds: promotions,
    pipAppraisalIds: pips,
  };
}

// ---------------------------------------------------------------------------
// CRUD — FDPRecord
// ---------------------------------------------------------------------------

export async function listFDPRecords(
  collegeId: string,
  page: number,
  limit: number,
  facultyId?: string,
  verificationStatus?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (facultyId) filter.facultyId = facultyId;
  if (verificationStatus) filter.verificationStatus = verificationStatus;
  return paginate(FDPRecord, filter, page, limit);
}

export async function getFDPRecord(collegeId: string, id: string) {
  const doc = await FDPRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'FDP record not found');
  return doc;
}

export async function createFDPRecord(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await FDPRecord.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateFDPRecord(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await FDPRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'FDP record not found');
  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteFDPRecord(collegeId: string, id: string, performedBy: string) {
  const doc = await FDPRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'FDP record not found');
  await createAuditLog({
    collegeId,
    entityType: 'FDPRecord',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return { message: 'FDP record deleted' };
}

// ---------------------------------------------------------------------------
// CRUD — FDPComplianceSummary
// ---------------------------------------------------------------------------

export async function listFDPComplianceSummaries(
  collegeId: string,
  page: number,
  limit: number,
  facultyId?: string,
  academicYearId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (facultyId) filter.facultyId = facultyId;
  if (academicYearId) filter.academicYearId = academicYearId;
  return paginate(FDPComplianceSummary, filter, page, limit);
}

export async function getFDPComplianceSummary(collegeId: string, id: string) {
  const doc = await FDPComplianceSummary.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'FDP compliance summary not found');
  return doc;
}

export async function createFDPComplianceSummary(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await FDPComplianceSummary.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'FDPComplianceSummary',
    entityId: String(doc._id),
    entityName: `FDP Compliance ${String(doc.facultyId)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateFDPComplianceSummary(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await FDPComplianceSummary.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'FDP compliance summary not found');
  await createAuditLog({
    collegeId,
    entityType: 'FDPComplianceSummary',
    entityId: String(doc._id),
    entityName: `FDP Compliance ${String(doc.facultyId)}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteFDPComplianceSummary(collegeId: string, id: string, performedBy: string) {
  const doc = await FDPComplianceSummary.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'FDP compliance summary not found');
  await createAuditLog({
    collegeId,
    entityType: 'FDPComplianceSummary',
    entityId: String(doc._id),
    entityName: `FDP Compliance ${String(doc.facultyId)}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return { message: 'FDP compliance summary deleted' };
}

// ---------------------------------------------------------------------------
// CRUD — AppraisalCycle
// ---------------------------------------------------------------------------

export async function listAppraisalCycles(
  collegeId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(AppraisalCycle, filter, page, limit);
}

export async function getAppraisalCycle(collegeId: string, id: string) {
  const doc = await AppraisalCycle.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal cycle not found');
  return doc;
}

export async function createAppraisalCycle(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await AppraisalCycle.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateAppraisalCycle(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await AppraisalCycle.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Appraisal cycle not found');
  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteAppraisalCycle(collegeId: string, id: string, performedBy: string) {
  const doc = await AppraisalCycle.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal cycle not found');
  await createAuditLog({
    collegeId,
    entityType: 'AppraisalCycle',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return { message: 'Appraisal cycle deleted' };
}
