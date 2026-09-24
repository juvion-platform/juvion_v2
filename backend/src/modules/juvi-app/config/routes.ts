import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { institutionLookupLimiter } from '../middleware/rate-limits';
import * as ctrl from './controller';

export const configRouter = Router();
configRouter.get('/institutions/:code', institutionLookupLimiter, ctrl.lookupInstitution);
configRouter.get('/config', authenticateMobile, ctrl.getConfig);
