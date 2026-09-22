import { Policy as RBACPolicy } from '../../models/platform/Policy';
import { invalidatePolicies } from '../../shared/rbac/cache';
import { snapshotPoliciesForCollege, defaultsDiff, applyDefaults } from '../../shared/seed/policies';
import { loadPolicies, decide } from '../../shared/rbac/engine';
import { ALL_MODULES, ALL_ACTIONS } from '../../shared/rbac/resolve-permissions';
import { Persona } from '../../models/platform/Persona';
import { User } from '../../models/User';
import { invalidatePersonas, loadPersonas, ancestryFrom } from '../../shared/rbac/persona-registry';
import { Announcement } from '../../models/communication/Announcement';
import { Circular } from '../../models/communication/Circular';
import { Notification } from '../../models/communication/Notification';
import { FeedbackSurvey } from '../../models/communication/FeedbackSurvey';
import { SurveyResponse } from '../../models/communication/SurveyResponse';
import { EmailLog } from '../../models/communication/EmailLog';
import { SMSLog } from '../../models/communication/SMSLog';
import { WhatsAppLog } from '../../models/communication/WhatsAppLog';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    announcements, circulars, notifications, feedbackSurveys,
    surveyResponses, emailLogs, smsLogs, whatsAppLogs,
    activeAnnouncements, activeSurveys, draftNotifications,
  ] = await Promise.all([
    Announcement.countDocuments({ collegeId }),
    Circular.countDocuments({ collegeId }),
    Notification.countDocuments({ collegeId }),
    FeedbackSurvey.countDocuments({ collegeId }),
    SurveyResponse.countDocuments({ collegeId }),
    EmailLog.countDocuments({ collegeId }),
    SMSLog.countDocuments({ collegeId }),
    WhatsAppLog.countDocuments({ collegeId }),
    Announcement.countDocuments({ collegeId, isPinned: true }),
    FeedbackSurvey.countDocuments({ collegeId, status: 'active' }),
    Notification.countDocuments({ collegeId, status: 'draft' }),
  ]);
  return {
    announcements, circulars, notifications, feedbackSurveys,
    surveyResponses, emailLogs, smsLogs, whatsAppLogs,
    activeAnnouncements, activeSurveys, draftNotifications,
  };
}

// ═══ Announcement ══════════════════════════════════════════

export async function listAnnouncements(collegeId: string, page = 1, limit = 20, category?: string, priority?: string) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  return paginate(Announcement, filter, page, limit, { createdAt: -1 }, ['postedBy']);
}

export async function getAnnouncement(collegeId: string, id: string) {
  const doc = await Announcement.findOne({ _id: id, collegeId }).populate('postedBy');
  if (!doc) throw new AppError(404, 'Announcement not found');
  return doc;
}

export async function createAnnouncement(collegeId: string, data: any, who: string) {
  const doc = await Announcement.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Announcement', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAnnouncement(collegeId: string, id: string, data: any, who: string) {
  const doc = await Announcement.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Announcement not found');
  await createAuditLog({ collegeId, entityType: 'Announcement', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAnnouncement(collegeId: string, id: string, who: string) {
  const doc = await Announcement.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Announcement not found');
  await createAuditLog({ collegeId, entityType: 'Announcement', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Circular ══════════════════════════════════════════════

export async function listCirculars(collegeId: string, page = 1, limit = 20, targetAudience?: string) {
  const filter: any = { collegeId };
  if (targetAudience) filter.targetAudience = targetAudience;
  return paginate(Circular, filter, page, limit, { issuedDate: -1 }, ['issuedBy']);
}

export async function getCircular(collegeId: string, id: string) {
  const doc = await Circular.findOne({ _id: id, collegeId }).populate('issuedBy');
  if (!doc) throw new AppError(404, 'Circular not found');
  return doc;
}

export async function createCircular(collegeId: string, data: any, who: string) {
  const doc = await Circular.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Circular', entityId: String(doc._id), entityName: data.circularNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCircular(collegeId: string, id: string, data: any, who: string) {
  const doc = await Circular.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Circular not found');
  await createAuditLog({ collegeId, entityType: 'Circular', entityId: id, entityName: doc.circularNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCircular(collegeId: string, id: string, who: string) {
  const doc = await Circular.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Circular not found');
  await createAuditLog({ collegeId, entityType: 'Circular', entityId: id, entityName: doc.circularNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Notification ══════════════════════════════════════════

export async function listNotifications(collegeId: string, page = 1, limit = 20, status?: string, channel?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  return paginate(Notification, filter, page, limit, { createdAt: -1 }, ['sentBy']);
}

export async function getNotification(collegeId: string, id: string) {
  const doc = await Notification.findOne({ _id: id, collegeId }).populate('sentBy');
  if (!doc) throw new AppError(404, 'Notification not found');
  return doc;
}

export async function createNotification(collegeId: string, data: any, who: string) {
  const doc = await Notification.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Notification', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateNotification(collegeId: string, id: string, data: any, who: string) {
  const doc = await Notification.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Notification not found');
  await createAuditLog({ collegeId, entityType: 'Notification', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteNotification(collegeId: string, id: string, who: string) {
  const doc = await Notification.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Notification not found');
  await createAuditLog({ collegeId, entityType: 'Notification', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Feedback Survey ═══════════════════════════════════════

export async function listFeedbackSurveys(collegeId: string, page = 1, limit = 20, status?: string, targetAudience?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (targetAudience) filter.targetAudience = targetAudience;
  return paginate(FeedbackSurvey, filter, page, limit, { createdAt: -1 }, ['createdBy']);
}

export async function getFeedbackSurvey(collegeId: string, id: string) {
  const doc = await FeedbackSurvey.findOne({ _id: id, collegeId }).populate('createdBy');
  if (!doc) throw new AppError(404, 'Feedback survey not found');
  return doc;
}

export async function createFeedbackSurvey(collegeId: string, data: any, who: string) {
  const doc = await FeedbackSurvey.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'FeedbackSurvey', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateFeedbackSurvey(collegeId: string, id: string, data: any, who: string) {
  const doc = await FeedbackSurvey.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Feedback survey not found');
  await createAuditLog({ collegeId, entityType: 'FeedbackSurvey', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteFeedbackSurvey(collegeId: string, id: string, who: string) {
  const doc = await FeedbackSurvey.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Feedback survey not found');
  await createAuditLog({ collegeId, entityType: 'FeedbackSurvey', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Survey Response ═══════════════════════════════════════

export async function listSurveyResponses(collegeId: string, page = 1, limit = 20, surveyId?: string) {
  const filter: any = { collegeId };
  if (surveyId) filter.surveyId = surveyId;
  return paginate(SurveyResponse, filter, page, limit, { submittedAt: -1 }, ['surveyId', 'respondentId']);
}

export async function getSurveyResponse(collegeId: string, id: string) {
  const doc = await SurveyResponse.findOne({ _id: id, collegeId }).populate('surveyId respondentId');
  if (!doc) throw new AppError(404, 'Survey response not found');
  return doc;
}

export async function createSurveyResponse(collegeId: string, data: any, who: string) {
  const doc = await SurveyResponse.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SurveyResponse', entityId: String(doc._id), entityName: `Response to ${data.surveyId}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateSurveyResponse(collegeId: string, id: string, data: any, who: string) {
  const doc = await SurveyResponse.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Survey response not found');
  await createAuditLog({ collegeId, entityType: 'SurveyResponse', entityId: id, entityName: `Response ${id}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteSurveyResponse(collegeId: string, id: string, who: string) {
  const doc = await SurveyResponse.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Survey response not found');
  await createAuditLog({ collegeId, entityType: 'SurveyResponse', entityId: id, entityName: `Response ${id}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Email Log ═════════════════════════════════════════════

export async function listEmailLogs(collegeId: string, page = 1, limit = 20, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(EmailLog, filter, page, limit, { sentAt: -1 }, ['recipientId']);
}

export async function getEmailLog(collegeId: string, id: string) {
  const doc = await EmailLog.findOne({ _id: id, collegeId }).populate('recipientId');
  if (!doc) throw new AppError(404, 'Email log not found');
  return doc;
}

export async function createEmailLog(collegeId: string, data: any, who: string) {
  const doc = await EmailLog.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EmailLog', entityId: String(doc._id), entityName: data.subject, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEmailLog(collegeId: string, id: string, data: any, who: string) {
  const doc = await EmailLog.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Email log not found');
  await createAuditLog({ collegeId, entityType: 'EmailLog', entityId: id, entityName: doc.subject, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEmailLog(collegeId: string, id: string, who: string) {
  const doc = await EmailLog.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Email log not found');
  await createAuditLog({ collegeId, entityType: 'EmailLog', entityId: id, entityName: doc.subject, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ SMS Log ═══════════════════════════════════════════════

export async function listSMSLogs(collegeId: string, page = 1, limit = 20, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(SMSLog, filter, page, limit, { sentAt: -1 }, ['recipientId']);
}

export async function getSMSLog(collegeId: string, id: string) {
  const doc = await SMSLog.findOne({ _id: id, collegeId }).populate('recipientId');
  if (!doc) throw new AppError(404, 'SMS log not found');
  return doc;
}

export async function createSMSLog(collegeId: string, data: any, who: string) {
  const doc = await SMSLog.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SMSLog', entityId: String(doc._id), entityName: data.recipientPhone, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateSMSLog(collegeId: string, id: string, data: any, who: string) {
  const doc = await SMSLog.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'SMS log not found');
  await createAuditLog({ collegeId, entityType: 'SMSLog', entityId: id, entityName: doc.recipientPhone, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteSMSLog(collegeId: string, id: string, who: string) {
  const doc = await SMSLog.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'SMS log not found');
  await createAuditLog({ collegeId, entityType: 'SMSLog', entityId: id, entityName: doc.recipientPhone, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ WhatsApp Log ══════════════════════════════════════════

export async function listWhatsAppLogs(collegeId: string, page = 1, limit = 20, status?: string) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  return paginate(WhatsAppLog, filter, page, limit, { sentAt: -1 }, ['recipientId']);
}

export async function getWhatsAppLog(collegeId: string, id: string) {
  const doc = await WhatsAppLog.findOne({ _id: id, collegeId }).populate('recipientId');
  if (!doc) throw new AppError(404, 'WhatsApp log not found');
  return doc;
}

export async function createWhatsAppLog(collegeId: string, data: any, who: string) {
  const doc = await WhatsAppLog.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'WhatsAppLog', entityId: String(doc._id), entityName: data.recipientPhone, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateWhatsAppLog(collegeId: string, id: string, data: any, who: string) {
  const doc = await WhatsAppLog.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'WhatsApp log not found');
  await createAuditLog({ collegeId, entityType: 'WhatsAppLog', entityId: id, entityName: doc.recipientPhone, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteWhatsAppLog(collegeId: string, id: string, who: string) {
  const doc = await WhatsAppLog.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'WhatsApp log not found');
  await createAuditLog({ collegeId, entityType: 'WhatsAppLog', entityId: id, entityName: doc.recipientPhone, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ RBAC Policy Management ══════════════════════════════

export async function listRbacPolicies(collegeId: string, page = 1, limit = 20, role?: string, module?: string) {
  const filter: any = {
    $or: [
      { collegeId },
      { collegeId: { $exists: false } },
      { collegeId: null },
    ],
  };
  // 010 P2 — a snapshotted college edits its own copy; system rows are a template.
  if (await RBACPolicy.exists({ collegeId, createdBy: 'snapshot' })) { delete filter.$or; filter.collegeId = collegeId; }
  if (role) filter.role = role;
  if (module) filter.module = module;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    RBACPolicy.find(filter).sort({ priority: -1, role: 1 }).skip(skip).limit(limit).lean(),
    RBACPolicy.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function getRbacPolicy(collegeId: string, id: string) {
  const doc = await RBACPolicy.findOne({
    _id: id,
    $or: [{ collegeId }, { collegeId: { $exists: false } }, { collegeId: null }],
  });
  if (!doc) throw new AppError(404, 'Policy not found');
  return doc;
}

export async function createRbacPolicy(collegeId: string, data: any, performedBy: string) {
  const doc = await RBACPolicy.create({
    ...data,
    collegeId,
    createdBy: performedBy,
  });
  await invalidatePolicies(collegeId);
  await createAuditLog({
    collegeId,
    entityType: 'RBACPolicy',
    entityId: String(doc._id),
    entityName: `${doc.role}:${doc.module}:${doc.action}`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateRbacPolicy(collegeId: string, id: string, data: any, performedBy: string) {
  const existing = await RBACPolicy.findById(id);
  if (!existing) throw new AppError(404, 'Policy not found');
  if (!existing.collegeId && existing.createdBy === 'seed') {
    throw new AppError(403, 'Cannot edit system default policies. Create an override instead.');
  }

  const doc = await RBACPolicy.findOneAndUpdate(
    { _id: id, collegeId },
    { ...data, updatedBy: performedBy },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Policy not found');
  await invalidatePolicies(collegeId);
  await createAuditLog({
    collegeId,
    entityType: 'RBACPolicy',
    entityId: id,
    entityName: `${doc.role}:${doc.module}:${doc.action}`,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteRbacPolicy(collegeId: string, id: string, performedBy: string) {
  const existing = await RBACPolicy.findById(id);
  if (!existing) throw new AppError(404, 'Policy not found');
  if (!existing.collegeId && existing.createdBy === 'seed') {
    throw new AppError(403, 'Cannot delete system default policies');
  }

  await RBACPolicy.findOneAndDelete({ _id: id, collegeId });
  await invalidatePolicies(collegeId);
  await createAuditLog({
    collegeId,
    entityType: 'RBACPolicy',
    entityId: id,
    entityName: `${existing.role}:${existing.module}:${existing.action}`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return { message: 'Policy deleted' };
}

// ═══ 010 — Persona catalog ═══════════════════════════════════════════


const collegeOrSystem = (collegeId: string) => ({ $or: [{ collegeId }, { collegeId: null }] });

export async function listPersonas(collegeId: string, includeInactive = false) {
  const filter: Record<string, unknown> = { ...collegeOrSystem(collegeId) };
  if (!includeInactive) filter.isActive = true;
  const docs = await Persona.find(filter).sort({ tier: 1, code: 1 }).lean();
  // A college with its own snapshot sees only its rows; system rows are the template.
  const own = docs.filter((d) => d.collegeId);
  return own.length > 0 ? own : docs;
}

export async function getPersona(collegeId: string, id: string) {
  const doc = await Persona.findOne({ _id: id, ...collegeOrSystem(collegeId) });
  if (!doc) throw new AppError(404, 'Persona not found');
  return doc;
}

export async function createPersona(collegeId: string, data: any, performedBy: string) {
  const code = String(data.code).toUpperCase();
  const clash = await Persona.findOne({ code, ...collegeOrSystem(collegeId) }).lean();
  if (clash) throw new AppError(409, `Persona code ${code} already exists`);
  if (data.parentCode) {
    const parent = await Persona.findOne({ code: data.parentCode, isActive: true, ...collegeOrSystem(collegeId) }).lean();
    if (!parent) throw new AppError(400, `Parent persona ${data.parentCode} not found`);
    data.family = parent.family;
  }
  const doc = await Persona.create({ ...data, code, family: data.family ?? code, collegeId, createdBy: performedBy });
  await invalidatePersonas(collegeId);
  await createAuditLog({ collegeId, entityType: 'Persona', entityId: String(doc._id), entityName: doc.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updatePersona(collegeId: string, id: string, data: any, performedBy: string) {
  const existing = await Persona.findOne({ _id: id, ...collegeOrSystem(collegeId) });
  if (!existing) throw new AppError(404, 'Persona not found');
  if (!existing.collegeId) throw new AppError(403, 'System personas cannot be edited. Snapshot the catalog for this college first.');
  if (data.parentCode) {
    if (data.parentCode === existing.code) throw new AppError(400, 'A persona cannot be its own parent');
    const rows = await loadPersonas(collegeId);
    if (ancestryFrom(rows, data.parentCode).includes(existing.code)) throw new AppError(400, 'Parent would create a cycle');
    const parent = rows.find((r) => r.code === data.parentCode);
    if (!parent) throw new AppError(400, `Parent persona ${data.parentCode} not found`);
    data.family = parent.family;
  }
  delete data.code;
  const doc = await Persona.findOneAndUpdate({ _id: id, collegeId }, { ...data, updatedBy: performedBy }, { new: true });
  if (!doc) throw new AppError(404, 'Persona not found');
  await invalidatePersonas(collegeId);
  await createAuditLog({ collegeId, entityType: 'Persona', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deletePersona(collegeId: string, id: string, performedBy: string) {
  const existing = await Persona.findOne({ _id: id, ...collegeOrSystem(collegeId) });
  if (!existing) throw new AppError(404, 'Persona not found');
  if (!existing.collegeId) throw new AppError(403, 'System personas cannot be deleted');
  const holders = await User.countDocuments({ collegeId, isActive: true, $or: [{ personas: existing.code }, { personaType: existing.code }] });
  if (holders > 0) throw new AppError(409, `Persona ${existing.code} is held by ${holders} active user(s); reassign them first`);
  const children = await Persona.countDocuments({ collegeId, parentCode: existing.code });
  if (children > 0) throw new AppError(409, `Persona ${existing.code} is the parent of ${children} persona(s)`);
  await Persona.deleteOne({ _id: id, collegeId });
  await invalidatePersonas(collegeId);
  await createAuditLog({ collegeId, entityType: 'Persona', entityId: id, entityName: existing.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}


// ═══ 010 P2 — policy snapshot, defaults review, matrix ═══════════════

export async function snapshotPolicies(collegeId: string, performedBy: string) {
  const copied = await snapshotPoliciesForCollege(collegeId, 'snapshot');
  await invalidatePolicies(collegeId);
  await createAuditLog({ collegeId, entityType: 'RBACPolicy', entityId: collegeId, entityName: 'snapshot', action: 'create', changes: [{ field: 'copied', displayName: 'copied', oldValue: null, newValue: copied }], performedBy });
  return { copied };
}

export function getDefaultsDiff(collegeId: string) {
  return defaultsDiff(collegeId);
}

export async function applyPolicyDefaults(collegeId: string, keys: string[], performedBy: string) {
  const applied = await applyDefaults(collegeId, keys, performedBy);
  await invalidatePolicies(collegeId);
  await createAuditLog({ collegeId, entityType: 'RBACPolicy', entityId: collegeId, entityName: 'apply-defaults', action: 'update', changes: [{ field: 'keys', displayName: 'keys', oldValue: null, newValue: keys }], performedBy });
  return { applied };
}

/** Effective allow/deny per persona × module × action, from the persona's default role. */
export async function policyMatrix(collegeId: string) {
  const personas = await loadPersonas(collegeId);
  const cells: Record<string, Record<string, Record<string, { effect: string; scope?: unknown }>>> = {};
  const byRole = new Map<string, Awaited<ReturnType<typeof loadPolicies>>>();
  for (const p of personas) {
    if (!byRole.has(p.defaultRole)) byRole.set(p.defaultRole, await loadPolicies(collegeId, p.defaultRole));
    const policies = byRole.get(p.defaultRole)!;
    const chain = ancestryFrom(personas, p.code);
    cells[p.code] = {};
    for (const mod of ALL_MODULES) {
      cells[p.code]![mod] = {};
      for (const action of ALL_ACTIONS) {
        const d = decide(policies, [chain], mod, action);
        cells[p.code]![mod]![action] = d ? { effect: d.effect, scope: d.scope } : { effect: 'none' };
      }
    }
  }
  return { personas: personas.map((p) => ({ code: p.code, label: p.label })), modules: [...ALL_MODULES], actions: [...ALL_ACTIONS], cells };
}
