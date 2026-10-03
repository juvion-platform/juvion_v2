import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { receiptsLimiter } from '../middleware/rate-limits';
import * as ctrl from './controller';

/**
 * Mobile notification routes under /api/juvi-app/v1 (notifications spec §7.1–§7.3).
 * Authenticated per route, never router-wide: v1Router mounts this router before
 * spacesRouter, and the receipts route has no session at all.
 */
export const notificationsRouter = Router();
notificationsRouter.put('/me/devices/current/push-token', authenticateMobile, ctrl.putPushToken);
notificationsRouter.delete('/me/devices/current/push-token', authenticateMobile, ctrl.deletePushToken);
// Posted from Android's background isolate, where the access token has usually expired.
notificationsRouter.post('/notifications/receipts', receiptsLimiter, ctrl.postReceipts);
notificationsRouter.post('/events', authenticateMobile, ctrl.postEvents);
