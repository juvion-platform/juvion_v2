/**
 * Task A5 — HTTP routes for the finance-agent module.
 *
 * Mounted by `backend/src/modules/juvi/routes.ts` under
 *   `/api/juvi/finance-agent/*`
 *
 * The seven endpoints (per plan §1.9):
 *   POST  /query                                 — SSE chat
 *   POST  /forecast-narrative                    — projection + narrative
 *   POST  /risk-scores                           — deterministic + opt-in narrative
 *   POST  /situations                            — agent findings
 *   POST  /reminder-drafts                       — drafts (HITL)
 *   POST  /reminder-drafts/approve               — approve + enqueue
 *   POST  /situations/:fingerprint/dismiss       — snooze a situation
 *
 * All routes are guarded by `authenticate` + per-action `authorize()`
 * (read for read-only, update for state-changing ops). A shared
 * per-user rate-limit `feeAgentRateLimit` (60/min/user) is applied to
 * every route — generous enough for a chatty Finance Officer flow but
 * cheap to floods of automation. The `/situations/:fingerprint/dismiss`
 * test in the e2e suite asserts a 429 within 65 attempts; 60/min lets
 * that fire deterministically.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.9
 */

import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { createUserRateLimit } from '../../../middleware/rateLimitPerUser';

import * as ctrl from './controller';
import {
  chatQuerySchema,
  forecastNarrativeSchema,
  riskScoresSchema,
  situationsSchema,
  reminderDraftsSchema,
  approveDraftsSchema,
  dismissSituationSchema,
} from './validation';

const router = Router();

// Auth applies to every endpoint in this router.
router.use(authenticate);

// One shared per-user limiter. 60 req/min/user lets the dismiss endpoint
// reach its 429 boundary inside the e2e smoke test (which fires 65 calls
// from a single user) while leaving plenty of headroom for normal chat
// usage. Per-endpoint custom limits can be layered on later if abuse
// shaping shows up in production.
const feeAgentRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 });

// ── POST /query  (Server-Sent Events) ─────────────────────────────────
router.post(
  '/query',
  authorize('juvi', 'read'),
  feeAgentRateLimit,
  validate(chatQuerySchema),
  ctrl.chatHandler,
);

// ── POST /forecast-narrative ──────────────────────────────────────────
router.post(
  '/forecast-narrative',
  authorize('finance', 'read'),
  feeAgentRateLimit,
  validate(forecastNarrativeSchema),
  ctrl.forecastNarrativeHandler,
);

// ── POST /risk-scores ─────────────────────────────────────────────────
router.post(
  '/risk-scores',
  authorize('finance', 'read'),
  feeAgentRateLimit,
  validate(riskScoresSchema),
  ctrl.riskScoresHandler,
);

// ── POST /situations ──────────────────────────────────────────────────
router.post(
  '/situations',
  authorize('finance', 'read'),
  feeAgentRateLimit,
  validate(situationsSchema),
  ctrl.situationsHandler,
);

// ── POST /reminder-drafts ─────────────────────────────────────────────
router.post(
  '/reminder-drafts',
  authorize('finance', 'read'),
  feeAgentRateLimit,
  validate(reminderDraftsSchema),
  ctrl.reminderDraftsHandler,
);

// ── POST /reminder-drafts/approve ─────────────────────────────────────
//
// Declared BEFORE `/situations/:fingerprint/dismiss` is irrelevant
// (different prefixes), but keeping the order matches the order of the
// docs above for easy scanning.
router.post(
  '/reminder-drafts/approve',
  authorize('finance', 'update'),
  feeAgentRateLimit,
  validate(approveDraftsSchema),
  ctrl.approveDraftsHandler,
);

// ── POST /situations/:fingerprint/dismiss ─────────────────────────────
router.post(
  '/situations/:fingerprint/dismiss',
  authorize('finance', 'update'),
  feeAgentRateLimit,
  validate(dismissSituationSchema),
  ctrl.dismissSituationHandler,
);

export default router;
