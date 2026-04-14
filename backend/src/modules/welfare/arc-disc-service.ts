import { AntiRaggingComplaint } from '../../models/welfare/AntiRaggingComplaint';
import { MisconductReport } from '../../models/welfare/MisconductReport';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

type FieldChange = { field: string; displayName: string; oldValue: any; newValue: any };

function changes(pairs: [string, string, any, any][]): FieldChange[] {
  return pairs
    .filter(([, , o, n]) => o !== n)
    .map(([field, displayName, oldValue, newValue]) => ({ field, displayName, oldValue, newValue }));
}

// ═══════════════════════════════════════════════════════════════
//  ARC  (Anti-Ragging Cell)  W06-L2-009 .. 015
// ═══════════════════════════════════════════════════════════════

// ─── W06-L2-009: File Anti-Ragging Complaint ─────────────────
export async function fileARCComplaint(
  collegeId: string,
  data: {
    complainantId?: string; isAnonymous?: boolean; encryptedComplainantIdentity?: string;
    accusedIds: string[]; description: string; incidentDate: string;
    severity: string; incidentLocation?: string; committeeId?: string;
  },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.create({
    collegeId,
    complainantId: data.complainantId,
    isAnonymous: data.isAnonymous ?? false,
    encryptedComplainantIdentity: data.encryptedComplainantIdentity,
    accusedIds: data.accusedIds,
    description: data.description,
    incidentDate: new Date(data.incidentDate),
    severity: data.severity,
    incidentLocation: data.incidentLocation,
    committeeId: data.committeeId,
    status: 'filed',
  });
  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

// ─── W06-L2-010: ARC Initial Assessment ──────────────────────
export async function assessARCComplaint(
  collegeId: string,
  complaintId: string,
  data: { recommendation: 'investigate' | 'dismiss' | 'mediate'; remarks: string },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  // Check prior history for accused
  const priorCount = await AntiRaggingComplaint.countDocuments({
    collegeId,
    accusedIds: { $in: doc.accusedIds },
    _id: { $ne: doc._id },
  });

  const oldStatus = doc.status;
  doc.assessmentPhase = {
    assessedBy: performedBy as any,
    assessedAt: new Date(),
    recommendation: data.recommendation,
    remarks: data.remarks,
    priorHistory: { count: priorCount, details: priorCount > 0 ? `${priorCount} prior complaint(s) against accused` : 'No prior history' },
  };

  if (data.recommendation === 'dismiss') doc.status = 'closed';
  else if (data.recommendation === 'investigate') doc.status = 'investigating';
  else if (data.recommendation === 'mediate') doc.status = 'closed';

  await doc.save();
  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['assessmentPhase.recommendation', 'Assessment Recommendation', null, data.recommendation],
    ]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-011: ARC Investigation ──────────────────────────
export async function startARCInvestigation(
  collegeId: string,
  complaintId: string,
  data: { investigatorIds: string[] },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  doc.investigationPhase = {
    ...doc.investigationPhase,
    investigatorIds: data.investigatorIds as any,
    startedAt: new Date(),
    witnessStatements: doc.investigationPhase?.witnessStatements ?? [],
  } as any;
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['investigationPhase.investigatorIds', 'Investigators', null, data.investigatorIds]]),
    performedBy,
  });
  return doc;
}

export async function recordARCWitness(
  collegeId: string,
  complaintId: string,
  data: { witnessId: string; statement: string },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  if (!doc.investigationPhase) {
    doc.investigationPhase = { witnessStatements: [] } as any;
  }
  const statements = doc.investigationPhase.witnessStatements ?? [];
  statements.push({ witnessId: data.witnessId as any, statement: data.statement, recordedAt: new Date() });
  doc.investigationPhase.witnessStatements = statements;
  doc.markModified('investigationPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['investigationPhase.witnessStatements', 'Witness Statement Added', null, data.witnessId]]),
    performedBy,
  });
  return doc;
}

export async function completeARCInvestigation(
  collegeId: string,
  complaintId: string,
  data: { findings: string },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  if (!doc.investigationPhase) throw new AppError(400, 'Investigation not started');
  doc.investigationPhase.completedAt = new Date();
  doc.investigationPhase.findings = data.findings;
  doc.markModified('investigationPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['investigationPhase.findings', 'Investigation Findings', null, data.findings]]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-012: ARC Hearing & Decision ─────────────────────
export async function scheduleARCHearing(
  collegeId: string,
  complaintId: string,
  data: { hearingDate: string; attendees: string[] },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  doc.hearingPhase = {
    hearingDate: new Date(data.hearingDate),
    attendees: data.attendees as any,
  } as any;
  doc.status = 'hearing_scheduled';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'hearing_scheduled']]),
    performedBy,
  });
  return doc;
}

export async function recordARCHearing(
  collegeId: string,
  complaintId: string,
  data: { proceedings: string },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  if (!doc.hearingPhase) throw new AppError(400, 'Hearing not scheduled');
  doc.hearingPhase.proceedings = data.proceedings;
  doc.hearingPhase.decisionDate = new Date();
  doc.status = 'hearing_complete';
  doc.markModified('hearingPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'hearing_complete']]),
    performedBy,
  });
  return doc;
}

export async function issueARCDecision(
  collegeId: string,
  complaintId: string,
  data: {
    outcome: 'guilty' | 'not_guilty' | 'insufficient_evidence';
    penalty?: string; penaltySeverity?: string;
  },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  doc.decision = {
    outcome: data.outcome,
    penalty: data.penalty,
    penaltySeverity: data.penaltySeverity,
    decidedBy: performedBy as any,
    decidedAt: new Date(),
  };

  if (data.outcome === 'guilty' && data.penalty) {
    doc.status = 'decision_issued';
  } else {
    doc.status = 'closed';
  }
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['decision.outcome', 'Decision Outcome', null, data.outcome],
    ]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-013: ARC Penalty Execution ──────────────────────
export async function executeARCPenalty(
  collegeId: string,
  complaintId: string,
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  doc.status = 'penalty_executing';
  await doc.save();

  // In real integration this would trigger M02 disciplinary record write
  doc.status = 'closed';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'closed']]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-014: ARC Appeal ─────────────────────────────────
export async function fileARCAppeal(
  collegeId: string,
  complaintId: string,
  data: { grounds: string; reviewCommittee?: string[] },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  doc.appealPhase = {
    appealedBy: performedBy as any,
    appealedAt: new Date(),
    grounds: data.grounds,
    reviewCommittee: (data.reviewCommittee ?? []) as any,
  } as any;
  doc.status = 'appealed';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'appealed']]),
    performedBy,
  });
  return doc;
}

export async function decideARCAppeal(
  collegeId: string,
  complaintId: string,
  data: { outcome: 'upheld' | 'modified' | 'overturned' },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  if (!doc.appealPhase) throw new AppError(400, 'No appeal filed');
  doc.appealPhase.outcome = data.outcome;
  doc.appealPhase.decidedAt = new Date();
  doc.status = data.outcome === 'overturned' ? 'closed' : 'appeal_decided';
  doc.markModified('appealPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['appealPhase.outcome', 'Appeal Outcome', null, data.outcome],
    ]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-015: ARC FIR Filing ─────────────────────────────
export async function fileARCFir(
  collegeId: string,
  complaintId: string,
  data: { firNumber: string; policeStation: string },
  performedBy: string,
) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');

  const oldStatus = doc.status;
  doc.firDetails = {
    firNumber: data.firNumber,
    policeStation: data.policeStation,
    filedDate: new Date(),
    filedBy: performedBy as any,
  };
  doc.status = 'referred_to_police';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id),
    entityName: `ARC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, 'referred_to_police'],
      ['firDetails.firNumber', 'FIR Number', null, data.firNumber],
    ]),
    performedBy,
  });
  return doc;
}

// ─── ARC History / Reports ──────────────────────────────────
export async function getARCComplaintHistory(collegeId: string, complaintId: string) {
  const doc = await AntiRaggingComplaint.findOne({ _id: complaintId, collegeId })
    .populate('complainantId')
    .populate('accusedIds')
    .populate('committeeId')
    .populate('assessmentPhase.assessedBy')
    .populate('investigationPhase.investigatorIds')
    .populate('hearingPhase.attendees')
    .populate('decision.decidedBy')
    .populate('firDetails.filedBy')
    .populate('appealPhase.appealedBy')
    .populate('appealPhase.reviewCommittee');
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');
  return doc;
}

export async function generateARCUGCReport(
  collegeId: string,
  data: { period: string },
  _performedBy: string,
) {
  const [startStr, endStr] = data.period.split('/');
  const start = new Date(startStr!);
  const end = new Date(endStr!);

  const complaints = await AntiRaggingComplaint.find({
    collegeId,
    createdAt: { $gte: start, $lte: end },
  }).lean();

  const total = complaints.length;
  const byStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let firCount = 0;
  let guiltyCount = 0;

  for (const c of complaints) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1;
    if (c.firDetails?.firNumber) firCount++;
    if (c.decision?.outcome === 'guilty') guiltyCount++;
  }

  return {
    period: data.period,
    total,
    byStatus,
    bySeverity,
    firCount,
    guiltyCount,
    closedCount: byStatus['closed'] ?? 0,
    pendingCount: total - (byStatus['closed'] ?? 0),
  };
}

// ─── ARC CRUD ───────────────────────────────────────────────
export async function listARCComplaints(
  collegeId: string,
  page: number,
  limit: number,
  filters?: { status?: string; severity?: string; fromDate?: string; toDate?: string },
) {
  const filter: Record<string, any> = { collegeId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.severity) filter.severity = filters.severity;
  if (filters?.fromDate || filters?.toDate) {
    filter.incidentDate = {};
    if (filters.fromDate) filter.incidentDate.$gte = new Date(filters.fromDate);
    if (filters.toDate) filter.incidentDate.$lte = new Date(filters.toDate);
  }
  return paginate(AntiRaggingComplaint, filter, page, limit);
}

export async function getARCComplaint(collegeId: string, id: string) {
  const doc = await AntiRaggingComplaint.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');
  return doc;
}

// ═══════════════════════════════════════════════════════════════
//  DISC  (Disciplinary Proceedings)  W06-L2-043 .. 048
// ═══════════════════════════════════════════════════════════════

// ─── W06-L2-043: File Misconduct Report ─────────────────────
export async function fileMisconductReport(
  collegeId: string,
  data: {
    reportedBy: string; reporterRole: string; studentId: string;
    category: string; description: string; incidentDate: string;
    evidenceAttachments?: any[];
  },
  performedBy: string,
) {
  const priorViolationCount = await MisconductReport.countDocuments({
    collegeId,
    studentId: data.studentId,
  });

  const doc = await MisconductReport.create({
    collegeId,
    reportedBy: data.reportedBy,
    reporterRole: data.reporterRole,
    studentId: data.studentId,
    category: data.category,
    description: data.description,
    incidentDate: new Date(data.incidentDate),
    evidenceAttachments: data.evidenceAttachments ?? [],
    priorViolationCount,
    status: 'filed',
  });

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

// ─── W06-L2-044: Preliminary Inquiry ────────────────────────
export async function startDisciplinaryInquiry(
  collegeId: string,
  reportId: string,
  data: { investigatorId: string },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');

  const oldStatus = doc.status;
  doc.inquiryPhase = {
    investigatorId: data.investigatorId as any,
    startedAt: new Date(),
    findings: '',
    recommendation: '' as any,
  } as any;
  doc.status = 'preliminary_inquiry';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'preliminary_inquiry']]),
    performedBy,
  });
  return doc;
}

export async function completeDisciplinaryInquiry(
  collegeId: string,
  reportId: string,
  data: { findings: string; recommendation: 'dismiss' | 'hearing' },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');
  if (!doc.inquiryPhase) throw new AppError(400, 'Inquiry not started');

  const oldStatus = doc.status;
  doc.inquiryPhase.completedAt = new Date();
  doc.inquiryPhase.findings = data.findings;
  doc.inquiryPhase.recommendation = data.recommendation;

  if (data.recommendation === 'dismiss') {
    doc.status = 'closed';
  }
  // If 'hearing', status stays 'preliminary_inquiry' until hearing scheduled

  doc.markModified('inquiryPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['inquiryPhase.recommendation', 'Inquiry Recommendation', null, data.recommendation],
    ]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-045: Conduct Disciplinary Hearing ───────────────
export async function scheduleDisciplinaryHearing(
  collegeId: string,
  reportId: string,
  data: { hearingDate: string; attendees: string[]; committeeId?: string },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');

  const oldStatus = doc.status;
  doc.hearingPhase = {
    hearingDate: new Date(data.hearingDate),
    attendees: data.attendees as any,
    proceedings: '',
  } as any;
  if (data.committeeId) doc.committeeId = data.committeeId as any;
  doc.status = 'hearing_scheduled';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'hearing_scheduled']]),
    performedBy,
  });
  return doc;
}

export async function recordDisciplinaryHearing(
  collegeId: string,
  reportId: string,
  data: { proceedings: string },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');
  if (!doc.hearingPhase) throw new AppError(400, 'Hearing not scheduled');

  const oldStatus = doc.status;
  doc.hearingPhase.proceedings = data.proceedings;
  doc.status = 'hearing_complete';
  doc.markModified('hearingPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'hearing_complete']]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-046: Issue Decision & Execute Penalty ───────────
export async function issueDisciplinaryDecision(
  collegeId: string,
  reportId: string,
  data: {
    outcome: 'warning' | 'fine' | 'suspension' | 'rustication' | 'expulsion' | 'exonerated';
    details: string;
  },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');

  const oldStatus = doc.status;
  doc.decision = {
    outcome: data.outcome,
    details: data.details,
    decidedBy: performedBy as any,
    decidedAt: new Date(),
  };

  doc.status = data.outcome === 'exonerated' ? 'closed' : 'penalty_issued';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['decision.outcome', 'Decision Outcome', null, data.outcome],
    ]),
    performedBy,
  });
  return doc;
}

export async function executeDisciplinaryPenalty(
  collegeId: string,
  reportId: string,
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');

  const oldStatus = doc.status;
  doc.status = 'penalty_executing';
  await doc.save();

  // In real integration this would trigger M02 disciplinary record write
  doc.status = 'closed';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'closed']]),
    performedBy,
  });
  return doc;
}

// ─── W06-L2-047: Disciplinary Appeal ────────────────────────
export async function fileDisciplinaryAppeal(
  collegeId: string,
  reportId: string,
  data: { grounds: string; reviewCommittee?: string[] },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');

  const oldStatus = doc.status;
  doc.appealPhase = {
    appealedBy: performedBy as any,
    appealedAt: new Date(),
    grounds: data.grounds,
    reviewCommittee: (data.reviewCommittee ?? []) as any,
  } as any;
  doc.status = 'appealed';
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([['status', 'Status', oldStatus, 'appealed']]),
    performedBy,
  });
  return doc;
}

export async function decideDisciplinaryAppeal(
  collegeId: string,
  reportId: string,
  data: { outcome: 'upheld' | 'modified' | 'overturned' },
  performedBy: string,
) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');
  if (!doc.appealPhase) throw new AppError(400, 'No appeal filed');

  const oldStatus = doc.status;
  doc.appealPhase.outcome = data.outcome;
  doc.appealPhase.decidedAt = new Date();
  doc.status = data.outcome === 'overturned' ? 'closed' : 'appeal_decided';
  doc.markModified('appealPhase');
  await doc.save();

  await createAuditLog({
    collegeId, entityType: 'MisconductReport', entityId: String(doc._id),
    entityName: `DISC-${String(doc._id).slice(-6)}`, action: 'update',
    changes: changes([
      ['status', 'Status', oldStatus, doc.status],
      ['appealPhase.outcome', 'Appeal Outcome', null, data.outcome],
    ]),
    performedBy,
  });
  return doc;
}

// ─── DISC Support / History ─────────────────────────────────
export async function getDisciplinaryHistory(collegeId: string, reportId: string) {
  const doc = await MisconductReport.findOne({ _id: reportId, collegeId })
    .populate('reportedBy')
    .populate('studentId')
    .populate('committeeId')
    .populate('inquiryPhase.investigatorId')
    .populate('hearingPhase.attendees')
    .populate('decision.decidedBy')
    .populate('appealPhase.appealedBy')
    .populate('appealPhase.reviewCommittee');
  if (!doc) throw new AppError(404, 'Misconduct report not found');
  return doc;
}

export async function getStudentDisciplinaryRecord(collegeId: string, studentId: string) {
  const reports = await MisconductReport.find({ collegeId, studentId })
    .sort({ createdAt: -1 })
    .populate('reportedBy')
    .lean();

  const summary = {
    totalReports: reports.length,
    openReports: reports.filter(r => !['closed'].includes(r.status)).length,
    byCategory: {} as Record<string, number>,
    byOutcome: {} as Record<string, number>,
  };

  for (const r of reports) {
    summary.byCategory[r.category] = (summary.byCategory[r.category] ?? 0) + 1;
    if (r.decision?.outcome) {
      summary.byOutcome[r.decision.outcome] = (summary.byOutcome[r.decision.outcome] ?? 0) + 1;
    }
  }

  return { summary, reports };
}

// ─── DISC CRUD ──────────────────────────────────────────────
export async function listMisconductReports(
  collegeId: string,
  page: number,
  limit: number,
  filters?: { status?: string; category?: string; studentId?: string; fromDate?: string; toDate?: string },
) {
  const filter: Record<string, any> = { collegeId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.category) filter.category = filters.category;
  if (filters?.studentId) filter.studentId = filters.studentId;
  if (filters?.fromDate || filters?.toDate) {
    filter.incidentDate = {};
    if (filters.fromDate) filter.incidentDate.$gte = new Date(filters.fromDate);
    if (filters.toDate) filter.incidentDate.$lte = new Date(filters.toDate);
  }
  return paginate(MisconductReport, filter, page, limit);
}

export async function getMisconductReport(collegeId: string, id: string) {
  const doc = await MisconductReport.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Misconduct report not found');
  return doc;
}
