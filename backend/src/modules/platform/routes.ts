import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createAnnouncementSchema, updateAnnouncementSchema,
  createCircularSchema, updateCircularSchema,
  createNotificationSchema, updateNotificationSchema,
  createFeedbackSurveySchema, updateFeedbackSurveySchema,
  createSurveyResponseSchema, updateSurveyResponseSchema,
  createEmailLogSchema, updateEmailLogSchema,
  createSMSLogSchema, updateSMSLogSchema,
  createWhatsAppLogSchema, updateWhatsAppLogSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// Announcements
router.get('/announcements', ctrl.listAnnouncements);
router.get('/announcements/:id', ctrl.getAnnouncement);
router.post('/announcements', validate(createAnnouncementSchema), ctrl.createAnnouncement);
router.put('/announcements/:id', validate(updateAnnouncementSchema), ctrl.updateAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

// Circulars
router.get('/circulars', ctrl.listCirculars);
router.get('/circulars/:id', ctrl.getCircular);
router.post('/circulars', validate(createCircularSchema), ctrl.createCircular);
router.put('/circulars/:id', validate(updateCircularSchema), ctrl.updateCircular);
router.delete('/circulars/:id', ctrl.deleteCircular);

// Notifications
router.get('/notifications', ctrl.listNotifications);
router.get('/notifications/:id', ctrl.getNotification);
router.post('/notifications', validate(createNotificationSchema), ctrl.createNotification);
router.put('/notifications/:id', validate(updateNotificationSchema), ctrl.updateNotification);
router.delete('/notifications/:id', ctrl.deleteNotification);

// Feedback Surveys
router.get('/feedback-surveys', ctrl.listFeedbackSurveys);
router.get('/feedback-surveys/:id', ctrl.getFeedbackSurvey);
router.post('/feedback-surveys', validate(createFeedbackSurveySchema), ctrl.createFeedbackSurvey);
router.put('/feedback-surveys/:id', validate(updateFeedbackSurveySchema), ctrl.updateFeedbackSurvey);
router.delete('/feedback-surveys/:id', ctrl.deleteFeedbackSurvey);

// Survey Responses
router.get('/survey-responses', ctrl.listSurveyResponses);
router.get('/survey-responses/:id', ctrl.getSurveyResponse);
router.post('/survey-responses', validate(createSurveyResponseSchema), ctrl.createSurveyResponse);
router.put('/survey-responses/:id', validate(updateSurveyResponseSchema), ctrl.updateSurveyResponse);
router.delete('/survey-responses/:id', ctrl.deleteSurveyResponse);

// Email Logs
router.get('/email-logs', ctrl.listEmailLogs);
router.get('/email-logs/:id', ctrl.getEmailLog);
router.post('/email-logs', validate(createEmailLogSchema), ctrl.createEmailLog);
router.put('/email-logs/:id', validate(updateEmailLogSchema), ctrl.updateEmailLog);
router.delete('/email-logs/:id', ctrl.deleteEmailLog);

// SMS Logs
router.get('/sms-logs', ctrl.listSMSLogs);
router.get('/sms-logs/:id', ctrl.getSMSLog);
router.post('/sms-logs', validate(createSMSLogSchema), ctrl.createSMSLog);
router.put('/sms-logs/:id', validate(updateSMSLogSchema), ctrl.updateSMSLog);
router.delete('/sms-logs/:id', ctrl.deleteSMSLog);

// WhatsApp Logs
router.get('/whatsapp-logs', ctrl.listWhatsAppLogs);
router.get('/whatsapp-logs/:id', ctrl.getWhatsAppLog);
router.post('/whatsapp-logs', validate(createWhatsAppLogSchema), ctrl.createWhatsAppLog);
router.put('/whatsapp-logs/:id', validate(updateWhatsAppLogSchema), ctrl.updateWhatsAppLog);
router.delete('/whatsapp-logs/:id', ctrl.deleteWhatsAppLog);

export default router;
