import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';
import { configRouter } from './config/routes';
import { accountsRouter } from './accounts/routes';
import { spacesRouter } from './spaces/routes';
import { adminRouter } from './admin/routes';

export const v1Router = Router();
v1Router.use(configRouter);
v1Router.use(accountsRouter);
v1Router.use(spacesRouter);

const router = Router();
router.use('/v1', v1Router);
router.use('/admin', adminRouter);
// Anything under /api/juvi-app that no sub-router handled.
router.use((_req, _res, next) => next(new MobileApiError(404, 'NOT_FOUND', 'Route not found')));
router.use(mobileErrorHandler);

export default router;
