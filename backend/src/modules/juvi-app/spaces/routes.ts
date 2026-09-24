import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './controller';

export const spacesRouter = Router();
spacesRouter.use(authenticateMobile);
spacesRouter.get('/spaces', ctrl.listSpaces);
spacesRouter.get('/channels/:id', ctrl.getChannel);
spacesRouter.put('/channels/:id/mute', ctrl.mute);
spacesRouter.delete('/channels/:id/mute', ctrl.unmute);
spacesRouter.post('/channels/:id/read', ctrl.markRead);
// Deliberately no POST /channels, join, leave, invite or discover (SPC-07).
