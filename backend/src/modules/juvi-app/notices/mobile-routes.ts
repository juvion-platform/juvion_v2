import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './mobile-controller';

/**
 * Mobile notice routes under /api/juvi-app/v1. Authenticated per route (never
 * router-wide) because v1Router mounts this router before spacesRouter.
 */
export const noticesRouter = Router();
noticesRouter.get('/attention', authenticateMobile, ctrl.attention);
noticesRouter.get('/notices', authenticateMobile, ctrl.list);
noticesRouter.get('/notices/:id', authenticateMobile, ctrl.detail);
noticesRouter.post('/notices/:id/seen', authenticateMobile, ctrl.seen);
noticesRouter.post('/notices/:id/ack', authenticateMobile, ctrl.ack);
noticesRouter.post('/notices/:id/dismiss', authenticateMobile, ctrl.dismiss);
// The key contains slashes; the app sends it URL-encoded as one path segment.
noticesRouter.get('/notices/:id/attachments/:key', authenticateMobile, ctrl.attachmentUrl);
