import { AccreditationReport } from '../../models/compliance/AccreditationReport';
import { ReportSection } from '../../models/compliance/ReportSection';
import { ReportTemplate } from '../../models/compliance/ReportTemplate';
import { SubmissionArtifact } from '../../models/compliance/SubmissionArtifact';
import { AccreditationCycle } from '../../models/compliance/AccreditationCycle';
import { RegulatoryFiling } from '../../models/compliance/RegulatoryFiling';
import { AuditFinding } from '../../models/compliance/AuditFinding';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══════════════════════════════════════════════════════════════
//  Report Template CRUD
// ═══════════════════════════════════════════════════════════════

export async function listReportTemplates(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
  reportType?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (reportType) filter.reportType = reportType;
  return paginate(ReportTemplate, filter, page, limit, { createdAt: -1 });
}

export async function getReportTemplate(collegeId: string, id: string) {
  const doc = await ReportTemplate.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Report template not found');
  return doc;
}

export async function createReportTemplate(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await ReportTemplate.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'ReportTemplate',
    entityId: String(doc._id),
    entityName: `${String(doc.reportType)} v${String(doc.version)}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══════════════════════════════════════════════════════════════
//  Report Lifecycle
// ═══════════════════════════════════════════════════════════════

export async function listReports(
  collegeId: string,
  page = 1,
  limit = 20,
  bodyId?: string,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (status) filter.status = status;
  return paginate(AccreditationReport, filter, page, limit, { createdAt: -1 }, [
    { path: 'bodyId' },
    { path: 'accreditationCycleId' },
  ]);
}

export async function getReport(collegeId: string, id: string) {
  const report = await AccreditationReport.findOne({ _id: id, collegeId })
    .populate('bodyId')
    .populate('accreditationCycleId');
  if (!report) throw new AppError(404, 'Accreditation report not found');

  const sections = await ReportSection.find({ collegeId, reportId: id })
    .sort({ sectionNumber: 1 })
    .populate('evidenceRecordIds');

  return { ...report.toObject(), sections };
}

export async function initiateReport(
  collegeId: string,
  data: {
    bodyId: string;
    accreditationCycleId: string;
    programmeId?: string;
    reportType: string;
    templateId?: string;
    assessmentPeriod: { from: Date; to: Date };
  },
  performedBy: string,
) {
  const report = await AccreditationReport.create({
    collegeId,
    bodyId: data.bodyId,
    accreditationCycleId: data.accreditationCycleId,
    programmeId: data.programmeId,
    reportType: data.reportType,
    templateId: data.templateId,
    assessmentPeriod: data.assessmentPeriod,
    status: 'initiated',
  });

  // Auto-create section stubs from template
  if (data.templateId) {
    const template = await ReportTemplate.findOne({ _id: data.templateId, collegeId });
    if (template && template.sections.length > 0) {
      const sectionDocs = template.sections.map((sec) => ({
        collegeId,
        reportId: report._id,
        criterionId: sec.criterionId,
        sectionNumber: sec.sectionNumber,
        title: sec.title,
        sectionType: sec.sectionType,
        generationMethod: 'template_filled' as const,
        status: 'draft',
        version: 1,
        evidenceRecordIds: [],
      }));
      await ReportSection.insertMany(sectionDocs);
    }
  }

  // Update cycle: set reportId and transition to report_drafting if collecting evidence
  const cycle = await AccreditationCycle.findOne({
    _id: data.accreditationCycleId,
    collegeId,
  });
  if (cycle) {
    cycle.reportId = report._id as any;
    if (cycle.status === 'evidence_collection') {
      cycle.status = 'report_drafting';
    }
    await cycle.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'AccreditationReport',
    entityId: String(report._id),
    entityName: `${data.reportType} report`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return report;
}

export async function generateSection(
  collegeId: string,
  reportId: string,
  sectionId: string,
  performedBy: string,
) {
  const section = await ReportSection.findOne({ _id: sectionId, reportId, collegeId });
  if (!section) throw new AppError(404, 'Report section not found');

  // AI placeholder: set content to placeholder text
  section.content = `[AI-generated content placeholder for section "${section.title}". This will be replaced by the AI generation engine.]`;
  section.generationMethod = 'ai_generated';
  await section.save();

  await createAuditLog({
    collegeId,
    entityType: 'ReportSection',
    entityId: String(section._id),
    entityName: section.title,
    action: 'update',
    changes: [{ field: 'generationMethod', displayName: 'Generation Method', oldValue: null, newValue: 'ai_generated' }],
    performedBy,
  });

  return section;
}

export async function updateSection(
  collegeId: string,
  reportId: string,
  sectionId: string,
  data: { content?: string; tables?: unknown; evidenceRecordIds?: string[] },
  performedBy: string,
) {
  const section = await ReportSection.findOne({ _id: sectionId, reportId, collegeId });
  if (!section) throw new AppError(404, 'Report section not found');

  if (data.content !== undefined) section.content = data.content;
  if (data.tables !== undefined) section.tables = data.tables;
  if (data.evidenceRecordIds !== undefined) section.evidenceRecordIds = data.evidenceRecordIds as any;
  await section.save();

  await createAuditLog({
    collegeId,
    entityType: 'ReportSection',
    entityId: String(section._id),
    entityName: section.title,
    action: 'update',
    changes: [],
    performedBy,
  });

  return section;
}

export async function reviewSection(
  collegeId: string,
  reportId: string,
  sectionId: string,
  data: { reviewedBy: string; reviewNotes?: string },
  performedBy: string,
) {
  const section = await ReportSection.findOne({ _id: sectionId, reportId, collegeId });
  if (!section) throw new AppError(404, 'Report section not found');

  section.reviewedBy = data.reviewedBy as any;
  if (data.reviewNotes !== undefined) section.reviewNotes = data.reviewNotes;
  section.status = 'review';
  await section.save();

  await createAuditLog({
    collegeId,
    entityType: 'ReportSection',
    entityId: String(section._id),
    entityName: section.title,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'review' }],
    performedBy,
  });

  return section;
}

export async function approveSection(
  collegeId: string,
  reportId: string,
  sectionId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const section = await ReportSection.findOne({ _id: sectionId, reportId, collegeId });
  if (!section) throw new AppError(404, 'Report section not found');

  const oldStatus = section.status;
  section.status = 'approved';
  section.approvedBy = data.approvedBy as any;
  section.approvedAt = new Date();
  await section.save();

  // Recompute report completionPercentage
  const totalSections = await ReportSection.countDocuments({ reportId, collegeId });
  const approvedSections = await ReportSection.countDocuments({ reportId, collegeId, status: 'approved' });
  const completionPercentage = totalSections > 0 ? Math.round((approvedSections / totalSections) * 100) : 0;

  await AccreditationReport.updateOne({ _id: reportId, collegeId }, { completionPercentage });

  await createAuditLog({
    collegeId,
    entityType: 'ReportSection',
    entityId: String(section._id),
    entityName: section.title,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' }],
    performedBy,
  });

  return section;
}

export async function requestSectionRevision(
  collegeId: string,
  reportId: string,
  sectionId: string,
  data: { reviewNotes: string },
  performedBy: string,
) {
  const section = await ReportSection.findOne({ _id: sectionId, reportId, collegeId });
  if (!section) throw new AppError(404, 'Report section not found');

  const oldStatus = section.status;
  section.status = 'revision_requested';
  section.reviewNotes = data.reviewNotes;
  section.version = (section.version || 1) + 1;
  await section.save();

  await createAuditLog({
    collegeId,
    entityType: 'ReportSection',
    entityId: String(section._id),
    entityName: section.title,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'revision_requested' },
      { field: 'version', displayName: 'Version', oldValue: section.version - 1, newValue: section.version },
    ],
    performedBy,
  });

  return section;
}

export async function approveReport(
  collegeId: string,
  reportId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const report = await AccreditationReport.findOne({ _id: reportId, collegeId });
  if (!report) throw new AppError(404, 'Accreditation report not found');

  // Verify all sections are approved
  const totalSections = await ReportSection.countDocuments({ reportId, collegeId });
  const approvedSections = await ReportSection.countDocuments({ reportId, collegeId, status: 'approved' });

  if (totalSections === 0) {
    throw new AppError(400, 'Report has no sections');
  }
  if (approvedSections < totalSections) {
    throw new AppError(400, `Not all sections are approved (${approvedSections}/${totalSections})`);
  }

  const oldStatus = report.status;
  report.approvedBy = data.approvedBy as any;
  report.approvedAt = new Date();
  report.status = 'approved';
  await report.save();

  await createAuditLog({
    collegeId,
    entityType: 'AccreditationReport',
    entityId: String(report._id),
    entityName: `${report.reportType} report`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' }],
    performedBy,
  });

  return report;
}

// ═══════════════════════════════════════════════════════════════
//  Assembly + Submission
// ═══════════════════════════════════════════════════════════════

export async function assembleReport(
  collegeId: string,
  reportId: string,
  performedBy: string,
) {
  const report = await AccreditationReport.findOne({ _id: reportId, collegeId });
  if (!report) throw new AppError(404, 'Accreditation report not found');

  // Verify all sections approved
  const totalSections = await ReportSection.countDocuments({ reportId, collegeId });
  const approvedSections = await ReportSection.countDocuments({ reportId, collegeId, status: 'approved' });

  if (totalSections === 0) {
    throw new AppError(400, 'Report has no sections');
  }
  if (approvedSections < totalSections) {
    throw new AppError(400, `Not all sections are approved (${approvedSections}/${totalSections})`);
  }

  // Create submission artifact with status='generating'
  const artifact = await SubmissionArtifact.create({
    collegeId,
    reportId,
    artifactType: 'pdf',
    fileName: `${report.reportType}_report_${String(report._id).slice(-8)}.pdf`,
    generatedBy: performedBy,
    status: 'generating',
  });

  // Placeholder: immediately set to 'ready'
  artifact.status = 'ready';
  await artifact.save();

  // Link artifact to report
  report.submissionArtifactId = artifact._id as any;
  await report.save();

  await createAuditLog({
    collegeId,
    entityType: 'SubmissionArtifact',
    entityId: String(artifact._id),
    entityName: artifact.fileName,
    action: 'create',
    changes: [],
    performedBy,
  });

  return artifact;
}

export async function submitReport(
  collegeId: string,
  reportId: string,
  data: { submissionReference?: string },
  performedBy: string,
) {
  const report = await AccreditationReport.findOne({ _id: reportId, collegeId });
  if (!report) throw new AppError(404, 'Accreditation report not found');

  if (report.status !== 'approved') {
    throw new AppError(400, 'Report must be approved before submission');
  }

  // Verify artifact is ready
  if (!report.submissionArtifactId) {
    throw new AppError(400, 'No submission artifact found — assemble the report first');
  }
  const artifact = await SubmissionArtifact.findOne({
    _id: report.submissionArtifactId,
    collegeId,
  });
  if (!artifact || artifact.status !== 'ready') {
    throw new AppError(400, 'Submission artifact is not ready');
  }

  // Update report
  report.submittedAt = new Date();
  if (data.submissionReference) report.submissionReference = data.submissionReference;
  report.status = 'submitted';
  await report.save();

  // Update artifact status
  artifact.status = 'submitted';
  await artifact.save();

  // Transition cycle to 'applied'
  const cycle = await AccreditationCycle.findOne({
    _id: report.accreditationCycleId,
    collegeId,
  });
  if (cycle) {
    cycle.status = 'applied';
    await cycle.save();
  }

  await createAuditLog({
    collegeId,
    entityType: 'AccreditationReport',
    entityId: String(report._id),
    entityName: `${report.reportType} report`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'approved', newValue: 'submitted' }],
    performedBy,
  });

  return report;
}

export async function listSubmissionArtifacts(
  collegeId: string,
  page = 1,
  limit = 20,
  reportId?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (reportId) filter.reportId = reportId;
  return paginate(SubmissionArtifact, filter, page, limit, { createdAt: -1 }, [{ path: 'reportId' }]);
}

// ═══════════════════════════════════════════════════════════════
//  Visit Management
// ═══════════════════════════════════════════════════════════════

export async function listDeadlines(collegeId: string, page = 1, limit = 20) {
  return paginate(RegulatoryFiling, { collegeId }, page, limit, { dueDate: 1 });
}

export async function createDeadline(
  collegeId: string,
  data: {
    body: string;
    filingType: string;
    dueDate: Date;
    responsiblePersonId?: string;
    escalationConfig?: Array<{
      monthsBefore: number;
      alertLevel: string;
      recipients?: string[];
      frequency: string;
    }>;
    linkedReportId?: string;
  },
  performedBy: string,
) {
  const doc = await RegulatoryFiling.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'RegulatoryFiling',
    entityId: String(doc._id),
    entityName: `${data.body} - ${data.filingType}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateDeadline(
  collegeId: string,
  id: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await RegulatoryFiling.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Regulatory filing not found');

  await createAuditLog({
    collegeId,
    entityType: 'RegulatoryFiling',
    entityId: id,
    entityName: `${doc.body} - ${doc.filingType}`,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function acknowledgeDeadline(
  collegeId: string,
  id: string,
  data: { personId: string; alertLevel: string },
  performedBy: string,
) {
  const doc = await RegulatoryFiling.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Regulatory filing not found');

  if (!doc.acknowledgments) doc.acknowledgments = [];
  doc.acknowledgments.push({
    personId: data.personId as any,
    acknowledgedAt: new Date(),
    alertLevel: data.alertLevel,
  });
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'RegulatoryFiling',
    entityId: id,
    entityName: `${doc.body} - ${doc.filingType}`,
    action: 'update',
    changes: [{ field: 'acknowledgments', displayName: 'Acknowledgments', oldValue: null, newValue: data.alertLevel }],
    performedBy,
  });

  return doc;
}

export async function recordVisitOutcome(
  collegeId: string,
  accreditationCycleId: string,
  data: {
    grade?: string;
    validityPeriod?: string;
    observations?: string;
    assessorRecommendations?: string;
    findings?: Array<{
      finding: string;
      severity: string;
      correctionAction?: string;
    }>;
  },
  performedBy: string,
) {
  const cycle = await AccreditationCycle.findOne({ _id: accreditationCycleId, collegeId });
  if (!cycle) throw new AppError(404, 'Accreditation cycle not found');

  // Update outcome
  cycle.outcome = {
    grade: data.grade,
    validityPeriod: data.validityPeriod,
    observations: data.observations,
    assessorRecommendations: data.assessorRecommendations,
  };

  // Transition to 'visited', then 'accredited' if grade exists
  cycle.status = 'visited';
  if (data.grade) {
    cycle.grade = data.grade;
    cycle.status = 'accredited';
  }

  await cycle.save();

  // Create AuditFinding records for each finding
  if (data.findings && data.findings.length > 0) {
    const findingDocs = data.findings.map((f) => ({
      collegeId,
      auditType: 'naac' as const,
      auditorName: 'Assessor',
      auditDate: new Date(),
      finding: f.finding,
      severity: f.severity,
      correctionAction: f.correctionAction,
      status: 'open',
      isAssessorFeedback: true,
      assessmentVisitId: cycle._id,
    }));
    await AuditFinding.insertMany(findingDocs);
  }

  await createAuditLog({
    collegeId,
    entityType: 'AccreditationCycle',
    entityId: String(cycle._id),
    entityName: `Cycle ${cycle.cycle}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'visit_in_progress', newValue: cycle.status },
      ...(data.grade ? [{ field: 'grade', displayName: 'Grade', oldValue: null, newValue: data.grade }] : []),
    ],
    performedBy,
  });

  return cycle;
}

const VALID_CYCLE_TRANSITIONS: Record<string, string[]> = {
  preparing: ['evidence_collection'],
  evidence_collection: ['report_drafting'],
  report_drafting: ['report_review'],
  report_review: ['applied', 'report_drafting'],
  applied: ['visit_scheduled'],
  visit_scheduled: ['visit_in_progress'],
  visit_in_progress: ['visited'],
  visited: ['accredited'],
  accredited: ['expired'],
};

export async function transitionCycle(
  collegeId: string,
  cycleId: string,
  newStatus: string,
  performedBy: string,
) {
  const cycle = await AccreditationCycle.findOne({ _id: cycleId, collegeId });
  if (!cycle) throw new AppError(404, 'Accreditation cycle not found');

  const allowed = VALID_CYCLE_TRANSITIONS[cycle.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(400, `Invalid transition from '${cycle.status}' to '${newStatus}'`);
  }

  const oldStatus = cycle.status;
  cycle.status = newStatus;
  await cycle.save();

  await createAuditLog({
    collegeId,
    entityType: 'AccreditationCycle',
    entityId: String(cycle._id),
    entityName: `Cycle ${cycle.cycle}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: newStatus }],
    performedBy,
  });

  return cycle;
}
