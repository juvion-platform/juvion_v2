import { Router } from 'express';
import { authorize } from '../../../middleware/authorize';
import * as ctrl from './admin-controller';

/**
 * ERP notices API (spec §7.2), mounted by admin/routes.ts at /notices, so it
 * inherits `authenticate` and the ERP `{ error }` shape from adminRouter.
 * Row-level audience scope is enforced in the service, on top of the policy.
 */
export const noticesAdminRouter = Router();

noticesAdminRouter.get('/', authorize('notices', 'read'), ctrl.list);
noticesAdminRouter.get('/targets', authorize('notices', 'create'), ctrl.targets);
noticesAdminRouter.get('/:id', authorize('notices', 'read'), ctrl.detail);
noticesAdminRouter.get('/:id/reach', authorize('notices', 'read'), ctrl.reach);
noticesAdminRouter.get('/:id/reach/pending', authorize('notices', 'read'), ctrl.pending);
noticesAdminRouter.get('/:id/reach.csv', authorize('notices', 'read'), ctrl.csv);   // admin only (service check)
noticesAdminRouter.get('/:id/audit', authorize('notices', 'read'), ctrl.audit);

noticesAdminRouter.post('/attachments', authorize('notices', 'create'), ctrl.attachmentUpload.single('file'), ctrl.attachmentUploadErrors, ctrl.upload);
noticesAdminRouter.post('/audience-preview', authorize('notices', 'create'), ctrl.preview);
noticesAdminRouter.post('/', authorize('notices', 'create'), ctrl.publish);

noticesAdminRouter.post('/:id/remind', authorize('notices', 'update'), ctrl.remind);
noticesAdminRouter.post('/:id/archive', authorize('notices', 'update'), ctrl.archive);
noticesAdminRouter.post('/:id/retry-delivery', authorize('notices', 'update'), ctrl.retry);   // admin only (service check)
