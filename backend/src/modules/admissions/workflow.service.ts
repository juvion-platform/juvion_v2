// ─── W01 Workflow Service ────────────────────────────────────
// Domain-specific workflow operations for Student Intake & Onboarding.
// Orchestrates the W01 state machine with admissions business logic.

import mongoose from 'mongoose';
import { Inquiry } from '../../models/admissions/Inquiry';
import { AdmissionOffer } from '../../models/admissions/AdmissionOffer';
import { LeadInteraction } from '../../models/admissions/LeadInteraction';
import { LeadImportBatch } from '../../models/admissions/LeadImportBatch';
import { SeatInventory } from '../../models/admissions/SeatInventory';
import { AllotmentRound } from '../../models/admissions/AllotmentRound';
import { AllotmentResult } from '../../models/admissions/AllotmentResult';
import { Waitlist } from '../../models/admissions/Waitlist';
import { FeeNegotiation } from '../../models/admissions/FeeNegotiation';
import { AdmissionCancellation } from '../../models/admissions/AdmissionCancellation';
import { WorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { WorkflowTask } from '../../models/workflow/WorkflowTask';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { enqueueScoring } from './lead-scoring/enqueue';

// 001-ai-lead-scoring §10.9 / Story 2 — interaction outcomes that should
// trigger a re-score. Negative/neutral outcomes are intentionally excluded
// to keep the LLM bill down; the score will still refresh on the next
// positive signal or via manual rescore.
const RESCORE_TRIGGERING_OUTCOMES = new Set([
  'interested', 'callback_requested', 'visit_scheduled', 'converted',
]);

// ─── Lead Interactions ──────────────────────────────────────

export async function listLeadInteractions(collegeId: string, inquiryId: string, page: number, limit: number) {
  return paginate(LeadInteraction, { collegeId, inquiryId }, page, limit, { createdAt: -1 });
}

export async function createLeadInteraction(collegeId: string, data: any, performedBy: string) {
  const doc = await LeadInteraction.create({ ...data, collegeId, performedBy });

  // Update inquiry's last interaction timestamp and count
  await Inquiry.findByIdAndUpdate(data.inquiryId, {
    lastInteractionAt: new Date(),
    $inc: { interactionCount: 1 },
  });

  await createAuditLog({
    collegeId, entityType: 'LeadInteraction', entityId: String(doc._id),
    entityName: `${data.type} interaction`, action: 'create', changes: [], performedBy,
  });

  // 001-ai-lead-scoring §10.6 / Story 2 — positive outcomes refresh the
  // score. The 5-min worker-level debounce (spec §10.6) prevents thrash
  // when several positive interactions land in quick succession.
  if (data.outcome && RESCORE_TRIGGERING_OUTCOMES.has(data.outcome)) {
    enqueueScoring({
      collegeId, inquiryId: String(data.inquiryId), performedBy, trigger: 'interaction',
    }).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[lead-interaction] lead-scoring enqueue failed (inquiry=${data.inquiryId}):`, (err as Error).message);
    });
  }

  return doc;
}

// ─── Lead Import Batches ────────────────────────────────────

export async function listImportBatches(collegeId: string, page: number, limit: number, source?: string) {
  const filter: any = { collegeId };
  if (source) filter.source = source;
  return paginate(LeadImportBatch, filter, page, limit, { createdAt: -1 });
}

export async function getImportBatch(collegeId: string, id: string) {
  const doc = await LeadImportBatch.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Import batch not found');
  return doc;
}

export async function createImportBatch(collegeId: string, data: any, performedBy: string) {
  const doc = await LeadImportBatch.create({ ...data, collegeId, importedBy: performedBy, status: 'pending' });
  await createAuditLog({
    collegeId, entityType: 'LeadImportBatch', entityId: String(doc._id),
    entityName: `${data.source} import`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

// ─── Seat Inventory ─────────────────────────────────────────

export async function listSeatInventory(collegeId: string, academicYearId?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  const items = await SeatInventory.find(filter)
    .populate('programmeId branchId')
    .sort({ 'programmeId': 1, 'branchId': 1 })
    .lean();
  return { items, total: items.length };
}

export async function getSeatInventory(collegeId: string, id: string) {
  const doc = await SeatInventory.findOne({ _id: id, collegeId }).populate('programmeId branchId').lean();
  if (!doc) throw new AppError(404, 'Seat inventory not found');
  return doc;
}

export async function upsertSeatInventory(collegeId: string, data: any, performedBy: string) {
  const doc = await SeatInventory.findOneAndUpdate(
    { collegeId, academicYearId: data.academicYearId, programmeId: data.programmeId, branchId: data.branchId },
    { $set: { ...data, collegeId, lastUpdatedBy: performedBy } },
    { new: true, upsert: true, runValidators: true },
  );
  await createAuditLog({
    collegeId, entityType: 'SeatInventory', entityId: String(doc._id),
    entityName: 'Seat Matrix', action: 'update', changes: [], performedBy,
  });
  return doc;
}

// ─── Allotment Rounds ───────────────────────────────────────

export async function listAllotmentRounds(collegeId: string, academicYearId?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  return AllotmentRound.find(filter).sort({ roundNumber: 1 }).lean();
}

export async function createAllotmentRound(collegeId: string, data: any, performedBy: string) {
  const doc = await AllotmentRound.create({ ...data, collegeId, conductedBy: performedBy });
  await createAuditLog({
    collegeId, entityType: 'AllotmentRound', entityId: String(doc._id),
    entityName: data.name, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateAllotmentRound(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AllotmentRound.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Allotment round not found');
  await createAuditLog({
    collegeId, entityType: 'AllotmentRound', entityId: id,
    entityName: doc.name, action: 'update', changes: [], performedBy,
  });
  return doc;
}

// ─── Allotment Results ──────────────────────────────────────

export async function listAllotmentResults(collegeId: string, roundId: string, page: number, limit: number) {
  return paginate(AllotmentResult, { collegeId, allotmentRoundId: roundId }, page, limit, { meritRank: 1 }, ['applicantId']);
}

export async function createAllotmentResult(collegeId: string, data: any, performedBy: string) {
  const doc = await AllotmentResult.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'AllotmentResult', entityId: String(doc._id),
    entityName: `Rank ${data.meritRank}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateAllotmentResult(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AllotmentResult.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Allotment result not found');
  await createAuditLog({
    collegeId, entityType: 'AllotmentResult', entityId: id,
    entityName: `Rank ${doc.meritRank}`, action: 'update', changes: [], performedBy,
  });
  return doc;
}

// ─── Waitlist ───────────────────────────────────────────────

export async function listWaitlist(collegeId: string, filters: { programmeId?: string; branchId?: string; quota?: string; status?: string }, page: number, limit: number) {
  const filter: any = { collegeId };
  if (filters.programmeId) filter.programmeId = filters.programmeId;
  if (filters.branchId) filter.branchId = filters.branchId;
  if (filters.quota) filter.quota = filters.quota;
  if (filters.status) filter.status = filters.status;
  return paginate(Waitlist, filter, page, limit, { waitlistPosition: 1 }, ['applicantId']);
}

export async function addToWaitlist(collegeId: string, data: any, performedBy: string) {
  const doc = await Waitlist.create({ ...data, collegeId });
  await createAuditLog({
    collegeId, entityType: 'Waitlist', entityId: String(doc._id),
    entityName: `Position ${data.waitlistPosition}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

// ─── Fee Negotiations ───────────────────────────────────────

export async function listFeeNegotiations(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(FeeNegotiation, filter, page, limit, { createdAt: -1 }, ['applicantId', 'offerId']);
}

export async function createFeeNegotiation(collegeId: string, data: any, performedBy: string) {
  // AI auto-approve threshold: ≤₹50,000
  const AI_AUTO_APPROVE_THRESHOLD = 50000;
  let status = 'pending';
  let approvalLevel = 'staff';
  let approvedWaiver = 0;
  let finalFee = data.originalFee;

  if (data.requestedWaiver <= AI_AUTO_APPROVE_THRESHOLD) {
    status = 'ai_approved';
    approvalLevel = 'ai_auto';
    approvedWaiver = data.requestedWaiver;
    finalFee = data.originalFee - data.requestedWaiver;
  } else {
    status = 'escalated';
    approvalLevel = 'leadership';
  }

  const doc = await FeeNegotiation.create({
    ...data, collegeId, negotiatedBy: performedBy,
    status, approvalLevel, approvedWaiver, finalFee,
    aiRecommendedWaiver: data.requestedWaiver <= AI_AUTO_APPROVE_THRESHOLD ? data.requestedWaiver : Math.min(data.requestedWaiver, AI_AUTO_APPROVE_THRESHOLD),
    aiConfidence: data.requestedWaiver <= AI_AUTO_APPROVE_THRESHOLD ? 0.95 : 0.60,
    aiReason: data.requestedWaiver <= AI_AUTO_APPROVE_THRESHOLD
      ? 'Waiver within auto-approval threshold'
      : `Recommended max auto-waiver of ₹${AI_AUTO_APPROVE_THRESHOLD}. Full amount requires leadership approval.`,
  });

  // If AI auto-approved, update the offer
  if (status === 'ai_approved') {
    await AdmissionOffer.findByIdAndUpdate(data.offerId, {
      negotiatedFee: finalFee,
      waiverAmount: approvedWaiver,
      waiverApprovedBy: 'AI',
      negotiationId: doc._id,
    });
  }

  await createAuditLog({
    collegeId, entityType: 'FeeNegotiation', entityId: String(doc._id),
    entityName: `Negotiation (₹${data.requestedWaiver} waiver)`, action: 'create', changes: [], performedBy,
  });

  return doc;
}

export async function resolveFeeNegotiation(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await FeeNegotiation.findOneAndUpdate(
    { _id: id, collegeId },
    {
      $set: {
        status: data.status,
        approvedWaiver: data.approvedWaiver,
        finalFee: data.finalFee,
        approvedBy: performedBy,
        counterOffer: data.counterOffer,
        counterOfferBy: data.counterOffer ? performedBy : undefined,
        resolvedAt: new Date(),
        notes: data.notes,
      },
    },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Fee negotiation not found');

  // Update the offer with resolved fee
  if (data.status === 'approved' || data.status === 'counter_offered') {
    await AdmissionOffer.findByIdAndUpdate(doc.offerId, {
      negotiatedFee: doc.finalFee,
      waiverAmount: doc.approvedWaiver,
      waiverApprovedBy: performedBy,
      negotiationId: doc._id,
    });
  }

  await createAuditLog({
    collegeId, entityType: 'FeeNegotiation', entityId: id,
    entityName: 'Negotiation resolved', action: 'update', changes: [], performedBy,
  });

  return doc;
}

// ─── Admission Cancellation ─────────────────────────────────

export async function listCancellations(collegeId: string, page: number, limit: number, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(AdmissionCancellation, filter, page, limit, { createdAt: -1 }, ['applicantId']);
}

export async function createCancellation(collegeId: string, data: any, performedBy: string) {
  const doc = await AdmissionCancellation.create({
    ...data, collegeId, requestedBy: performedBy,
    reversals: [
      { module: 'M02', action: 'Deactivate student record', status: 'pending' },
      { module: 'M04', action: 'Process refund', status: 'pending' },
      { module: 'M08', action: 'De-allocate hostel/transport', status: 'pending' },
      { module: 'M12', action: 'Deactivate user account', status: 'pending' },
      { module: 'Juvi', action: 'Deactivate Juvi account', status: 'pending' },
    ],
  });
  await createAuditLog({
    collegeId, entityType: 'AdmissionCancellation', entityId: String(doc._id),
    entityName: `Cancellation (${data.cancellationType})`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateCancellation(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AdmissionCancellation.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Cancellation not found');
  await createAuditLog({
    collegeId, entityType: 'AdmissionCancellation', entityId: id,
    entityName: 'Cancellation updated', action: 'update', changes: [], performedBy,
  });
  return doc;
}

// ─── Workflow Task Queries ──────────────────────────────────

export async function listMyTasks(collegeId: string, filters: { assigneeRole?: string; status?: string; phase?: string }, page: number, limit: number) {
  const filter: any = { collegeId };
  if (filters.assigneeRole) filter.assigneeRole = filters.assigneeRole;
  if (filters.status) filter.status = filters.status;
  if (filters.phase) filter.phase = filters.phase;
  return paginate(WorkflowTask, filter, page, limit, { createdAt: -1 });
}

// ─── Workflow Dashboard Stats ───────────────────────────────

export async function getWorkflowStats(collegeId: string) {
  const [
    activeWorkflows,
    pendingTasks,
    completedToday,
    leadsByGrade,
    seatFillRate,
    offerAcceptanceRate,
  ] = await Promise.all([
    WorkflowInstance.countDocuments({ collegeId, workflowId: 'W01', status: 'active' }),
    WorkflowTask.countDocuments({ collegeId, workflowId: 'W01', status: { $in: ['pending', 'in_progress'] } }),
    WorkflowTask.countDocuments({
      collegeId, workflowId: 'W01', status: 'completed',
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    Inquiry.aggregate([
      { $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } },
      { $group: { _id: '$leadGrade', count: { $sum: 1 } } },
    ]),
    SeatInventory.aggregate([
      { $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } },
      { $group: { _id: null, totalSeats: { $sum: '$sanctionedIntake' }, totalFilled: { $sum: '$totalFilled' } } },
    ]),
    AdmissionOffer.aggregate([
      { $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const leadGradeMap: Record<string, number> = {};
  for (const r of leadsByGrade) if (r._id) leadGradeMap[r._id] = r.count;

  const seatData = seatFillRate[0] || { totalSeats: 0, totalFilled: 0 };
  const offerStatusMap: Record<string, number> = {};
  for (const r of offerAcceptanceRate) offerStatusMap[r._id] = r.count;

  return {
    activeWorkflows,
    pendingTasks,
    completedToday,
    leadsByGrade: leadGradeMap,
    seatMatrix: {
      totalSeats: seatData.totalSeats,
      totalFilled: seatData.totalFilled,
      fillPercentage: seatData.totalSeats > 0 ? Math.round((seatData.totalFilled / seatData.totalSeats) * 10000) / 100 : 0,
    },
    offerStats: offerStatusMap,
  };
}
