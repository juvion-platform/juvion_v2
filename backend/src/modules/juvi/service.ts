import { JuviConversation } from '../../models/juvi/JuviConversation';
import { JuviMessage } from '../../models/juvi/JuviMessage';
import { JuviAction } from '../../models/juvi/JuviAction';
import { JuviInsight } from '../../models/juvi/JuviInsight';
import { JuviKnowledgeBase } from '../../models/juvi/JuviKnowledgeBase';
import { JuviPersonaConfig } from '../../models/juvi/JuviPersonaConfig';
import { JuviFeedback } from '../../models/juvi/JuviFeedback';
import { JuviUsageMetric } from '../../models/juvi/JuviUsageMetric';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    conversations, activeConversations, messages, insights,
    activeInsights, knowledgeBase, personas, activePersonas,
    actions, feedback, usageMetrics,
  ] = await Promise.all([
    JuviConversation.countDocuments({ collegeId }),
    JuviConversation.countDocuments({ collegeId, status: 'active' }),
    JuviMessage.countDocuments({ collegeId }),
    JuviInsight.countDocuments({ collegeId }),
    JuviInsight.countDocuments({ collegeId, status: 'new' }),
    JuviKnowledgeBase.countDocuments({ collegeId }),
    JuviPersonaConfig.countDocuments({ collegeId }),
    JuviPersonaConfig.countDocuments({ collegeId, isActive: true }),
    // The Actions, Feedback and Usage Metrics hub cards had no stat to read,
    // so they rendered blank however long you waited.
    JuviAction.countDocuments({ collegeId }),
    JuviFeedback.countDocuments({ collegeId }),
    JuviUsageMetric.countDocuments({ collegeId }),
  ]);

  return {
    conversations, activeConversations, messages, insights,
    activeInsights, knowledgeBase, personas, activePersonas,
    actions, feedback, usageMetrics,
  };
}

// ═══ Conversations ═══════════════════════════════════════

export async function listConversations(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'userId' });
  return paginate(JuviConversation, filter, page, limit, { lastMessageAt: -1 });
}

export async function getConversation(collegeId: string, id: string) {
  const doc = await JuviConversation.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Conversation not found');
  return doc;
}

export async function createConversation(collegeId: string, data: any, who: string) {
  const doc = await JuviConversation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviConversation', entityId: String(doc._id), entityName: `Conversation ${doc.personaType}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateConversation(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviConversation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Conversation not found');
  await createAuditLog({ collegeId, entityType: 'JuviConversation', entityId: id, entityName: `Conversation ${doc.personaType}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteConversation(collegeId: string, id: string, who: string) {
  const doc = await JuviConversation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Conversation not found');
  await createAuditLog({ collegeId, entityType: 'JuviConversation', entityId: id, entityName: `Conversation ${doc.personaType}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Messages ════════════════════════════════════════════

export async function listMessages(collegeId: string, page = 1, limit = 20, conversationId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (conversationId) filter.conversationId = conversationId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviMessage, filter, page, limit, { createdAt: -1 }, ['conversationId']);
}

export async function getMessage(collegeId: string, id: string) {
  const doc = await JuviMessage.findOne({ _id: id, collegeId }).populate('conversationId');
  if (!doc) throw new AppError(404, 'Message not found');
  return doc;
}

export async function createMessage(collegeId: string, data: any, who: string) {
  const doc = await JuviMessage.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviMessage', entityId: String(doc._id), entityName: `Message (${doc.role})`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMessage(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviMessage.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Message not found');
  await createAuditLog({ collegeId, entityType: 'JuviMessage', entityId: id, entityName: `Message (${doc.role})`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMessage(collegeId: string, id: string, who: string) {
  const doc = await JuviMessage.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Message not found');
  await createAuditLog({ collegeId, entityType: 'JuviMessage', entityId: id, entityName: `Message (${doc.role})`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Actions ═════════════════════════════════════════════

export async function listActions(collegeId: string, page = 1, limit = 20, conversationId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (conversationId) filter.conversationId = conversationId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviAction, filter, page, limit, { createdAt: -1 }, ['conversationId']);
}

export async function getAction(collegeId: string, id: string) {
  const doc = await JuviAction.findOne({ _id: id, collegeId }).populate('conversationId');
  if (!doc) throw new AppError(404, 'Action not found');
  return doc;
}

export async function createAction(collegeId: string, data: any, who: string) {
  const doc = await JuviAction.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviAction', entityId: String(doc._id), entityName: `${doc.actionType} ${doc.module}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAction(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviAction.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Action not found');
  await createAuditLog({ collegeId, entityType: 'JuviAction', entityId: id, entityName: `${doc.actionType} ${doc.module}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAction(collegeId: string, id: string, who: string) {
  const doc = await JuviAction.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Action not found');
  await createAuditLog({ collegeId, entityType: 'JuviAction', entityId: id, entityName: `${doc.actionType} ${doc.module}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Insights ════════════════════════════════════════════

export async function listInsights(collegeId: string, page = 1, limit = 20, type?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviInsight, filter, page, limit, { generatedAt: -1 });
}

export async function getInsight(collegeId: string, id: string) {
  const doc = await JuviInsight.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Insight not found');
  return doc;
}

export async function createInsight(collegeId: string, data: any, who: string) {
  const doc = await JuviInsight.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviInsight', entityId: String(doc._id), entityName: doc.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateInsight(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviInsight.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Insight not found');
  await createAuditLog({ collegeId, entityType: 'JuviInsight', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteInsight(collegeId: string, id: string, who: string) {
  const doc = await JuviInsight.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Insight not found');
  await createAuditLog({ collegeId, entityType: 'JuviInsight', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Knowledge Base ══════════════════════════════════════

export async function listKnowledgeBase(collegeId: string, page = 1, limit = 20, category?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviKnowledgeBase, filter, page, limit, { createdAt: -1 });
}

export async function getKnowledgeBase(collegeId: string, id: string) {
  const doc = await JuviKnowledgeBase.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Knowledge base entry not found');
  return doc;
}

export async function createKnowledgeBase(collegeId: string, data: any, who: string) {
  const doc = await JuviKnowledgeBase.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviKnowledgeBase', entityId: String(doc._id), entityName: doc.question, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateKnowledgeBase(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviKnowledgeBase.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Knowledge base entry not found');
  await createAuditLog({ collegeId, entityType: 'JuviKnowledgeBase', entityId: id, entityName: doc.question, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteKnowledgeBase(collegeId: string, id: string, who: string) {
  const doc = await JuviKnowledgeBase.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Knowledge base entry not found');
  await createAuditLog({ collegeId, entityType: 'JuviKnowledgeBase', entityId: id, entityName: doc.question, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Persona Configs ═════════════════════════════════════

export async function listPersonaConfigs(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviPersonaConfig, filter, page, limit, { createdAt: -1 });
}

export async function getPersonaConfig(collegeId: string, id: string) {
  const doc = await JuviPersonaConfig.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Persona config not found');
  return doc;
}

export async function createPersonaConfig(collegeId: string, data: any, who: string) {
  const doc = await JuviPersonaConfig.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviPersonaConfig', entityId: String(doc._id), entityName: doc.displayName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePersonaConfig(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviPersonaConfig.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Persona config not found');
  await createAuditLog({ collegeId, entityType: 'JuviPersonaConfig', entityId: id, entityName: doc.displayName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePersonaConfig(collegeId: string, id: string, who: string) {
  const doc = await JuviPersonaConfig.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Persona config not found');
  await createAuditLog({ collegeId, entityType: 'JuviPersonaConfig', entityId: id, entityName: doc.displayName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Feedback ════════════════════════════════════════════

export async function listFeedback(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'userId' });
  return paginate(JuviFeedback, filter, page, limit, { createdAt: -1 }, ['messageId']);
}

export async function getFeedback(collegeId: string, id: string) {
  const doc = await JuviFeedback.findOne({ _id: id, collegeId }).populate('messageId');
  if (!doc) throw new AppError(404, 'Feedback not found');
  return doc;
}

export async function createFeedback(collegeId: string, data: any, who: string) {
  const doc = await JuviFeedback.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviFeedback', entityId: String(doc._id), entityName: `Feedback (${doc.rating})`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeedback(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviFeedback.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Feedback not found');
  await createAuditLog({ collegeId, entityType: 'JuviFeedback', entityId: id, entityName: `Feedback (${doc.rating})`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeedback(collegeId: string, id: string, who: string) {
  const doc = await JuviFeedback.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Feedback not found');
  await createAuditLog({ collegeId, entityType: 'JuviFeedback', entityId: id, entityName: `Feedback (${doc.rating})`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Usage Metrics ═══════════════════════════════════════

export async function listUsageMetrics(collegeId: string, page = 1, limit = 20, personaType?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (personaType) filter.personaType = personaType;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JuviUsageMetric, filter, page, limit, { date: -1 });
}

export async function getUsageMetric(collegeId: string, id: string) {
  const doc = await JuviUsageMetric.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Usage metric not found');
  return doc;
}

export async function createUsageMetric(collegeId: string, data: any, who: string) {
  const doc = await JuviUsageMetric.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JuviUsageMetric', entityId: String(doc._id), entityName: `${doc.personaType} ${doc.date}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateUsageMetric(collegeId: string, id: string, data: any, who: string) {
  const doc = await JuviUsageMetric.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Usage metric not found');
  await createAuditLog({ collegeId, entityType: 'JuviUsageMetric', entityId: id, entityName: `${doc.personaType} ${doc.date}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteUsageMetric(collegeId: string, id: string, who: string) {
  const doc = await JuviUsageMetric.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Usage metric not found');
  await createAuditLog({ collegeId, entityType: 'JuviUsageMetric', entityId: id, entityName: `${doc.personaType} ${doc.date}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}
