import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as wfSvc from './workflow.service';
import * as intakeService from './intake-service';
import * as engine from '../../shared/workflow/WorkflowEngine';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Workflow Engine ────────────────────────────────────────

export async function startWorkflow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const instance = await engine.startWorkflow({
      workflowId: req.body.workflowId || 'W01',
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      collegeId: req.collegeId!,
      academicYearId: req.body.academicYearId,
      initiatedBy: who(req),
      metadata: req.body.metadata,
    });
    res.status(201).json(instance);
  } catch (e) { next(e); }
}

export async function completeTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await engine.completeTask({
      taskId: req.params.taskId as string,
      collegeId: req.collegeId!,
      completedBy: who(req),
      result: req.body.result,
      notes: req.body.notes,
    });
    res.json(result);
  } catch (e) { next(e); }
}

export async function triggerWorkflowStep(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await engine.triggerWorkflowStep({
      instanceId: req.params.instanceId as string,
      collegeId: req.collegeId!,
      stepId: req.body.stepId,
      triggeredBy: who(req),
      metadata: req.body.metadata,
      notes: req.body.notes,
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function failTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const task = await engine.failTask(req.params.taskId as string, req.collegeId!, who(req), req.body.reason);
    res.json(task);
  } catch (e) { next(e); }
}

export async function skipTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const task = await engine.skipTask(req.params.taskId as string, req.collegeId!, who(req), req.body.reason);
    res.json(task);
  } catch (e) { next(e); }
}

export async function getWorkflowStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await engine.getWorkflowStatus(req.params.instanceId as string, req.collegeId!);
    res.json(data);
  } catch (e) { next(e); }
}

export async function listWorkflowInstances(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { workflowId, entityType, entityId, status, page = '1', limit = '20' } = req.query as any;
    const data = await engine.listWorkflowInstances(req.collegeId!, {
      workflowId, entityType, entityId, status, page: +page, limit: +limit,
    });
    res.json(data);
  } catch (e) { next(e); }
}

// ─── Lead Interactions ──────────────────────────────────────

export async function listLeadInteractions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await wfSvc.listLeadInteractions(req.collegeId!, req.params.inquiryId as string, +page, +limit));
  } catch (e) { next(e); }
}

export async function createLeadInteraction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await wfSvc.createLeadInteraction(req.collegeId!, { ...req.body, inquiryId: req.params.inquiryId }, who(req)));
  } catch (e) { next(e); }
}

// ─── Import Batches ─────────────────────────────────────────

export async function listImportBatches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', source } = req.query as any;
    res.json(await wfSvc.listImportBatches(req.collegeId!, +page, +limit, source));
  } catch (e) { next(e); }
}

export async function getImportBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.getImportBatch(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function createImportBatch(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.createImportBatch(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Seat Inventory ─────────────────────────────────────────

export async function listSeatInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as any;
    res.json(await wfSvc.listSeatInventory(req.collegeId!, academicYearId));
  } catch (e) { next(e); }
}

export async function getSeatInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.getSeatInventory(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function upsertSeatInventory(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.upsertSeatInventory(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Allotment Rounds ───────────────────────────────────────

export async function listAllotmentRounds(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as any;
    res.json(await wfSvc.listAllotmentRounds(req.collegeId!, academicYearId));
  } catch (e) { next(e); }
}

export async function createAllotmentRound(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.createAllotmentRound(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateAllotmentRound(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.updateAllotmentRound(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Allotment Results ──────────────────────────────────────

export async function listAllotmentResults(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await wfSvc.listAllotmentResults(req.collegeId!, req.params.roundId as string, +page, +limit));
  } catch (e) { next(e); }
}

export async function createAllotmentResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.createAllotmentResult(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateAllotmentResult(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.updateAllotmentResult(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Waitlist ───────────────────────────────────────────────

export async function listWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { programmeId, branchId, quota, status, page = '1', limit = '20' } = req.query as any;
    res.json(await wfSvc.listWaitlist(req.collegeId!, { programmeId, branchId, quota, status }, +page, +limit));
  } catch (e) { next(e); }
}

export async function addToWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.addToWaitlist(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Fee Negotiations ───────────────────────────────────────

export async function listFeeNegotiations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await wfSvc.listFeeNegotiations(req.collegeId!, +page, +limit, status));
  } catch (e) { next(e); }
}

export async function createFeeNegotiation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.createFeeNegotiation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function resolveFeeNegotiation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.resolveFeeNegotiation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── Cancellations ──────────────────────────────────────────

export async function listCancellations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    res.json(await wfSvc.listCancellations(req.collegeId!, +page, +limit, status));
  } catch (e) { next(e); }
}

export async function createCancellation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await wfSvc.createCancellation(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateCancellation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.updateCancellation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

// ─── My Tasks ───────────────────────────────────────────────

export async function listMyTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { assigneeRole, status, phase, page = '1', limit = '20' } = req.query as any;
    res.json(await wfSvc.listMyTasks(req.collegeId!, { assigneeRole, status, phase }, +page, +limit));
  } catch (e) { next(e); }
}

// ─── Workflow Stats ─────────────────────────────────────────

export async function getWorkflowStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await wfSvc.getWorkflowStats(req.collegeId!)); } catch (e) { next(e); }
}

// ═══ W01 Business Logic Controllers ═══════════════════════

// ── Merit List ─────────────────────────────────────────────

export async function listMeritListsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20', allotmentRoundId } = req.query as any;
    res.json(await intakeService.listMeritLists(req.collegeId!, +page, +limit, allotmentRoundId));
  } catch (e) { next(e); }
}

export async function getMeritListCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.getMeritList(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function generateMeritListCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await intakeService.generateMeritList(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function publishMeritListCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.publishMeritList(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Allotment ──────────────────────────────────────────────

export async function executeAllotmentRoundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.executeAllotmentRound(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function publishAllotmentResultsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.publishAllotmentResults(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function promoteFromWaitlistCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.promoteFromWaitlist(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Offer Lifecycle ────────────────────────────────────────

export async function acceptOfferCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.acceptOffer(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function rejectOfferCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.rejectOffer(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function handleOfferExpiryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.handleOfferExpiry(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Cancellation ───────────────────────────────────────────

export async function approveCancellationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.approveCancellation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}

export async function executeCancellationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.executeCancellation(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

export async function calculateRefundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.calculateRefund(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

// ── Import ─────────────────────────────────────────────────

export async function executeImportBatchCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.executeImportBatch(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Eligibility ────────────────────────────────────────────

export async function checkLateralEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.checkLateralEligibility(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function checkNRIEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.checkNRIEligibility(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

export async function checkScholarshipEligibilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.checkScholarshipEligibility(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}

// ── Documents ──────────────────────────────────────────────

export async function uploadDocumentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.uploadDocument(req.collegeId!, req.params.applicantId as string, req.body, who(req))); } catch (e) { next(e); }
}

export async function triggerOCRCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.triggerOCR(req.collegeId!, req.params.applicantId as string, who(req))); } catch (e) { next(e); }
}

// ── Convener ───────────────────────────────────────────────

export async function getReportingTrackerCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { academicYearId } = req.query as any;
    res.json(await intakeService.getReportingTracker(req.collegeId!, academicYearId));
  } catch (e) { next(e); }
}

export async function recordStudentReportingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.recordStudentReporting(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ── Spot Round ─────────────────────────────────────────────

export async function listSpotRoundsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page = '1', limit = '20' } = req.query as any;
    res.json(await intakeService.listSpotRounds(req.collegeId!, +page, +limit));
  } catch (e) { next(e); }
}

export async function createSpotRoundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await intakeService.createSpotRound(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}

export async function updateSpotRoundCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await intakeService.updateSpotRound(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
