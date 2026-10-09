import { Router } from 'express';

import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './controller';

export const homeRouter = Router();

homeRouter.get('/today', authenticateMobile, ctrl.today);
homeRouter.get('/teaching', authenticateMobile, ctrl.teaching);
homeRouter.get('/me/academics', authenticateMobile, ctrl.academics);
