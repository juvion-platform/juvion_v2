import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { errorHandler, AppError } from '../../../middleware/errorHandler';
import { settingsUpdateSchema } from './schemas';
import * as settingsCtrl from './settings-controller';

/**
 * ERP-side administration of Juvi. ERP auth chain, ERP error shape.
 * Mounted by ../routes.ts at /api/juvi-app/admin, ahead of the mobile 404 catch-all.
 */
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get('/settings', authorize('platform', 'read'), settingsCtrl.getSettings);
adminRouter.put('/settings', authorize('platform', 'update'), validate(settingsUpdateSchema), settingsCtrl.updateSettings);

// Tasks 2–4 add provisioning, accounts and channels routes above this line.
adminRouter.use((_req, _res, next) => next(new AppError(404, 'Not found')));
adminRouter.use(errorHandler);
