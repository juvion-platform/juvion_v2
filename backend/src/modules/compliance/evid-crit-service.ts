import mongoose from 'mongoose';
import { EvidenceType } from '../../models/compliance/EvidenceType';
import { EvidenceCollectionRule } from '../../models/compliance/EvidenceCollectionRule';
import { EvidenceRecord } from '../../models/compliance/EvidenceRecord';
import { CriterionEvidenceMapping } from '../../models/compliance/CriterionEvidenceMapping';
import { AssessmentRubric } from '../../models/compliance/AssessmentRubric';
import { ComplianceCriteria } from '../../models/compliance/ComplianceCriteria';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══ Evidence Type CRUD ════════════════════════════════════

export async function listEvidenceTypes(collegeId: string, page = 1, limit = 20, sourceModule?: string, category?: string) {
  const filter: any = { collegeId };
  if (sourceModule) filter.sourceModule = sourceModule;
  if (category) filter.category = category;
  return paginate(EvidenceType, filter, page, limit, { name: 1 });
}

export async function getEvidenceType(collegeId: string, id: string) {
  const doc = await EvidenceType.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evidence type not found');
  return doc;
}

export async function createEvidenceType(collegeId: string, data: any, performedBy: string) {
  const doc = await EvidenceType.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EvidenceType', entityId: String(doc._id), entityName: doc.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateEvidenceType(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await EvidenceType.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Evidence type not found');
  await createAuditLog({ collegeId, entityType: 'EvidenceType', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteEvidenceType(collegeId: string, id: string, performedBy: string) {
  const doc = await EvidenceType.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evidence type not found');
  await createAuditLog({ collegeId, entityType: 'EvidenceType', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return doc;
}

// ═══ Evidence Collection Rule CRUD ═════════════════════════

export async function listEvidenceCollectionRules(collegeId: string, page = 1, limit = 20, evidenceTypeId?: string) {
  const filter: any = { collegeId };
  if (evidenceTypeId) filter.evidenceTypeId = evidenceTypeId;
  return paginate(EvidenceCollectionRule, filter, page, limit, { createdAt: -1 });
}

export async function getEvidenceCollectionRule(collegeId: string, id: string) {
  const doc = await EvidenceCollectionRule.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evidence collection rule not found');
  return doc;
}

export async function createEvidenceCollectionRule(collegeId: string, data: any, performedBy: string) {
  const doc = await EvidenceCollectionRule.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EvidenceCollectionRule', entityId: String(doc._id), entityName: `Rule for ${String(doc.evidenceTypeId)}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateEvidenceCollectionRule(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await EvidenceCollectionRule.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Evidence collection rule not found');
  await createAuditLog({ collegeId, entityType: 'EvidenceCollectionRule', entityId: id, entityName: `Rule for ${String(doc.evidenceTypeId)}`, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteEvidenceCollectionRule(collegeId: string, id: string, performedBy: string) {
  const doc = await EvidenceCollectionRule.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evidence collection rule not found');
  await createAuditLog({ collegeId, entityType: 'EvidenceCollectionRule', entityId: id, entityName: `Rule for ${String(doc.evidenceTypeId)}`, action: 'delete', changes: [], performedBy });
  return doc;
}

// ═══ Evidence Record Workflow ══════════════════════════════

export async function listEvidenceRecords(collegeId: string, page = 1, limit = 20, evidenceTypeId?: string, status?: string, academicYearId?: string) {
  const filter: any = { collegeId };
  if (evidenceTypeId) filter.evidenceTypeId = evidenceTypeId;
  if (status) filter.status = status;
  if (academicYearId) filter.academicYearId = academicYearId;
  return paginate(EvidenceRecord, filter, page, limit, { createdAt: -1 });
}

export async function getEvidenceRecord(collegeId: string, id: string) {
  const doc = await EvidenceRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Evidence record not found');
  return doc;
}

export async function uploadEvidence(
  collegeId: string,
  data: {
    evidenceTypeId?: string;
    title: string;
    description?: string;
    fileUrl: string;
    academicYearId?: string;
    programmeId?: string;
    departmentId?: string;
    sourceModule?: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
  },
  performedBy: string,
) {
  // Compute quality scores
  const presence = data.fileUrl ? 100 : 0;

  const optionalFields = ['description', 'academicYearId', 'programmeId', 'departmentId', 'sourceModule', 'sourceEntityType', 'sourceEntityId'] as const;
  const filledCount = optionalFields.filter((f) => data[f]).length;
  const completeness = Math.round((filledCount / optionalFields.length) * 100);

  const recency = 100; // new upload is always recent (< 365 days)
  const quality = 70;  // placeholder

  // Weighted average: presence 25%, completeness 25%, recency 25%, quality 25%
  const composite = Math.round((presence * 0.25) + (completeness * 0.25) + (recency * 0.25) + (quality * 0.25));

  const doc = await EvidenceRecord.create({
    ...data,
    collegeId,
    status: 'collected',
    criterionCode: data.evidenceTypeId || 'UNLINKED',
    evidenceType: 'other',
    sourceModule: data.sourceModule || 'manual',
    sourceEntityType: data.sourceEntityType || 'manual_upload',
    data: { fileUrl: data.fileUrl },
    uploadedBy: performedBy,
    scores: { presence, completeness, recency, quality, composite },
  });

  await createAuditLog({ collegeId, entityType: 'EvidenceRecord', entityId: String(doc._id), entityName: doc.title, action: 'create', changes: [], performedBy });
  return doc;
}

export async function overrideEvidenceQuality(
  collegeId: string,
  evidenceId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await EvidenceRecord.findOneAndUpdate(
    { _id: evidenceId, collegeId },
    {
      qualityOverride: { overriddenBy: performedBy, reason: data.reason, overriddenAt: new Date() },
      'scores.composite': 80,
    },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Evidence record not found');
  await createAuditLog({ collegeId, entityType: 'EvidenceRecord', entityId: evidenceId, entityName: doc.title, action: 'update', changes: [{ field: 'qualityOverride', displayName: 'Quality Override', oldValue: null, newValue: data.reason }], performedBy });
  return doc;
}

export async function verifyEvidence(collegeId: string, evidenceId: string, performedBy: string) {
  const doc = await EvidenceRecord.findOne({ _id: evidenceId, collegeId });
  if (!doc) throw new AppError(404, 'Evidence record not found');
  if (doc.status !== 'collected') throw new AppError(400, 'Only collected evidence can be verified');

  doc.status = 'verified';
  await doc.save();

  await createAuditLog({ collegeId, entityType: 'EvidenceRecord', entityId: evidenceId, entityName: doc.title, action: 'update', changes: [{ field: 'status', displayName: 'Status', oldValue: 'collected', newValue: 'verified' }], performedBy });
  return doc;
}

export async function syncModuleEvidence(collegeId: string, _sourceModule: string, _performedBy: string) {
  // Placeholder for future module sync integration
  void collegeId;
  return { synced: 0, message: 'Module sync placeholder' };
}

export async function getEvidenceStats(collegeId: string) {
  // Mongoose doesn't auto-cast string → ObjectId inside .aggregate($match);
  // wrap explicitly so the aggregations actually match documents.
  const cidObj = new mongoose.Types.ObjectId(collegeId);
  const [totalRecords, byStatus, byModule] = await Promise.all([
    EvidenceRecord.countDocuments({ collegeId }),
    EvidenceRecord.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    EvidenceRecord.aggregate([
      { $match: { collegeId: cidObj } },
      { $group: { _id: '$sourceModule', count: { $sum: 1 } } },
    ]),
  ]);

  return { totalRecords, byStatus, byModule };
}

// ═══ Criterion Evidence Mapping CRUD + Suggest ═════════════

export async function listCriterionEvidenceMappings(collegeId: string, page = 1, limit = 20, criterionId?: string) {
  const filter: any = { collegeId };
  if (criterionId) filter.criterionId = criterionId;
  return paginate(CriterionEvidenceMapping, filter, page, limit, { createdAt: -1 });
}

export async function getCriterionEvidenceMapping(collegeId: string, id: string) {
  const doc = await CriterionEvidenceMapping.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Criterion evidence mapping not found');
  return doc;
}

export async function createCriterionEvidenceMapping(collegeId: string, data: any, performedBy: string) {
  const doc = await CriterionEvidenceMapping.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CriterionEvidenceMapping', entityId: String(doc._id), entityName: `Mapping ${String(doc.criterionId)}-${String(doc.evidenceTypeId)}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateCriterionEvidenceMapping(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await CriterionEvidenceMapping.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Criterion evidence mapping not found');
  await createAuditLog({ collegeId, entityType: 'CriterionEvidenceMapping', entityId: id, entityName: `Mapping ${String(doc.criterionId)}-${String(doc.evidenceTypeId)}`, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteCriterionEvidenceMapping(collegeId: string, id: string, performedBy: string) {
  const doc = await CriterionEvidenceMapping.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Criterion evidence mapping not found');
  await createAuditLog({ collegeId, entityType: 'CriterionEvidenceMapping', entityId: id, entityName: `Mapping ${String(doc.criterionId)}-${String(doc.evidenceTypeId)}`, action: 'delete', changes: [], performedBy });
  return doc;
}

export async function suggestEvidenceMappings(collegeId: string, criterionId: string) {
  // AI placeholder: find evidence types whose category matches criterion's area
  const criterion = await ComplianceCriteria.findOne({ _id: criterionId, collegeId });
  if (!criterion) throw new AppError(404, 'Criterion not found');

  // Derive area from criterion title keywords — simple heuristic mapping
  const titleLower = criterion.title.toLowerCase();
  const categoryMap: Record<string, string> = {
    academic: 'academic',
    research: 'research',
    infrastructure: 'infrastructure',
    financial: 'financial',
    governance: 'governance',
    student: 'student_support',
    faculty: 'faculty',
    outreach: 'outreach',
  };

  let matchCategory: string | undefined;
  for (const [keyword, cat] of Object.entries(categoryMap)) {
    if (titleLower.includes(keyword)) {
      matchCategory = cat;
      break;
    }
  }

  const filter: any = { collegeId, isActive: true };
  if (matchCategory) filter.category = matchCategory;

  const evidenceTypes = await EvidenceType.find(filter).lean();

  return evidenceTypes.map((et) => ({
    criterionId,
    evidenceTypeId: String(et._id),
    evidenceTypeName: et.name,
    category: et.category,
    suggestedByAI: true,
    confirmedByHuman: false,
    contributionWeight: 50,
    isMandatory: false,
  }));
}

// ═══ Assessment Rubric CRUD ════════════════════════════════

export async function listAssessmentRubrics(collegeId: string, page = 1, limit = 20, bodyId?: string, criterionId?: string) {
  const filter: any = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (criterionId) filter.criterionId = criterionId;
  return paginate(AssessmentRubric, filter, page, limit, { createdAt: -1 });
}

export async function getAssessmentRubric(collegeId: string, id: string) {
  const doc = await AssessmentRubric.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assessment rubric not found');
  return doc;
}

export async function createAssessmentRubric(collegeId: string, data: any, performedBy: string) {
  const doc = await AssessmentRubric.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AssessmentRubric', entityId: String(doc._id), entityName: `Rubric ${doc.version}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateAssessmentRubric(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AssessmentRubric.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Assessment rubric not found');
  await createAuditLog({ collegeId, entityType: 'AssessmentRubric', entityId: id, entityName: `Rubric ${doc.version}`, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteAssessmentRubric(collegeId: string, id: string, performedBy: string) {
  const doc = await AssessmentRubric.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assessment rubric not found');
  await createAuditLog({ collegeId, entityType: 'AssessmentRubric', entityId: id, entityName: `Rubric ${doc.version}`, action: 'delete', changes: [], performedBy });
  return doc;
}

// ═══ Criteria Enhancement ══════════════════════════════════

export async function interpretCriterion(
  collegeId: string,
  criterionId: string,
  data: { interpretationNotes: string; isAmbiguous?: boolean },
  performedBy: string,
) {
  const update: any = { interpretationNotes: data.interpretationNotes };
  if (data.isAmbiguous !== undefined) update.isAmbiguous = data.isAmbiguous;

  const doc = await ComplianceCriteria.findOneAndUpdate({ _id: criterionId, collegeId }, update, { new: true });
  if (!doc) throw new AppError(404, 'Criterion not found');
  await createAuditLog({ collegeId, entityType: 'ComplianceCriteria', entityId: criterionId, entityName: doc.title, action: 'update', changes: [{ field: 'interpretationNotes', displayName: 'Interpretation Notes', oldValue: null, newValue: data.interpretationNotes }], performedBy });
  return doc;
}

export async function loadFramework(
  collegeId: string,
  data: {
    bodyId: string;
    criteria: {
      criterionNumber: string;
      title: string;
      level?: string;
      parentCriterionId?: string;
      keyIndicators?: string[];
      weightage?: number;
    }[];
  },
  performedBy: string,
) {
  const docs = await ComplianceCriteria.insertMany(
    data.criteria.map((c) => ({
      collegeId,
      bodyId: data.bodyId,
      accreditationCycleId: data.bodyId, // use bodyId as placeholder cycle reference
      criterionNumber: c.criterionNumber,
      title: c.title,
      maxScore: c.weightage || 100,
      level: c.level,
      parentCriterionId: c.parentCriterionId,
      keyIndicators: c.keyIndicators,
      weightage: c.weightage,
      status: 'not_started',
    })),
  );

  await createAuditLog({ collegeId, entityType: 'ComplianceCriteria', entityId: data.bodyId, entityName: `Framework load (${docs.length} criteria)`, action: 'create', changes: [], performedBy });

  return { created: docs.length };
}
