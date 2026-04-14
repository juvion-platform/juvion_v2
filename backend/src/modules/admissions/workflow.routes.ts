// ─── W01 Workflow Routes ────────────────────────────────────
// Mounted under /api/admissions/workflow

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './workflow.controller';
import {
  startWorkflowSchema, completeTaskSchema, triggerWorkflowStepSchema, failOrSkipTaskSchema,
  createLeadInteractionSchema, createImportBatchSchema,
  upsertSeatInventorySchema,
  createAllotmentRoundSchema, updateAllotmentRoundSchema,
  createAllotmentResultSchema, updateAllotmentResultSchema,
  addToWaitlistSchema,
  createFeeNegotiationSchema, resolveFeeNegotiationSchema,
  createCancellationSchema, updateCancellationSchema,
  generateMeritListSchema, approveCancellationSchema, uploadDocumentSchema,
  createSpotRoundSchema, updateSpotRoundSchema,
} from './workflow.validation';

const router = Router();
router.use(authenticate);

// ─── Workflow Engine ────────────────────────────────────────
router.get('/stats', ctrl.getWorkflowStats);
router.get('/instances', ctrl.listWorkflowInstances);
router.get('/instances/:instanceId', ctrl.getWorkflowStatus);
router.post('/instances', validate(startWorkflowSchema), ctrl.startWorkflow);
router.post('/instances/:instanceId/trigger-step', validate(triggerWorkflowStepSchema), ctrl.triggerWorkflowStep);
router.post('/tasks/:taskId/complete', validate(completeTaskSchema), ctrl.completeTask);
router.post('/tasks/:taskId/fail', validate(failOrSkipTaskSchema), ctrl.failTask);
router.post('/tasks/:taskId/skip', validate(failOrSkipTaskSchema), ctrl.skipTask);
router.get('/tasks', ctrl.listMyTasks);

// ─── Lead Interactions ──────────────────────────────────────
router.get('/inquiries/:inquiryId/interactions', ctrl.listLeadInteractions);
router.post('/inquiries/:inquiryId/interactions', validate(createLeadInteractionSchema), ctrl.createLeadInteraction);

// ─── Import Batches ─────────────────────────────────────────
router.get('/imports', ctrl.listImportBatches);
router.get('/imports/:id', ctrl.getImportBatch);
router.post('/imports', validate(createImportBatchSchema), ctrl.createImportBatch);

// ─── Seat Inventory ─────────────────────────────────────────
router.get('/seats', ctrl.listSeatInventory);
router.get('/seats/:id', ctrl.getSeatInventory);
router.put('/seats', validate(upsertSeatInventorySchema), ctrl.upsertSeatInventory);

// ─── Allotment Rounds ───────────────────────────────────────
router.get('/allotment-rounds', ctrl.listAllotmentRounds);
router.post('/allotment-rounds', validate(createAllotmentRoundSchema), ctrl.createAllotmentRound);
router.put('/allotment-rounds/:id', validate(updateAllotmentRoundSchema), ctrl.updateAllotmentRound);

// ─── Allotment Results ──────────────────────────────────────
router.get('/allotment-rounds/:roundId/results', ctrl.listAllotmentResults);
router.post('/allotment-results', validate(createAllotmentResultSchema), ctrl.createAllotmentResult);
router.put('/allotment-results/:id', validate(updateAllotmentResultSchema), ctrl.updateAllotmentResult);

// ─── Waitlist ───────────────────────────────────────────────
router.get('/waitlist', ctrl.listWaitlist);
router.post('/waitlist', validate(addToWaitlistSchema), ctrl.addToWaitlist);

// ─── Fee Negotiations ───────────────────────────────────────
router.get('/fee-negotiations', ctrl.listFeeNegotiations);
router.post('/fee-negotiations', validate(createFeeNegotiationSchema), ctrl.createFeeNegotiation);
router.put('/fee-negotiations/:id/resolve', validate(resolveFeeNegotiationSchema), ctrl.resolveFeeNegotiation);

// ─── Cancellations ──────────────────────────────────────────
router.get('/cancellations', ctrl.listCancellations);
router.post('/cancellations', validate(createCancellationSchema), ctrl.createCancellation);
router.put('/cancellations/:id', validate(updateCancellationSchema), ctrl.updateCancellation);

// ═══ W01 Business Logic Routes ═══════════════════════════

// ── Merit Lists ────────────────────────────────────────────
router.get('/merit-lists', authorize('admissions', 'read'), ctrl.listMeritListsCtrl);
router.get('/merit-lists/:id', authorize('admissions', 'read'), ctrl.getMeritListCtrl);
router.post('/merit-lists', authorize('admissions', 'create'), validate(generateMeritListSchema), ctrl.generateMeritListCtrl);
router.post('/merit-lists/:id/publish', authorize('admissions', 'update'), ctrl.publishMeritListCtrl);

// ── Allotment Algorithm ────────────────────────────────────
router.post('/allotment-rounds/:id/execute', authorize('admissions', 'update'), ctrl.executeAllotmentRoundCtrl);
router.post('/allotment-rounds/:id/publish', authorize('admissions', 'update'), ctrl.publishAllotmentResultsCtrl);
router.post('/waitlist/:id/promote', authorize('admissions', 'update'), ctrl.promoteFromWaitlistCtrl);

// ── Offer Lifecycle ────────────────────────────────────────
router.post('/offers/:id/accept', authorize('admissions', 'update'), ctrl.acceptOfferCtrl);
router.post('/offers/:id/reject', authorize('admissions', 'update'), ctrl.rejectOfferCtrl);
router.post('/offers/:id/expire', authorize('admissions', 'update'), ctrl.handleOfferExpiryCtrl);

// ── Cancellation ───────────────────────────────────────────
router.post('/cancellations/:id/approve', authorize('admissions', 'update'), validate(approveCancellationSchema), ctrl.approveCancellationCtrl);
router.post('/cancellations/:id/execute', authorize('admissions', 'update'), ctrl.executeCancellationCtrl);
router.get('/cancellations/:id/refund', authorize('admissions', 'read'), ctrl.calculateRefundCtrl);

// ── Import Execution ───────────────────────────────────────
router.post('/imports/:id/execute', authorize('admissions', 'update'), ctrl.executeImportBatchCtrl);

// ── Eligibility Checks ────────────────────────────────────
router.post('/applicants/:id/eligibility/lateral', authorize('admissions', 'read'), ctrl.checkLateralEligibilityCtrl);
router.post('/applicants/:id/eligibility/nri', authorize('admissions', 'read'), ctrl.checkNRIEligibilityCtrl);
router.post('/applicants/:id/eligibility/scholarship', authorize('admissions', 'read'), ctrl.checkScholarshipEligibilityCtrl);

// ── Document Actions ───────────────────────────────────────
router.post('/documents/:applicantId/upload', authorize('admissions', 'create'), validate(uploadDocumentSchema), ctrl.uploadDocumentCtrl);
router.post('/documents/:applicantId/ocr', authorize('admissions', 'update'), ctrl.triggerOCRCtrl);

// ── Convener Reporting ─────────────────────────────────────
router.get('/reporting-tracker', authorize('admissions', 'read'), ctrl.getReportingTrackerCtrl);
router.post('/counseling/:id/report', authorize('admissions', 'update'), ctrl.recordStudentReportingCtrl);

// ── Spot Rounds ────────────────────────────────────────────
router.get('/spot-rounds', authorize('admissions', 'read'), ctrl.listSpotRoundsCtrl);
router.post('/spot-rounds', authorize('admissions', 'create'), validate(createSpotRoundSchema), ctrl.createSpotRoundCtrl);
router.put('/spot-rounds/:id', authorize('admissions', 'update'), validate(updateSpotRoundSchema), ctrl.updateSpotRoundCtrl);

export default router;
