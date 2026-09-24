import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { signInLimiter } from '../middleware/rate-limits';
import * as authCtrl from './auth-controller';

export const accountsRouter = Router();

accountsRouter.post('/auth/sign-in', signInLimiter, authCtrl.signIn);
accountsRouter.post('/auth/refresh', authCtrl.refresh);
accountsRouter.post('/auth/sign-out', authenticateMobile, authCtrl.signOut);
accountsRouter.post('/auth/change-password', authenticateMobile, authCtrl.changePassword);
// Task 11 adds the /me routes below.
