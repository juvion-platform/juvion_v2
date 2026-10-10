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
// 011: the in-app delete. The public path (a web form + a 7-day sweep) is the other door onto the
// same `runAccountDeletion`; this one is immediate because a live session is proof enough.
accountsRouter.delete('/me/account', authenticateMobile, meCtrl.deleteAccount);
// Cancel a pending public request (Story 4 AC1) — the same clear a successful sign-in and a
// password change perform, but explicit, so a claimed row is a 409 rather than a silent 204.
accountsRouter.delete('/me/account/deletion-request', authenticateMobile, meCtrl.cancelDeletion);
