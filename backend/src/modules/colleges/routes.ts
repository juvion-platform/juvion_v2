import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createUserRateLimit } from '../../middleware/rateLimitPerUser';
import * as ctrl from './controller';
import {
  createCollegeSchema,
  updateCollegeSchema,
  updateAiSpendLimitsSchema,
} from './validation';

function superAdminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  next();
}

/**
 * L6 — gate for `PATCH /api/colleges/:id/ai-spend-limits`.
 *
 * Allowed roles: super_admin, admin, principal — these are the three roles
 * granted `platform:update` per the RBAC defaults (shared/rbac/defaults.ts).
 *
 * Cross-college rule:
 *   - super_admin may write any college via the URL `:id` (they have no
 *     `req.collegeId` from JWT, so the URL param is the source of truth).
 *   - admin / principal may only write a college whose ID matches their
 *     JWT `req.collegeId`. This prevents an admin of college A from
 *     poking at college B's spend limits via x-college-id header (which
 *     `authenticate` ignores for non-super_admin anyway, but we belt-and-
 *     braces it here for clarity).
 */
function platformUpdateGate(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== 'super_admin' && role !== 'admin' && role !== 'principal') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (role !== 'super_admin') {
    const targetId = req.params.id;
    if (!req.collegeId || req.collegeId !== targetId) {
      return res.status(403).json({ error: 'Cannot modify another college' });
    }
  }
  next();
}

const router = Router();
router.use(authenticate);

// L6: PATCH /api/colleges/:id/ai-spend-limits
//
// Mounted BEFORE the `superAdminOnly` global gate so admins / principals
// can update their own college's AI spend limits. RBAC permission contract
// is `('platform', 'update')` — `authorize()` is a no-op when
// RBAC_ENFORCE=false (e.g. in e2e tests), so the role check above does the
// load-bearing work; the `authorize()` call documents intent and enforces
// in production.
router.patch(
  '/:id/ai-spend-limits',
  platformUpdateGate,
  authorize('platform', 'update'),
  createUserRateLimit({ max: 60, windowMs: 60_000 }),
  validate(updateAiSpendLimitsSchema),
  ctrl.updateAiSpendLimits,
);

router.use(superAdminOnly);

router.get('/stats', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', validate(createCollegeSchema), ctrl.create);
router.put('/:id', validate(updateCollegeSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
