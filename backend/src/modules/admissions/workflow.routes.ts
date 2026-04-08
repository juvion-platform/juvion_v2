// ─── W01 Workflow Routes ────────────────────────────────────
// Mounted under /api/admissions/workflow

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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

export default router;
