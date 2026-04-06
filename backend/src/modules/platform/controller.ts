import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Announcement ══════════════════════════════════════════

export async function listAnnouncements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category, priority } = req.query as any;
    res.json(await service.listAnnouncements(req.collegeId!, Number(page) || 1, Number(limit) || 20, category, priority));
  } catch (err) { next(err); }
}
export async function getAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAnnouncement(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAnnouncement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAnnouncement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAnnouncement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Circular ══════════════════════════════════════════════

export async function listCirculars(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, targetAudience } = req.query as any;
    res.json(await service.listCirculars(req.collegeId!, Number(page) || 1, Number(limit) || 20, targetAudience));
  } catch (err) { next(err); }
}
export async function getCircular(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCircular(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCircular(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCircular(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCircular(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCircular(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCircular(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCircular(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Notification ══════════════════════════════════════════

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, channel } = req.query as any;
    res.json(await service.listNotifications(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, channel));
  } catch (err) { next(err); }
}
export async function getNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getNotification(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createNotification(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateNotification(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteNotification(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Feedback Survey ═══════════════════════════════════════

export async function listFeedbackSurveys(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, targetAudience } = req.query as any;
    res.json(await service.listFeedbackSurveys(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, targetAudience));
  } catch (err) { next(err); }
}
export async function getFeedbackSurvey(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeedbackSurvey(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFeedbackSurvey(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeedbackSurvey(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFeedbackSurvey(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeedbackSurvey(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFeedbackSurvey(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeedbackSurvey(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Survey Response ═══════════════════════════════════════

export async function listSurveyResponses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, surveyId } = req.query as any;
    res.json(await service.listSurveyResponses(req.collegeId!, Number(page) || 1, Number(limit) || 20, surveyId));
  } catch (err) { next(err); }
}
export async function getSurveyResponse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSurveyResponse(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSurveyResponse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSurveyResponse(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSurveyResponse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSurveyResponse(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSurveyResponse(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSurveyResponse(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Email Log ═════════════════════════════════════════════

export async function listEmailLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listEmailLogs(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getEmailLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEmailLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEmailLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEmailLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEmailLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEmailLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEmailLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEmailLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ SMS Log ═══════════════════════════════════════════════

export async function listSMSLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listSMSLogs(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getSMSLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSMSLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSMSLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSMSLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSMSLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSMSLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSMSLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSMSLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ WhatsApp Log ══════════════════════════════════════════

export async function listWhatsAppLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listWhatsAppLogs(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
  } catch (err) { next(err); }
}
export async function getWhatsAppLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getWhatsAppLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createWhatsAppLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createWhatsAppLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateWhatsAppLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateWhatsAppLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteWhatsAppLog(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteWhatsAppLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
