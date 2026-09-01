/**
 * 008 Phase 3 — People agent routes, mounted at /api/juvi/people-agent/*.
 *
 * Authorized on `welfare`, NOT `juvi`: a mentor or dean of students owns this
 * surface and typically holds no `juvi` grant. Same reasoning as the finance
 * agent authorizing on `finance` rather than on its own module.
 */
import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { createUserRateLimit } from '../../../middleware/rateLimitPerUser';
import * as ctrl from './controller';
import {
  alertNarrationsSchema,
  outreachDraftsSchema,
  approveOutreachSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Matches the finance agent's shared limiter.
const peopleAgentRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 });

router.post(
  '/narrations',
  authorize('welfare', 'read'),
  peopleAgentRateLimit,
  validate(alertNarrationsSchema),
  ctrl.alertNarrationsHandler,
);

router.post(
  '/outreach-drafts',
  authorize('welfare', 'read'),
  peopleAgentRateLimit,
  validate(outreachDraftsSchema),
  ctrl.outreachDraftsHandler,
);

router.post(
  '/outreach-drafts/approve',
  authorize('welfare', 'update'),
  peopleAgentRateLimit,
  validate(approveOutreachSchema),
  ctrl.approveOutreachHandler,
);

export default router;
