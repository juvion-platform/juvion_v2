/**
 * exam-config-service — CRUD for the seven exam-administration
 * master-data entities introduced in Strategic Gap 6 Phase A.
 *
 * Keeping these in a sibling file (rather than bloating the dense
 * service.ts) makes it easier to evolve them independently. The
 * routes layer pulls handlers from here and from the existing
 * controller.
 */

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';
import { ExamRoom, IExamRoom } from '../../models/academic-ops/ExamRoom';
import { Evaluator, IEvaluator } from '../../models/academic-ops/Evaluator';
import { GradeTemplate, IGradeTemplate } from '../../models/academic-ops/GradeTemplate';
import { ExamCentreTemplate, IExamCentreTemplate } from '../../models/academic-ops/ExamCentreTemplate';
import { QuestionPaperSchema, IQuestionPaperSchema } from '../../models/academic-ops/QuestionPaperSchema';
import { SignatureType, ISignatureType } from '../../models/academic-ops/SignatureType';
import { MoocSubject, IMoocSubject } from '../../models/academic-ops/MoocSubject';

// ─── Generic helpers ──────────────────────────────────────────────

type EntityId = string;

interface AuditParams {
  performedBy: string;
  entityType: string;
  entityId: EntityId;
  entityName: string;
  collegeId: string;
  action: 'create' | 'update' | 'delete';
}

async function audit(p: AuditParams) {
  await createAuditLog({
    collegeId: p.collegeId,
    entityType: p.entityType,
    entityId: p.entityId,
    entityName: p.entityName,
    action: p.action,
    changes: [],
    performedBy: p.performedBy,
  });
}

// ─── ExamRoom ─────────────────────────────────────────────────────

export async function listExamRooms(collegeId: string, page = 1, limit = 50, status?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(ExamRoom, filter, page, limit);
}

export async function getExamRoom(collegeId: string, id: string) {
  const doc = await ExamRoom.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam room not found');
  return doc;
}

export async function createExamRoom(collegeId: string, data: Partial<IExamRoom>, performedBy: string) {
  const doc = await ExamRoom.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'ExamRoom', entityId: String(doc._id), entityName: doc.name, action: 'create', performedBy });
  return doc;
}

export async function updateExamRoom(collegeId: string, id: string, data: Partial<IExamRoom>, performedBy: string) {
  const doc = await ExamRoom.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Exam room not found');
  await audit({ collegeId, entityType: 'ExamRoom', entityId: String(doc._id), entityName: doc.name, action: 'update', performedBy });
  return doc;
}

export async function deleteExamRoom(collegeId: string, id: string, performedBy: string) {
  const doc = await ExamRoom.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam room not found');
  await audit({ collegeId, entityType: 'ExamRoom', entityId: String(doc._id), entityName: doc.name, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── Evaluator ────────────────────────────────────────────────────

export async function listEvaluators(collegeId: string, page = 1, limit = 50, status?: string, kind?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  if (kind) filter.kind = kind;
  return paginate(Evaluator, filter, page, limit);
}

export async function getEvaluator(collegeId: string, id: string) {
  const doc = await Evaluator.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evaluator not found');
  return doc;
}

export async function createEvaluator(collegeId: string, data: Partial<IEvaluator>, performedBy: string) {
  const doc = await Evaluator.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'Evaluator', entityId: String(doc._id), entityName: doc.name, action: 'create', performedBy });
  return doc;
}

export async function updateEvaluator(collegeId: string, id: string, data: Partial<IEvaluator>, performedBy: string) {
  const doc = await Evaluator.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Evaluator not found');
  await audit({ collegeId, entityType: 'Evaluator', entityId: String(doc._id), entityName: doc.name, action: 'update', performedBy });
  return doc;
}

export async function deleteEvaluator(collegeId: string, id: string, performedBy: string) {
  const doc = await Evaluator.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evaluator not found');
  await audit({ collegeId, entityType: 'Evaluator', entityId: String(doc._id), entityName: doc.name, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── GradeTemplate ────────────────────────────────────────────────

export async function listGradeTemplates(collegeId: string, page = 1, limit = 50) {
  return paginate(GradeTemplate, { collegeId }, page, limit);
}

export async function getGradeTemplate(collegeId: string, id: string) {
  const doc = await GradeTemplate.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Grade template not found');
  return doc;
}

export async function createGradeTemplate(collegeId: string, data: Partial<IGradeTemplate>, performedBy: string) {
  const doc = await GradeTemplate.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'GradeTemplate', entityId: String(doc._id), entityName: doc.name, action: 'create', performedBy });
  return doc;
}

export async function updateGradeTemplate(collegeId: string, id: string, data: Partial<IGradeTemplate>, performedBy: string) {
  const doc = await GradeTemplate.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Grade template not found');
  await audit({ collegeId, entityType: 'GradeTemplate', entityId: String(doc._id), entityName: doc.name, action: 'update', performedBy });
  return doc;
}

export async function deleteGradeTemplate(collegeId: string, id: string, performedBy: string) {
  const doc = await GradeTemplate.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Grade template not found');
  await audit({ collegeId, entityType: 'GradeTemplate', entityId: String(doc._id), entityName: doc.name, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── ExamCentreTemplate ───────────────────────────────────────────

export async function listExamCentreTemplates(collegeId: string, page = 1, limit = 50) {
  return paginate(ExamCentreTemplate, { collegeId }, page, limit);
}

export async function getExamCentreTemplate(collegeId: string, id: string) {
  const doc = await ExamCentreTemplate.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam centre template not found');
  return doc;
}

export async function createExamCentreTemplate(collegeId: string, data: Partial<IExamCentreTemplate>, performedBy: string) {
  const doc = await ExamCentreTemplate.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'ExamCentreTemplate', entityId: String(doc._id), entityName: doc.name, action: 'create', performedBy });
  return doc;
}

export async function updateExamCentreTemplate(collegeId: string, id: string, data: Partial<IExamCentreTemplate>, performedBy: string) {
  const doc = await ExamCentreTemplate.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Exam centre template not found');
  await audit({ collegeId, entityType: 'ExamCentreTemplate', entityId: String(doc._id), entityName: doc.name, action: 'update', performedBy });
  return doc;
}

export async function deleteExamCentreTemplate(collegeId: string, id: string, performedBy: string) {
  const doc = await ExamCentreTemplate.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam centre template not found');
  await audit({ collegeId, entityType: 'ExamCentreTemplate', entityId: String(doc._id), entityName: doc.name, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── QuestionPaperSchema ──────────────────────────────────────────

export async function listQuestionPapers(collegeId: string, page = 1, limit = 50, status?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(QuestionPaperSchema, filter, page, limit);
}

export async function getQuestionPaper(collegeId: string, id: string) {
  const doc = await QuestionPaperSchema.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Question paper schema not found');
  return doc;
}

export async function createQuestionPaper(collegeId: string, data: Partial<IQuestionPaperSchema>, performedBy: string) {
  const doc = await QuestionPaperSchema.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'QuestionPaperSchema', entityId: String(doc._id), entityName: doc.name, action: 'create', performedBy });
  return doc;
}

export async function updateQuestionPaper(collegeId: string, id: string, data: Partial<IQuestionPaperSchema>, performedBy: string) {
  const doc = await QuestionPaperSchema.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Question paper schema not found');
  await audit({ collegeId, entityType: 'QuestionPaperSchema', entityId: String(doc._id), entityName: doc.name, action: 'update', performedBy });
  return doc;
}

export async function deleteQuestionPaper(collegeId: string, id: string, performedBy: string) {
  const doc = await QuestionPaperSchema.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Question paper schema not found');
  await audit({ collegeId, entityType: 'QuestionPaperSchema', entityId: String(doc._id), entityName: doc.name, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── SignatureType + versions ─────────────────────────────────────

export async function listSignatureTypes(collegeId: string) {
  return SignatureType.find({ collegeId }).sort({ role: 1 }).lean();
}

export async function getSignatureType(collegeId: string, id: string) {
  const doc = await SignatureType.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Signature type not found');
  return doc;
}

export async function createSignatureType(collegeId: string, data: Partial<ISignatureType>, performedBy: string) {
  const doc = await SignatureType.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'SignatureType', entityId: String(doc._id), entityName: doc.label, action: 'create', performedBy });
  return doc;
}

export async function updateSignatureType(collegeId: string, id: string, data: Partial<ISignatureType>, performedBy: string) {
  const doc = await SignatureType.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Signature type not found');
  await audit({ collegeId, entityType: 'SignatureType', entityId: String(doc._id), entityName: doc.label, action: 'update', performedBy });
  return doc;
}

export async function deleteSignatureType(collegeId: string, id: string, performedBy: string) {
  const doc = await SignatureType.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Signature type not found');
  await audit({ collegeId, entityType: 'SignatureType', entityId: String(doc._id), entityName: doc.label, action: 'delete', performedBy });
  return { deleted: true };
}

// ─── MoocSubject ──────────────────────────────────────────────────

export async function listMoocSubjects(collegeId: string, page = 1, limit = 50, status?: string) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter.status = status;
  return paginate(MoocSubject, filter, page, limit);
}

export async function getMoocSubject(collegeId: string, id: string) {
  const doc = await MoocSubject.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'MOOC subject not found');
  return doc;
}

export async function createMoocSubject(collegeId: string, data: Partial<IMoocSubject>, performedBy: string) {
  const doc = await MoocSubject.create({ ...data, collegeId });
  await audit({ collegeId, entityType: 'MoocSubject', entityId: String(doc._id), entityName: doc.title, action: 'create', performedBy });
  return doc;
}

export async function updateMoocSubject(collegeId: string, id: string, data: Partial<IMoocSubject>, performedBy: string) {
  const doc = await MoocSubject.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'MOOC subject not found');
  await audit({ collegeId, entityType: 'MoocSubject', entityId: String(doc._id), entityName: doc.title, action: 'update', performedBy });
  return doc;
}

export async function deleteMoocSubject(collegeId: string, id: string, performedBy: string) {
  const doc = await MoocSubject.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'MOOC subject not found');
  await audit({ collegeId, entityType: 'MoocSubject', entityId: String(doc._id), entityName: doc.title, action: 'delete', performedBy });
  return { deleted: true };
}
