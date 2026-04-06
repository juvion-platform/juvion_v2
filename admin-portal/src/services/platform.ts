import api from './api';

const BASE = '/platform';

// ─── Stats ────────────────────────────────────────────────
export const getPlatformStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Announcements ────────────────────────────────────────
export const listAnnouncements = (page = 1, limit = 20, category?: string, priority?: string) =>
  api.get(`${BASE}/announcements`, { params: { page, limit, category, priority } }).then(r => r.data);
export const getAnnouncement = (id: string) =>
  api.get(`${BASE}/announcements/${id}`).then(r => r.data);
export const createAnnouncement = (data: any) =>
  api.post(`${BASE}/announcements`, data).then(r => r.data);
export const updateAnnouncement = (id: string, data: any) =>
  api.put(`${BASE}/announcements/${id}`, data).then(r => r.data);
export const deleteAnnouncement = (id: string) =>
  api.delete(`${BASE}/announcements/${id}`).then(r => r.data);

// ─── Circulars ────────────────────────────────────────────
export const listCirculars = (page = 1, limit = 20, targetAudience?: string) =>
  api.get(`${BASE}/circulars`, { params: { page, limit, targetAudience } }).then(r => r.data);
export const getCircular = (id: string) =>
  api.get(`${BASE}/circulars/${id}`).then(r => r.data);
export const createCircular = (data: any) =>
  api.post(`${BASE}/circulars`, data).then(r => r.data);
export const updateCircular = (id: string, data: any) =>
  api.put(`${BASE}/circulars/${id}`, data).then(r => r.data);
export const deleteCircular = (id: string) =>
  api.delete(`${BASE}/circulars/${id}`).then(r => r.data);

// ─── Notifications ────────────────────────────────────────
export const listNotifications = (page = 1, limit = 20, status?: string, channel?: string) =>
  api.get(`${BASE}/notifications`, { params: { page, limit, status, channel } }).then(r => r.data);
export const getNotification = (id: string) =>
  api.get(`${BASE}/notifications/${id}`).then(r => r.data);
export const createNotification = (data: any) =>
  api.post(`${BASE}/notifications`, data).then(r => r.data);
export const updateNotification = (id: string, data: any) =>
  api.put(`${BASE}/notifications/${id}`, data).then(r => r.data);
export const deleteNotification = (id: string) =>
  api.delete(`${BASE}/notifications/${id}`).then(r => r.data);

// ─── Feedback Surveys ─────────────────────────────────────
export const listFeedbackSurveys = (page = 1, limit = 20, status?: string, targetAudience?: string) =>
  api.get(`${BASE}/feedback-surveys`, { params: { page, limit, status, targetAudience } }).then(r => r.data);
export const getFeedbackSurvey = (id: string) =>
  api.get(`${BASE}/feedback-surveys/${id}`).then(r => r.data);
export const createFeedbackSurvey = (data: any) =>
  api.post(`${BASE}/feedback-surveys`, data).then(r => r.data);
export const updateFeedbackSurvey = (id: string, data: any) =>
  api.put(`${BASE}/feedback-surveys/${id}`, data).then(r => r.data);
export const deleteFeedbackSurvey = (id: string) =>
  api.delete(`${BASE}/feedback-surveys/${id}`).then(r => r.data);

// ─── Survey Responses ─────────────────────────────────────
export const listSurveyResponses = (page = 1, limit = 20, surveyId?: string) =>
  api.get(`${BASE}/survey-responses`, { params: { page, limit, surveyId } }).then(r => r.data);
export const getSurveyResponse = (id: string) =>
  api.get(`${BASE}/survey-responses/${id}`).then(r => r.data);
export const createSurveyResponse = (data: any) =>
  api.post(`${BASE}/survey-responses`, data).then(r => r.data);
export const updateSurveyResponse = (id: string, data: any) =>
  api.put(`${BASE}/survey-responses/${id}`, data).then(r => r.data);
export const deleteSurveyResponse = (id: string) =>
  api.delete(`${BASE}/survey-responses/${id}`).then(r => r.data);

// ─── Email Logs ───────────────────────────────────────────
export const listEmailLogs = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/email-logs`, { params: { page, limit, status } }).then(r => r.data);
export const getEmailLog = (id: string) =>
  api.get(`${BASE}/email-logs/${id}`).then(r => r.data);
export const createEmailLog = (data: any) =>
  api.post(`${BASE}/email-logs`, data).then(r => r.data);
export const updateEmailLog = (id: string, data: any) =>
  api.put(`${BASE}/email-logs/${id}`, data).then(r => r.data);
export const deleteEmailLog = (id: string) =>
  api.delete(`${BASE}/email-logs/${id}`).then(r => r.data);

// ─── SMS Logs ─────────────────────────────────────────────
export const listSMSLogs = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/sms-logs`, { params: { page, limit, status } }).then(r => r.data);
export const getSMSLog = (id: string) =>
  api.get(`${BASE}/sms-logs/${id}`).then(r => r.data);
export const createSMSLog = (data: any) =>
  api.post(`${BASE}/sms-logs`, data).then(r => r.data);
export const updateSMSLog = (id: string, data: any) =>
  api.put(`${BASE}/sms-logs/${id}`, data).then(r => r.data);
export const deleteSMSLog = (id: string) =>
  api.delete(`${BASE}/sms-logs/${id}`).then(r => r.data);

// ─── WhatsApp Logs ────────────────────────────────────────
export const listWhatsAppLogs = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/whatsapp-logs`, { params: { page, limit, status } }).then(r => r.data);
export const getWhatsAppLog = (id: string) =>
  api.get(`${BASE}/whatsapp-logs/${id}`).then(r => r.data);
export const createWhatsAppLog = (data: any) =>
  api.post(`${BASE}/whatsapp-logs`, data).then(r => r.data);
export const updateWhatsAppLog = (id: string, data: any) =>
  api.put(`${BASE}/whatsapp-logs/${id}`, data).then(r => r.data);
export const deleteWhatsAppLog = (id: string) =>
  api.delete(`${BASE}/whatsapp-logs/${id}`).then(r => r.data);
