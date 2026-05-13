import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import * as bulkImportCtrl from './bulk-import-controller';
import {
  createAnnouncementSchema, updateAnnouncementSchema,
  createCircularSchema, updateCircularSchema,
  createNotificationSchema, updateNotificationSchema,
  createFeedbackSurveySchema, updateFeedbackSurveySchema,
  createSurveyResponseSchema, updateSurveyResponseSchema,
  createEmailLogSchema, updateEmailLogSchema,
  createSMSLogSchema, updateSMSLogSchema,
  createWhatsAppLogSchema, updateWhatsAppLogSchema,
  createRbacPolicySchema, updateRbacPolicySchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('platform', 'read'), ctrl.dashboardStats);

// Announcements (communication sub-domain)
router.get('/announcements', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listAnnouncements);
router.get('/announcements/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getAnnouncement);
router.post('/announcements', authorize('platform', 'create', { subDomain: 'communication' }), validate(createAnnouncementSchema), ctrl.createAnnouncement);
router.put('/announcements/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateAnnouncementSchema), ctrl.updateAnnouncement);
router.delete('/announcements/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteAnnouncement);

// Circulars (communication sub-domain)
router.get('/circulars', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listCirculars);
router.get('/circulars/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getCircular);
router.post('/circulars', authorize('platform', 'create', { subDomain: 'communication' }), validate(createCircularSchema), ctrl.createCircular);
router.put('/circulars/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateCircularSchema), ctrl.updateCircular);
router.delete('/circulars/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteCircular);

// Notifications (communication sub-domain)
router.get('/notifications', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listNotifications);
router.get('/notifications/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getNotification);
router.post('/notifications', authorize('platform', 'create', { subDomain: 'communication' }), validate(createNotificationSchema), ctrl.createNotification);
router.put('/notifications/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateNotificationSchema), ctrl.updateNotification);
router.delete('/notifications/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteNotification);

// Feedback Surveys
router.get('/feedback-surveys', authorize('platform', 'read'), ctrl.listFeedbackSurveys);
router.get('/feedback-surveys/:id', authorize('platform', 'read'), ctrl.getFeedbackSurvey);
router.post('/feedback-surveys', authorize('platform', 'create'), validate(createFeedbackSurveySchema), ctrl.createFeedbackSurvey);
router.put('/feedback-surveys/:id', authorize('platform', 'update'), validate(updateFeedbackSurveySchema), ctrl.updateFeedbackSurvey);
router.delete('/feedback-surveys/:id', authorize('platform', 'delete'), ctrl.deleteFeedbackSurvey);

// Survey Responses
router.get('/survey-responses', authorize('platform', 'read'), ctrl.listSurveyResponses);
router.get('/survey-responses/:id', authorize('platform', 'read'), ctrl.getSurveyResponse);
router.post('/survey-responses', authorize('platform', 'create'), validate(createSurveyResponseSchema), ctrl.createSurveyResponse);
router.put('/survey-responses/:id', authorize('platform', 'update'), validate(updateSurveyResponseSchema), ctrl.updateSurveyResponse);
router.delete('/survey-responses/:id', authorize('platform', 'delete'), ctrl.deleteSurveyResponse);

// Email Logs (communication sub-domain)
router.get('/email-logs', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listEmailLogs);
router.get('/email-logs/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getEmailLog);
router.post('/email-logs', authorize('platform', 'create', { subDomain: 'communication' }), validate(createEmailLogSchema), ctrl.createEmailLog);
router.put('/email-logs/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateEmailLogSchema), ctrl.updateEmailLog);
router.delete('/email-logs/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteEmailLog);

// SMS Logs (communication sub-domain)
router.get('/sms-logs', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listSMSLogs);
router.get('/sms-logs/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getSMSLog);
router.post('/sms-logs', authorize('platform', 'create', { subDomain: 'communication' }), validate(createSMSLogSchema), ctrl.createSMSLog);
router.put('/sms-logs/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateSMSLogSchema), ctrl.updateSMSLog);
router.delete('/sms-logs/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteSMSLog);

// WhatsApp Logs (communication sub-domain)
router.get('/whatsapp-logs', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.listWhatsAppLogs);
router.get('/whatsapp-logs/:id', authorize('platform', 'read', { subDomain: 'communication' }), ctrl.getWhatsAppLog);
router.post('/whatsapp-logs', authorize('platform', 'create', { subDomain: 'communication' }), validate(createWhatsAppLogSchema), ctrl.createWhatsAppLog);
router.put('/whatsapp-logs/:id', authorize('platform', 'update', { subDomain: 'communication' }), validate(updateWhatsAppLogSchema), ctrl.updateWhatsAppLog);
router.delete('/whatsapp-logs/:id', authorize('platform', 'delete', { subDomain: 'communication' }), ctrl.deleteWhatsAppLog);

// RBAC Policies (admin/principal only via authorize)
router.get('/rbac-policies', authorize('platform', 'read'), ctrl.listRbacPolicies);
router.get('/rbac-policies/:id', authorize('platform', 'read'), ctrl.getRbacPolicy);
router.post('/rbac-policies', authorize('platform', 'create'), validate(createRbacPolicySchema), ctrl.createRbacPolicy);
router.put('/rbac-policies/:id', authorize('platform', 'update'), validate(updateRbacPolicySchema), ctrl.updateRbacPolicy);
router.delete('/rbac-policies/:id', authorize('platform', 'delete'), ctrl.deleteRbacPolicy);

// ─── Bulk Imports (Strategic Gap 2 — BULKIMP sub-domain) ─────────────
// Schema-driven CSV import surface. Static endpoint-types path BEFORE
// the parameterised :id path so it never gets eaten by the matcher.
router.get(
  '/bulk-imports/entity-types',
  authorize('platform', 'read'),
  bulkImportCtrl.listEntityTypesHandler,
);
router.get(
  '/bulk-imports',
  authorize('platform', 'read'),
  bulkImportCtrl.listImportJobsHandler,
);
router.post(
  '/bulk-imports',
  authorize('platform', 'create'),
  bulkImportCtrl.importFileUpload.single('file'),
  bulkImportCtrl.importMulterErrorHandler,
  bulkImportCtrl.uploadImportHandler,
);
router.get(
  '/bulk-imports/:id',
  authorize('platform', 'read'),
  bulkImportCtrl.getImportJobHandler,
);
router.get(
  '/bulk-imports/:id/source-url',
  authorize('platform', 'read'),
  bulkImportCtrl.getImportJobSourceUrlHandler,
);
router.post(
  '/bulk-imports/:id/commit',
  authorize('platform', 'update'),
  bulkImportCtrl.commitImportJobHandler,
);
router.delete(
  '/bulk-imports/:id',
  authorize('platform', 'delete'),
  bulkImportCtrl.archiveImportJobHandler,
);

export default router;
