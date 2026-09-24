import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { signInLimiter } from '../middleware/rate-limits';
import { photoUpload, multerErrorHandler } from '../../people/photo-controller';
import * as authCtrl from './auth-controller';
import * as meCtrl from './me-controller';

export const accountsRouter = Router();

accountsRouter.post('/auth/sign-in', signInLimiter, authCtrl.signIn);
accountsRouter.post('/auth/refresh', authCtrl.refresh);
accountsRouter.post('/auth/sign-out', authenticateMobile, authCtrl.signOut);
accountsRouter.post('/auth/change-password', authenticateMobile, authCtrl.changePassword);

accountsRouter.get('/me', authenticateMobile, meCtrl.getMe);
accountsRouter.get('/me/settings', authenticateMobile, meCtrl.getSettings);
accountsRouter.patch('/me/settings', authenticateMobile, meCtrl.patchSettings);
accountsRouter.post('/me/onboarding/advance', authenticateMobile, meCtrl.advanceOnboarding);
accountsRouter.get('/me/devices', authenticateMobile, meCtrl.listDevices);
accountsRouter.delete('/me/devices/:id', authenticateMobile, meCtrl.revokeDevice);
accountsRouter.post('/me/devices/revoke-others', authenticateMobile, meCtrl.revokeOtherDevices);
accountsRouter.post('/me/photo', authenticateMobile, photoUpload.single('file'), multerErrorHandler, meCtrl.uploadPhoto);
