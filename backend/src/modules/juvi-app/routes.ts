import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';
import { configRouter } from './config/routes';
import { accountsRouter } from './accounts/routes';
import { spacesRouter } from './spaces/routes';
import { adminRouter } from './admin/routes';
import { registerNoticeConsumers } from './notices/consumers';
import { noticesRouter } from './notices/mobile-routes';
import { registerNotificationConsumers } from './notifications';
import { notificationsRouter } from './notifications/routes';
import { homeRouter } from './home/routes';

// Outbox consumers for notices and notifications; the dispatcher (server.ts) and inline kick() both run them.
registerNoticeConsumers();
registerNotificationConsumers();

export const v1Router = Router();
v1Router.use(configRouter);
v1Router.use(accountsRouter);
// Before spacesRouter: its router-wide authenticateMobile would otherwise run first for these paths too
// (and /notifications/receipts has no session at all).
v1Router.use(noticesRouter);
v1Router.use(notificationsRouter);
v1Router.use(homeRouter);   // §7: /today, /teaching, /me/academics — after notificationsRouter, before spacesRouter
v1Router.use(spacesRouter);

const router = Router();
router.use('/v1', v1Router);
router.use('/admin', adminRouter);
// Anything under /api/juvi-app that no sub-router handled.
router.use((_req, _res, next) => next(new MobileApiError(404, 'NOT_FOUND', 'Route not found')));
router.use(mobileErrorHandler);

export default router;
