import mongoose from 'mongoose';
import { ICCComplaint } from '../../models/welfare/ICCComplaint';
import { ICCAnnualReport } from '../../models/welfare/ICCAnnualReport';
import { SCSTComplaint } from '../../models/welfare/SCSTComplaint';
import { GRCComplaint } from '../../models/welfare/GRCComplaint';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { FieldChange } from '../../shared/types';

// ═══════════════════════════════════════════════════════════════
//  ICC (Internal Complaints Committee) — POSH Act Compliance
// ═══════════════════════════════════════════════════════════════

// ─── W06-L2-017: File ICC Complaint ──────────────────────────

export async function fileICCComplaint(
  collegeId: string,
  data: {
    complainantId: string;
    encryptedComplainantIdentity?: string;
    respondentId: string;
    respondentType: 'student' | 'faculty' | 'staff';
    description: string;
    incidentDate: string;
    committeeId: string;
  },
  performedBy: string,
) {
  const filedDate = new Date();
  const deadlineDate = new Date(filedDate);
  deadlineDate.setDate(deadlineDate.getDate() + 90); // POSH Act 90-day deadline

  const doc = await ICCComplaint.create({
    ...data,
    collegeId,
    incidentDate: new Date(data.incidentDate),
    filedDate,
    deadlineDate,
    status: 'filed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: String(doc._id),
    entityName: `ICC-${String(doc._id).slice(-6)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  // POSH Act: all decisions must be human-only — no AI automation
  return doc;
}

// ─── W06-L2-018: ICC Preliminary Assessment ──────────────────

export async function assessICCComplaint(
  collegeId: string,
  complaintId: string,
  data: {
    recommendation: 'inquiry' | 'dismiss' | 'conciliate';
    remarks: string;
  },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  const now = new Date();
  doc.assessmentPhase = {
    assessedBy: performedBy as any,
    assessedAt: now,
    recommendation: data.recommendation,
    remarks: data.remarks,
  };

  if (data.recommendation === 'dismiss' || data.recommendation === 'conciliate') {
    doc.status = 'closed';
  } else {
    doc.status = 'inquiry';
  }

  await doc.save();

  const changes: FieldChange[] = [
    { field: 'assessmentPhase.recommendation', displayName: 'Recommendation', oldValue: null, newValue: data.recommendation },
    { field: 'status', displayName: 'Status', oldValue: 'filed', newValue: doc.status },
  ];
  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

// ─── W06-L2-019: ICC Inquiry ─────────────────────────────────

export async function startICCInquiry(
  collegeId: string,
  complaintId: string,
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  const now = new Date();
  doc.inquiryPhase = {
    startedAt: now,
    findings: '',
    evidence: [],
  } as any;
  doc.status = 'inquiry';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'inquiryPhase.startedAt', displayName: 'Inquiry Started', oldValue: null, newValue: now }],
    performedBy,
  });

  return doc;
}

export async function completeICCInquiry(
  collegeId: string,
  complaintId: string,
  data: {
    findings: string;
    evidence?: Array<{ fileId: string; type: string }>;
  },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  const now = new Date();
  const withinDeadline = now <= doc.deadlineDate;

  doc.inquiryPhase = {
    ...(doc.inquiryPhase as any)?._doc ?? doc.inquiryPhase,
    startedAt: doc.inquiryPhase?.startedAt ?? now,
    completedAt: now,
    findings: data.findings,
    evidence: (data.evidence ?? []).map((e) => ({ ...e, uploadedAt: now })),
  } as any;
  // Status stays 'inquiry' until hearing
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'inquiryPhase.findings', displayName: 'Inquiry Findings', oldValue: null, newValue: data.findings },
      { field: 'withinDeadline', displayName: 'Within 90-Day Deadline', oldValue: null, newValue: withinDeadline },
    ],
    performedBy,
  });

  return { complaint: doc, withinDeadline };
}

// ─── W06-L2-020: ICC Hearing & Recommendation ───────────────

export async function scheduleICCHearing(
  collegeId: string,
  complaintId: string,
  data: { hearingDate: string; attendees: string[] },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  doc.hearingPhase = {
    hearingDate: new Date(data.hearingDate),
    attendees: data.attendees as any,
    proceedings: '',
  } as any;
  doc.status = 'hearing';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'hearingPhase.hearingDate', displayName: 'Hearing Date', oldValue: null, newValue: data.hearingDate }],
    performedBy,
  });

  return doc;
}

export async function recordICCHearing(
  collegeId: string,
  complaintId: string,
  data: { proceedings: string },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');
  if (!doc.hearingPhase) throw new AppError(400, 'Hearing not scheduled yet');

  doc.hearingPhase.proceedings = data.proceedings;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'hearingPhase.proceedings', displayName: 'Hearing Proceedings', oldValue: null, newValue: '(recorded)' }],
    performedBy,
  });

  return doc;
}

export async function issueICCRecommendation(
  collegeId: string,
  complaintId: string,
  data: { action: string },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  doc.recommendation = {
    action: data.action,
    decidedBy: performedBy as any,
    decidedAt: new Date(),
  };
  doc.status = 'recommendation_issued';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'recommendation.action', displayName: 'Recommendation Action', oldValue: null, newValue: data.action },
      { field: 'status', displayName: 'Status', oldValue: 'hearing', newValue: 'recommendation_issued' },
    ],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-021: ICC Appeal ─────────────────────────────────

export async function fileICCAppeal(
  collegeId: string,
  complaintId: string,
  data: { grounds: string; reviewCommittee?: string[] },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  doc.appealPhase = {
    appealedBy: performedBy as any,
    appealedAt: new Date(),
    grounds: data.grounds,
    reviewCommittee: (data.reviewCommittee ?? []) as any,
  };
  doc.status = 'appealed';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'recommendation_issued', newValue: 'appealed' }],
    performedBy,
  });

  return doc;
}

export async function decideICCAppeal(
  collegeId: string,
  complaintId: string,
  data: { outcome: 'upheld' | 'modified' | 'overturned' },
  performedBy: string,
) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'ICC complaint not found');
  if (!doc.appealPhase) throw new AppError(400, 'No appeal filed for this complaint');

  doc.appealPhase.outcome = data.outcome;
  doc.appealPhase.decidedAt = new Date();
  doc.status = 'closed';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'ICCComplaint',
    entityId: complaintId,
    entityName: `ICC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'appealPhase.outcome', displayName: 'Appeal Outcome', oldValue: null, newValue: data.outcome },
      { field: 'status', displayName: 'Status', oldValue: 'appealed', newValue: 'closed' },
    ],
    performedBy,
  });

  return doc;
}

// ─── ICC Support Functions ───────────────────────────────────

export async function getICCTimeline(collegeId: string, complaintId: string) {
  const doc = await ICCComplaint.findOne({ _id: complaintId, collegeId })
    .populate('complainantId')
    .populate('respondentId')
    .populate('committeeId');
  if (!doc) throw new AppError(404, 'ICC complaint not found');

  const now = new Date();
  const deadlineMs = doc.deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(deadlineMs / (1000 * 60 * 60 * 24));

  return {
    complaint: doc,
    daysRemaining: Math.max(daysRemaining, 0),
    isBreached: daysRemaining < 0,
    phases: {
      filed: { date: doc.filedDate },
      assessment: doc.assessmentPhase ? { date: doc.assessmentPhase.assessedAt, recommendation: doc.assessmentPhase.recommendation } : null,
      inquiry: doc.inquiryPhase ? { startedAt: doc.inquiryPhase.startedAt, completedAt: doc.inquiryPhase.completedAt } : null,
      hearing: doc.hearingPhase ? { hearingDate: doc.hearingPhase.hearingDate } : null,
      recommendation: doc.recommendation ? { action: doc.recommendation.action, decidedAt: doc.recommendation.decidedAt } : null,
      appeal: doc.appealPhase ? { appealedAt: doc.appealPhase.appealedAt, outcome: doc.appealPhase.outcome } : null,
    },
  };
}

export async function getICCDeadlineDashboard(collegeId: string) {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const openStatuses = ['filed', 'preliminary_assessment', 'inquiry', 'hearing', 'recommendation_issued', 'appealed'];

  const [totalOpen, approaching, breached, allOpen] = await Promise.all([
    ICCComplaint.countDocuments({ collegeId, status: { $in: openStatuses } }),
    ICCComplaint.countDocuments({ collegeId, status: { $in: openStatuses }, deadlineDate: { $gte: now, $lte: sevenDaysFromNow } }),
    ICCComplaint.countDocuments({ collegeId, status: { $in: openStatuses }, deadlineDate: { $lt: now } }),
    ICCComplaint.find({ collegeId, status: { $in: openStatuses } }).select('_id status deadlineDate filedDate').lean(),
  ]);

  const items = allOpen.map((c) => {
    const dMs = new Date(c.deadlineDate).getTime() - now.getTime();
    const daysRemaining = Math.ceil(dMs / (1000 * 60 * 60 * 24));
    return { _id: c._id, status: c.status, deadlineDate: c.deadlineDate, daysRemaining };
  });

  return { totalOpen, approachingDeadline: approaching, breachedDeadline: breached, items };
}

// ─── W06-L2-022: ICC Annual Report ──────────────────────────

export async function generateICCAnnualReport(
  collegeId: string,
  data: { year: number },
  performedBy: string,
) {
  const yearStart = new Date(`${data.year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${data.year + 1}-01-01T00:00:00.000Z`);

  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregation actually matches documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const [total, resolved, pending, avgAgg] = await Promise.all([
    ICCComplaint.countDocuments({ collegeId, filedDate: { $gte: yearStart, $lt: yearEnd } }),
    ICCComplaint.countDocuments({ collegeId, filedDate: { $gte: yearStart, $lt: yearEnd }, status: 'closed' }),
    ICCComplaint.countDocuments({ collegeId, filedDate: { $gte: yearStart, $lt: yearEnd }, status: { $ne: 'closed' } }),
    ICCComplaint.aggregate([
      { $match: { collegeId: cidObj, filedDate: { $gte: yearStart, $lt: yearEnd }, status: 'closed' } },
      { $project: { resolutionDays: { $divide: [{ $subtract: ['$updatedAt', '$filedDate'] }, 1000 * 60 * 60 * 24] } } },
      { $group: { _id: null, avg: { $avg: '$resolutionDays' } } },
    ]),
  ]);

  const averageResolutionDays = Math.round(avgAgg[0]?.avg ?? 0);

  const doc = await ICCAnnualReport.findOneAndUpdate(
    { collegeId, year: data.year },
    { collegeId, year: data.year, totalComplaints: total, resolvedCount: resolved, pendingCount: pending, averageResolutionDays, status: 'draft' },
    { upsert: true, new: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ICCAnnualReport',
    entityId: String(doc._id),
    entityName: `ICC Annual Report ${data.year}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

// ─── ICC CRUD ────────────────────────────────────────────────

export async function listICCComplaints(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { status?: string; respondentType?: string },
) {
  const filter: any = { collegeId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.respondentType) filter.respondentType = filters.respondentType;
  return paginate(ICCComplaint, filter, page, limit, { createdAt: -1 }, ['complainantId', 'respondentId', 'committeeId']);
}

export async function getICCComplaint(collegeId: string, id: string) {
  const doc = await ICCComplaint.findOne({ _id: id, collegeId })
    .populate('complainantId')
    .populate('respondentId')
    .populate('committeeId');
  if (!doc) throw new AppError(404, 'ICC complaint not found');
  return doc;
}

export async function listICCAnnualReports(collegeId: string, page = 1, limit = 20) {
  return paginate(ICCAnnualReport, { collegeId }, page, limit, { year: -1 });
}

export async function getICCAnnualReport(collegeId: string, id: string) {
  const doc = await ICCAnnualReport.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'ICC annual report not found');
  return doc;
}

// ═══════════════════════════════════════════════════════════════
//  SC/ST Cell — Scheduled Caste / Scheduled Tribe Complaints
// ═══════════════════════════════════════════════════════════════

// ─── W06-L2-024: File SCST Complaint ─────────────────────────

export async function fileSCSTComplaint(
  collegeId: string,
  data: {
    complainantId: string;
    respondentId: string;
    description: string;
    incidentDate: string;
    casteCategory: string;
    committeeId: string;
  },
  performedBy: string,
) {
  const doc = await SCSTComplaint.create({
    ...data,
    collegeId,
    incidentDate: new Date(data.incidentDate),
    status: 'filed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SCSTComplaint',
    entityId: String(doc._id),
    entityName: `SCST-${String(doc._id).slice(-6)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-025: SCST Investigation ─────────────────────────

export async function investigateSCSTComplaint(
  collegeId: string,
  complaintId: string,
  data: { investigatorIds: string[]; findings?: string },
  performedBy: string,
) {
  const doc = await SCSTComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'SCST complaint not found');

  const now = new Date();
  doc.investigationPhase = {
    investigatorIds: data.investigatorIds as any,
    startedAt: doc.investigationPhase?.startedAt ?? now,
    findings: data.findings ?? '',
    ...(data.findings ? { completedAt: now } : {}),
  } as any;
  doc.status = 'investigating';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'SCSTComplaint',
    entityId: complaintId,
    entityName: `SCST-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'filed', newValue: 'investigating' }],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-026: SCST Decision & Action ─────────────────────

export async function decideSCSTComplaint(
  collegeId: string,
  complaintId: string,
  data: { outcome: string; remarks: string },
  performedBy: string,
) {
  const doc = await SCSTComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'SCST complaint not found');

  doc.decision = {
    outcome: data.outcome,
    decidedBy: performedBy as any,
    decidedAt: new Date(),
    remarks: data.remarks,
  };
  doc.status = 'decision';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'SCSTComplaint',
    entityId: complaintId,
    entityName: `SCST-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'decision.outcome', displayName: 'Decision Outcome', oldValue: null, newValue: data.outcome },
      { field: 'status', displayName: 'Status', oldValue: 'investigating', newValue: 'decision' },
    ],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-027: SCST Police Referral ───────────────────────

export async function referSCSTToPolice(
  collegeId: string,
  complaintId: string,
  data: { policeStation: string; firNumber?: string; isAtrocitiesAct: boolean },
  performedBy: string,
) {
  const doc = await SCSTComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'SCST complaint not found');

  // NON-DISCRETIONARY when Atrocities Act triggered
  doc.policeReferral = {
    referralDate: new Date(),
    policeStation: data.policeStation,
    firNumber: data.firNumber,
    referredBy: performedBy as any,
    isAtrocitiesAct: data.isAtrocitiesAct,
  };
  doc.status = 'police_referred';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'SCSTComplaint',
    entityId: complaintId,
    entityName: `SCST-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'policeReferral.policeStation', displayName: 'Police Station', oldValue: null, newValue: data.policeStation },
      { field: 'policeReferral.isAtrocitiesAct', displayName: 'Atrocities Act', oldValue: null, newValue: data.isAtrocitiesAct },
      { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: 'police_referred' },
    ],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-028: SCST Quarterly Report ──────────────────────

export async function generateSCSTQuarterlyReport(
  collegeId: string,
  data: { quarter: string; year: number },
  _performedBy: string,
) {
  // Quarter mapping: Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec
  const quarterMap: Record<string, [number, number]> = {
    Q1: [0, 3], Q2: [3, 6], Q3: [6, 9], Q4: [9, 12],
  };
  const range = quarterMap[data.quarter];
  if (!range) throw new AppError(400, 'Invalid quarter. Use Q1, Q2, Q3, or Q4');

  const start = new Date(data.year, range[0], 1);
  const end = new Date(data.year, range[1], 1);

  const [total, filed, investigating, decided, policeReferred, closed] = await Promise.all([
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end } }),
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end }, status: 'filed' }),
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end }, status: 'investigating' }),
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end }, status: 'decision' }),
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end }, status: 'police_referred' }),
    SCSTComplaint.countDocuments({ collegeId, createdAt: { $gte: start, $lt: end }, status: 'closed' }),
  ]);

  return {
    quarter: data.quarter,
    year: data.year,
    total,
    byStatus: { filed, investigating, decided, policeReferred, closed },
  };
}

// ─── SCST Support Functions ─────────────────────────────────

export async function getSCSTTimeline(collegeId: string, complaintId: string) {
  const doc = await SCSTComplaint.findOne({ _id: complaintId, collegeId })
    .populate('complainantId')
    .populate('respondentId')
    .populate('committeeId');
  if (!doc) throw new AppError(404, 'SCST complaint not found');

  return {
    complaint: doc,
    phases: {
      filed: { date: (doc as any).createdAt as Date },
      investigation: doc.investigationPhase
        ? { startedAt: doc.investigationPhase.startedAt, completedAt: doc.investigationPhase.completedAt }
        : null,
      decision: doc.decision
        ? { outcome: doc.decision.outcome, decidedAt: doc.decision.decidedAt }
        : null,
      policeReferral: doc.policeReferral
        ? { referralDate: doc.policeReferral.referralDate, isAtrocitiesAct: doc.policeReferral.isAtrocitiesAct }
        : null,
    },
  };
}

// ─── SCST CRUD ──────────────────────────────────────────────

export async function listSCSTComplaints(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { status?: string; casteCategory?: string },
) {
  const filter: any = { collegeId };
  if (filters?.status) filter.status = filters.status;
  if (filters?.casteCategory) filter.casteCategory = filters.casteCategory;
  return paginate(SCSTComplaint, filter, page, limit, { createdAt: -1 }, ['complainantId', 'respondentId', 'committeeId']);
}

export async function getSCSTComplaint(collegeId: string, id: string) {
  const doc = await SCSTComplaint.findOne({ _id: id, collegeId })
    .populate('complainantId')
    .populate('respondentId')
    .populate('committeeId');
  if (!doc) throw new AppError(404, 'SCST complaint not found');
  return doc;
}

// ═══════════════════════════════════════════════════════════════
//  GRC (Grievance Redressal Committee) — UGC Regulations
// ═══════════════════════════════════════════════════════════════

// ─── W06-L2-029: Escalate to GRC / File GRC Complaint ───────

export async function fileGRCComplaint(
  collegeId: string,
  data: {
    escalatedFrom?: string;
    complainantId: string;
    description: string;
    committeeId: string;
  },
  performedBy: string,
) {
  const filedDate = new Date();
  const hearingDeadline = new Date(filedDate);
  hearingDeadline.setDate(hearingDeadline.getDate() + 15); // 15-day statutory hearing deadline
  const decisionDeadline = new Date(filedDate);
  decisionDeadline.setDate(decisionDeadline.getDate() + 30); // 30-day statutory decision deadline

  const doc = await GRCComplaint.create({
    ...data,
    collegeId,
    filedDate,
    hearingDeadline,
    decisionDeadline,
    status: 'filed',
  });

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: String(doc._id),
    entityName: `GRC-${String(doc._id).slice(-6)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-031: Investigate GRC Complaint ──────────────────

export async function investigateGRCComplaint(
  collegeId: string,
  complaintId: string,
  data: { investigatorId: string; findings?: string },
  performedBy: string,
) {
  const doc = await GRCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'GRC complaint not found');

  const now = new Date();
  doc.investigationPhase = {
    investigatorId: data.investigatorId as any,
    startedAt: doc.investigationPhase?.startedAt ?? now,
    findings: data.findings ?? '',
    ...(data.findings ? { completedAt: now } : {}),
  } as any;
  doc.status = 'investigating';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: complaintId,
    entityName: `GRC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'filed', newValue: 'investigating' }],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-032: GRC Hearing & Decision ─────────────────────

export async function scheduleGRCHearing(
  collegeId: string,
  complaintId: string,
  data: { hearingDate: string; attendees: string[] },
  performedBy: string,
) {
  const doc = await GRCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'GRC complaint not found');

  const hearingDate = new Date(data.hearingDate);
  if (hearingDate > doc.hearingDeadline) {
    throw new AppError(400, 'Hearing date exceeds the 15-day statutory deadline');
  }

  doc.hearingPhase = {
    hearingDate,
    attendees: data.attendees as any,
    proceedings: '',
  } as any;
  doc.status = 'hearing_scheduled';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: complaintId,
    entityName: `GRC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'hearingPhase.hearingDate', displayName: 'Hearing Date', oldValue: null, newValue: data.hearingDate }],
    performedBy,
  });

  return doc;
}

export async function recordGRCHearing(
  collegeId: string,
  complaintId: string,
  data: { proceedings: string },
  performedBy: string,
) {
  const doc = await GRCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'GRC complaint not found');
  if (!doc.hearingPhase) throw new AppError(400, 'Hearing not scheduled yet');

  doc.hearingPhase.proceedings = data.proceedings;
  doc.status = 'hearing_complete';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: complaintId,
    entityName: `GRC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'hearingPhase.proceedings', displayName: 'Hearing Proceedings', oldValue: null, newValue: '(recorded)' },
      { field: 'status', displayName: 'Status', oldValue: 'hearing_scheduled', newValue: 'hearing_complete' },
    ],
    performedBy,
  });

  return doc;
}

export async function issueGRCDecision(
  collegeId: string,
  complaintId: string,
  data: { outcome: string; remarks: string },
  performedBy: string,
) {
  const doc = await GRCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'GRC complaint not found');

  const now = new Date();
  if (now > doc.decisionDeadline) {
    throw new AppError(400, 'Decision exceeds the 30-day statutory deadline');
  }

  doc.decision = {
    outcome: data.outcome,
    decidedBy: performedBy as any,
    decidedAt: now,
    remarks: data.remarks,
  };
  doc.status = 'decision_issued';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: complaintId,
    entityName: `GRC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [
      { field: 'decision.outcome', displayName: 'Decision Outcome', oldValue: null, newValue: data.outcome },
      { field: 'status', displayName: 'Status', oldValue: 'hearing_complete', newValue: 'decision_issued' },
    ],
    performedBy,
  });

  return doc;
}

// ─── W06-L2-033: GRC Appeal to Ombudsman ────────────────────

export async function appealGRCToOmbudsman(
  collegeId: string,
  complaintId: string,
  data: { referenceNumber?: string },
  performedBy: string,
) {
  const doc = await GRCComplaint.findOne({ _id: complaintId, collegeId });
  if (!doc) throw new AppError(404, 'GRC complaint not found');

  doc.ombudsmanAppeal = {
    filedDate: new Date(),
    referenceNumber: data.referenceNumber,
  } as any;
  doc.status = 'appealed_to_ombudsman';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'GRCComplaint',
    entityId: complaintId,
    entityName: `GRC-${complaintId.slice(-6)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'decision_issued', newValue: 'appealed_to_ombudsman' }],
    performedBy,
  });

  return doc;
}

// ─── GRC Support Functions ──────────────────────────────────

export async function getGRCDeadlineDashboard(collegeId: string) {
  const now = new Date();
  const openStatuses = ['filed', 'investigating', 'hearing_scheduled', 'hearing_complete'];

  const allOpen = await GRCComplaint.find({ collegeId, status: { $in: openStatuses } })
    .select('_id status hearingDeadline decisionDeadline filedDate')
    .lean();

  let hearingApproaching = 0;
  let hearingBreached = 0;
  let decisionApproaching = 0;
  let decisionBreached = 0;
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const items = allOpen.map((c) => {
    const hd = new Date(c.hearingDeadline);
    const dd = new Date(c.decisionDeadline);
    const hearingDaysRemaining = Math.ceil((hd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const decisionDaysRemaining = Math.ceil((dd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (hearingDaysRemaining < 0) hearingBreached++;
    else if (hd <= threeDaysFromNow) hearingApproaching++;
    if (decisionDaysRemaining < 0) decisionBreached++;
    else if (dd <= threeDaysFromNow) decisionApproaching++;

    return {
      _id: c._id,
      status: c.status,
      hearingDeadline: c.hearingDeadline,
      hearingDaysRemaining,
      decisionDeadline: c.decisionDeadline,
      decisionDaysRemaining,
    };
  });

  return {
    totalOpen: allOpen.length,
    hearing: { approaching: hearingApproaching, breached: hearingBreached },
    decision: { approaching: decisionApproaching, breached: decisionBreached },
    items,
  };
}

// ─── GRC CRUD ───────────────────────────────────────────────

export async function listGRCComplaints(
  collegeId: string,
  page = 1,
  limit = 20,
  filters?: { status?: string },
) {
  const filter: any = { collegeId };
  if (filters?.status) filter.status = filters.status;
  return paginate(GRCComplaint, filter, page, limit, { createdAt: -1 }, ['complainantId', 'committeeId']);
}

export async function getGRCComplaint(collegeId: string, id: string) {
  const doc = await GRCComplaint.findOne({ _id: id, collegeId })
    .populate('complainantId')
    .populate('committeeId')
    .populate('escalatedFrom');
  if (!doc) throw new AppError(404, 'GRC complaint not found');
  return doc;
}
