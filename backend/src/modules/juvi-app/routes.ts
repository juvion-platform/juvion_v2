import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';

/** Sub-routers register themselves onto v1Router in later tasks. */
export const v1Router = Router();

const router = Router();
router.use('/v1', v1Router);
// Anything under /api/juvi-app that no sub-router handled.
router.use((_req, _res, next) => next(new MobileApiError(404, 'NOT_FOUND', 'Route not found')));
router.use(mobileErrorHandler);

export default router;
