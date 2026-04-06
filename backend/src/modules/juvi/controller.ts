import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Conversations ═══════════════════════════════════════

export async function listConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listConversations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getConversation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createConversation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateConversation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteConversation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Messages ════════════════════════════════════════════

export async function listMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, conversationId } = req.query as any;
    res.json(await service.listMessages(req.collegeId!, Number(page) || 1, Number(limit) || 20, conversationId));
  } catch (err) { next(err); }
}
export async function getMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMessage(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMessage(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMessage(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMessage(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Actions ═════════════════════════════════════════════

export async function listActions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, conversationId } = req.query as any;
    res.json(await service.listActions(req.collegeId!, Number(page) || 1, Number(limit) || 20, conversationId));
  } catch (err) { next(err); }
}
export async function getAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAction(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAction(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAction(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAction(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Insights ════════════════════════════════════════════

export async function listInsights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type, status } = req.query as any;
    res.json(await service.listInsights(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, status));
  } catch (err) { next(err); }
}
export async function getInsight(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getInsight(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createInsight(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInsight(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInsight(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInsight(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInsight(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInsight(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Knowledge Base ══════════════════════════════════════

export async function listKnowledgeBase(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category } = req.query as any;
    res.json(await service.listKnowledgeBase(req.collegeId!, Number(page) || 1, Number(limit) || 20, category));
  } catch (err) { next(err); }
}
export async function getKnowledgeBase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getKnowledgeBase(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createKnowledgeBase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createKnowledgeBase(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateKnowledgeBase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateKnowledgeBase(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteKnowledgeBase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteKnowledgeBase(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Persona Configs ═════════════════════════════════════

export async function listPersonaConfigs(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPersonaConfigs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getPersonaConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPersonaConfig(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPersonaConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPersonaConfig(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePersonaConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePersonaConfig(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePersonaConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePersonaConfig(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Feedback ════════════════════════════════════════════

export async function listFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listFeedback(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getFeedback(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createFeedback(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateFeedback(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteFeedback(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Usage Metrics ═══════════════════════════════════════

export async function listUsageMetrics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, personaType } = req.query as any;
    res.json(await service.listUsageMetrics(req.collegeId!, Number(page) || 1, Number(limit) || 20, personaType));
  } catch (err) { next(err); }
}
export async function getUsageMetric(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getUsageMetric(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createUsageMetric(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createUsageMetric(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateUsageMetric(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateUsageMetric(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteUsageMetric(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteUsageMetric(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
