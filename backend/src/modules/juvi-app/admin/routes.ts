import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { errorHandler, AppError } from '../../../middleware/errorHandler';
import { settingsUpdateSchema } from './schemas';
import * as settingsCtrl from './settings-controller';
import * as provisioningCtrl from './provisioning-controller';
import * as accountsCtrl from './accounts-controller';
import * as channelsCtrl from './channels-controller';

/**
 * ERP-side administration of Juvi. ERP auth chain, ERP error shape.
 * Mounted by ../routes.ts at /api/juvi-app/admin, ahead of the mobile 404 catch-all.
 */
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get('/settings', authorize('platform', 'read'), settingsCtrl.getSettings);
adminRouter.put('/settings', authorize('platform', 'update'), validate(settingsUpdateSchema), settingsCtrl.updateSettings);

adminRouter.post('/provisioning/runs', authorize('platform', 'create'), provisioningCtrl.createRun);
adminRouter.get('/provisioning/runs', authorize('platform', 'read'), provisioningCtrl.listRuns);
adminRouter.get('/provisioning/runs/:id', authorize('platform', 'read'), provisioningCtrl.getRun);
adminRouter.get('/provisioning/runs/:id/credential-groups', authorize('platform', 'read'), provisioningCtrl.credentialGroups);
// Reveals secrets: 'create', matching the spec's rule that anything exposing a credential needs the higher permission.
adminRouter.get('/provisioning/runs/:id/credentials.csv', authorize('platform', 'create'), provisioningCtrl.credentialsCsv);

adminRouter.get('/accounts', authorize('platform', 'read'), accountsCtrl.listAccounts);
adminRouter.post('/accounts/:id/deactivate', authorize('platform', 'update'), accountsCtrl.deactivate);
adminRouter.post('/accounts/:id/reset-password', authorize('platform', 'update'), accountsCtrl.resetPassword);
adminRouter.post('/accounts/:id/reveal-credential', authorize('platform', 'create'), accountsCtrl.revealCredential);

adminRouter.get('/channels', authorize('platform', 'read'), channelsCtrl.listChannels);
adminRouter.get('/templates', authorize('platform', 'read'), channelsCtrl.listTemplates);
adminRouter.post('/reconcile', authorize('platform', 'update'), channelsCtrl.reconcileNow);

adminRouter.use((_req, _res, next) => next(new AppError(404, 'Not found')));
adminRouter.use(errorHandler);
