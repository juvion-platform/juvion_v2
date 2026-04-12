import { Committee } from '../../models/governance/Committee';
import { CommitteeMeeting } from '../../models/governance/CommitteeMeeting';
import { Policy } from '../../models/governance/Policy';
import { GoverningBodyMember } from '../../models/governance/GoverningBodyMember';
import { StrategicGoal } from '../../models/governance/StrategicGoal';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    committees, activeCommittees, meetings, scheduledMeetings,
    policies, activePolicies, boardMembers, activeBoardMembers,
    goals, activeGoals, atRiskGoals,
  ] = await Promise.all([
    Committee.countDocuments({ collegeId }),
    Committee.countDocuments({ collegeId, isActive: true }),
    CommitteeMeeting.countDocuments({ collegeId }),
    CommitteeMeeting.countDocuments({ collegeId, status: 'scheduled' }),
    Policy.countDocuments({ collegeId }),
    Policy.countDocuments({ collegeId, status: 'active' }),
    GoverningBodyMember.countDocuments({ collegeId }),
    GoverningBodyMember.countDocuments({ collegeId, isActive: true }),
    StrategicGoal.countDocuments({ collegeId }),
    StrategicGoal.countDocuments({ collegeId, status: 'active' }),
    StrategicGoal.countDocuments({ collegeId, status: 'at_risk' }),
  ]);
  return {
    committees, activeCommittees, meetings, scheduledMeetings,
    policies, activePolicies, boardMembers, activeBoardMembers,
    goals, activeGoals, atRiskGoals,
  };
}

// ═══ Committee ══════════════════════════════════════════

export async function listCommittees(collegeId: string, page = 1, limit = 20, type?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Committee, filter, page, limit, { createdAt: -1 }, ['chairpersonId', 'members.personId']);
}

export async function getCommittee(collegeId: string, id: string) {
  const doc = await Committee.findOne({ _id: id, collegeId }).populate('chairpersonId members.personId');
  if (!doc) throw new AppError(404, 'Committee not found');
  return doc;
}

export async function createCommittee(collegeId: string, data: any, who: string) {
  const doc = await Committee.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Committee', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCommittee(collegeId: string, id: string, data: any, who: string) {
  const doc = await Committee.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Committee not found');
  await createAuditLog({ collegeId, entityType: 'Committee', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCommittee(collegeId: string, id: string, who: string) {
  const doc = await Committee.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Committee not found');
  await createAuditLog({ collegeId, entityType: 'Committee', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Committee Meeting ══════════════════════════════════

export async function listMeetings(collegeId: string, page = 1, limit = 20, committeeId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (committeeId) filter.committeeId = committeeId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(CommitteeMeeting, filter, page, limit, { meetingDate: -1 }, ['committeeId', 'attendees']);
}

export async function getMeeting(collegeId: string, id: string) {
  const doc = await CommitteeMeeting.findOne({ _id: id, collegeId }).populate('committeeId attendees');
  if (!doc) throw new AppError(404, 'Meeting not found');
  return doc;
}

export async function createMeeting(collegeId: string, data: any, who: string) {
  const doc = await CommitteeMeeting.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CommitteeMeeting', entityId: String(doc._id), entityName: data.agenda, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMeeting(collegeId: string, id: string, data: any, who: string) {
  const doc = await CommitteeMeeting.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Meeting not found');
  await createAuditLog({ collegeId, entityType: 'CommitteeMeeting', entityId: id, entityName: doc.agenda, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMeeting(collegeId: string, id: string, who: string) {
  const doc = await CommitteeMeeting.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Meeting not found');
  await createAuditLog({ collegeId, entityType: 'CommitteeMeeting', entityId: id, entityName: doc.agenda, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Policy ═════════════════════════════════════════════

export async function listPolicies(collegeId: string, page = 1, limit = 20, category?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Policy, filter, page, limit, { createdAt: -1 }, ['approvedBy']);
}

export async function getPolicy(collegeId: string, id: string) {
  const doc = await Policy.findOne({ _id: id, collegeId }).populate('approvedBy');
  if (!doc) throw new AppError(404, 'Policy not found');
  return doc;
}

export async function createPolicy(collegeId: string, data: any, who: string) {
  const doc = await Policy.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Policy', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePolicy(collegeId: string, id: string, data: any, who: string) {
  const doc = await Policy.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Policy not found');
  await createAuditLog({ collegeId, entityType: 'Policy', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePolicy(collegeId: string, id: string, who: string) {
  const doc = await Policy.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Policy not found');
  await createAuditLog({ collegeId, entityType: 'Policy', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Governing Body Member ══════════════════════════════

export async function listBoardMembers(collegeId: string, page = 1, limit = 20, role?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (role) filter.role = role;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(GoverningBodyMember, filter, page, limit, { appointedDate: -1 }, ['personId']);
}

export async function getBoardMember(collegeId: string, id: string) {
  const doc = await GoverningBodyMember.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Board member not found');
  return doc;
}

export async function createBoardMember(collegeId: string, data: any, who: string) {
  const doc = await GoverningBodyMember.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'GoverningBodyMember', entityId: String(doc._id), entityName: data.externalName || data.designation, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateBoardMember(collegeId: string, id: string, data: any, who: string) {
  const doc = await GoverningBodyMember.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Board member not found');
  await createAuditLog({ collegeId, entityType: 'GoverningBodyMember', entityId: id, entityName: doc.externalName || doc.designation, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteBoardMember(collegeId: string, id: string, who: string) {
  const doc = await GoverningBodyMember.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Board member not found');
  await createAuditLog({ collegeId, entityType: 'GoverningBodyMember', entityId: id, entityName: doc.externalName || doc.designation, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Strategic Goal ═════════════════════════════════════

export async function listGoals(collegeId: string, page = 1, limit = 20, category?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(StrategicGoal, filter, page, limit, { targetDate: 1 }, ['ownerId']);
}

export async function getGoal(collegeId: string, id: string) {
  const doc = await StrategicGoal.findOne({ _id: id, collegeId }).populate('ownerId');
  if (!doc) throw new AppError(404, 'Strategic goal not found');
  return doc;
}

export async function createGoal(collegeId: string, data: any, who: string) {
  const doc = await StrategicGoal.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'StrategicGoal', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateGoal(collegeId: string, id: string, data: any, who: string) {
  const doc = await StrategicGoal.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Strategic goal not found');
  await createAuditLog({ collegeId, entityType: 'StrategicGoal', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteGoal(collegeId: string, id: string, who: string) {
  const doc = await StrategicGoal.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Strategic goal not found');
  await createAuditLog({ collegeId, entityType: 'StrategicGoal', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}
