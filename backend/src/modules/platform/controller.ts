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

// ═══ RBAC Policies ═══════════════════════════════════════

export async function listRbacPolicies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, role, module: mod } = req.query as any;
    res.json(await service.listRbacPolicies(req.collegeId!, Number(page) || 1, Number(limit) || 50, role, mod));
  } catch (err) { next(err); }
}

export async function getRbacPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRbacPolicy(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

export async function createRbacPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRbacPolicy(req.collegeId!, req.body, req.user?.name || 'System')); } catch (err) { next(err); }
}

export async function updateRbacPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRbacPolicy(req.collegeId!, req.params.id as string, req.body, req.user?.name || 'System')); } catch (err) { next(err); }
}

export async function deleteRbacPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRbacPolicy(req.collegeId!, req.params.id as string, req.user?.name || 'System')); } catch (err) { next(err); }
}

// ─── 010 Personas ─────────────────────────────────────────
export async function listPersonas(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPersonas(req.collegeId!, req.query.includeInactive === 'true')); } catch (err) { next(err); }
}
export async function getPersona(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPersona(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPersona(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPersona(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePersona(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePersona(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePersona(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePersona(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── 010 Users ────────────────────────────────────────────
import * as userService from './user-service';

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, role, persona, includeInactive } = req.query as any;
    res.json(await userService.listUsers(req.collegeId!, Number(page) || 1, Number(limit) || 20, { role, persona, includeInactive: includeInactive === 'true' }));
  } catch (err) { next(err); }
}
export async function getUser(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await userService.getUser(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createUser(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await userService.createUser(req.collegeId!, req.body, who(req), req.user!.role)); } catch (err) { next(err); }
}
export async function updateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await userService.updateUser(req.collegeId!, req.params.id as string, req.body, who(req), req.user!.role)); } catch (err) { next(err); }
}
export async function resetUserPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await userService.resetPassword(req.collegeId!, req.params.id as string, req.body.password, who(req))); } catch (err) { next(err); }
}
export async function explainUserAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { module: mod, action } = req.query as { module?: string; action?: string };
    if (!mod || !action) return res.status(400).json({ error: 'module and action are required' });
    res.json(await userService.explainAccess(req.collegeId!, req.params.id as string, mod, action));
  } catch (err) { next(err); }
}


// ─── 010 P2 policy snapshot / matrix ───────────────────────
export async function policyMatrix(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.policyMatrix(req.collegeId!)); } catch (err) { next(err); }
}
export async function policyDefaultsDiff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getDefaultsDiff(req.collegeId!)); } catch (err) { next(err); }
}
export async function applyPolicyDefaults(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter((k: unknown) => typeof k === 'string') : [];
    if (keys.length === 0) return res.status(400).json({ error: 'keys[] is required' });
    res.json(await service.applyPolicyDefaults(req.collegeId!, keys, who(req)));
  } catch (err) { next(err); }
}
export async function snapshotPolicies(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.snapshotPolicies(req.collegeId!, who(req))); } catch (err) { next(err); }
}
