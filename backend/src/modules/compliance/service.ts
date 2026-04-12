import { AccreditationBody } from '../../models/compliance/AccreditationBody';
import { AccreditationCycle } from '../../models/compliance/AccreditationCycle';
import { ComplianceCriteria } from '../../models/compliance/ComplianceCriteria';
import { RegulatoryFiling } from '../../models/compliance/RegulatoryFiling';
import { AICTEApproval } from '../../models/compliance/AICTEApproval';
import { AffiliationStatus } from '../../models/compliance/AffiliationStatus';
import { AuditFinding } from '../../models/compliance/AuditFinding';
import { IQACReport } from '../../models/compliance/IQACReport';
import { RTIRequest } from '../../models/compliance/RTIRequest';
import { LegalCase } from '../../models/compliance/LegalCase';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const BODY_POPULATE = 'bodyId';
const CYCLE_POPULATE = [{ path: 'accreditationCycleId', populate: { path: 'bodyId' } }];
const YEAR_POPULATE = 'academicYearId';
const PERSON_POPULATE = 'assignedTo';
const PROGRAMME_POPULATE = 'programmes';
const AICTE_POPULATE = [
  { path: 'academicYearId' },
  { path: 'approvedIntake.programmeId' },
  { path: 'approvedIntake.branchId' },
];

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    accreditationBodies, accreditationCycles, complianceCriteria,
    regulatoryFilings, aicteApprovals, affiliationStatuses,
    auditFindings, iqacReports, rtiRequests, legalCases,
    activeAccreditations, openFindings, pendingFilings, activeCases,
  ] = await Promise.all([
    AccreditationBody.countDocuments({ collegeId }),
    AccreditationCycle.countDocuments({ collegeId }),
    ComplianceCriteria.countDocuments({ collegeId }),
    RegulatoryFiling.countDocuments({ collegeId }),
    AICTEApproval.countDocuments({ collegeId }),
    AffiliationStatus.countDocuments({ collegeId }),
    AuditFinding.countDocuments({ collegeId }),
    IQACReport.countDocuments({ collegeId }),
    RTIRequest.countDocuments({ collegeId }),
    LegalCase.countDocuments({ collegeId }),
    AccreditationCycle.countDocuments({ collegeId, status: 'accredited' }),
    AuditFinding.countDocuments({ collegeId, status: 'open' }),
    RegulatoryFiling.countDocuments({ collegeId, status: { $in: ['upcoming', 'in_progress'] } }),
    LegalCase.countDocuments({ collegeId, status: { $in: ['active', 'hearing'] } }),
  ]);
  return {
    accreditationBodies, accreditationCycles, complianceCriteria,
    regulatoryFilings, aicteApprovals, affiliationStatuses,
    auditFindings, iqacReports, rtiRequests, legalCases,
    activeAccreditations, openFindings, pendingFilings, activeCases,
  };
}

// ═══ Accreditation Body ═════════════════════════════════════

export async function listAccreditationBodies(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AccreditationBody, filter, page, limit, { name: 1 });
}

export async function getAccreditationBody(collegeId: string, id: string) {
  const doc = await AccreditationBody.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Accreditation body not found');
  return doc;
}

export async function createAccreditationBody(collegeId: string, data: any, who: string) {
  const doc = await AccreditationBody.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AccreditationBody', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAccreditationBody(collegeId: string, id: string, data: any, who: string) {
  const doc = await AccreditationBody.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Accreditation body not found');
  await createAuditLog({ collegeId, entityType: 'AccreditationBody', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAccreditationBody(collegeId: string, id: string, who: string) {
  const doc = await AccreditationBody.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Accreditation body not found');
  await createAuditLog({ collegeId, entityType: 'AccreditationBody', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Accreditation Cycle ════════════════════════════════════

export async function listAccreditationCycles(collegeId: string, page = 1, limit = 20, bodyId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (bodyId) filter.bodyId = bodyId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AccreditationCycle, filter, page, limit, { createdAt: -1 }, [BODY_POPULATE]);
}

export async function getAccreditationCycle(collegeId: string, id: string) {
  const doc = await AccreditationCycle.findOne({ _id: id, collegeId }).populate(BODY_POPULATE);
  if (!doc) throw new AppError(404, 'Accreditation cycle not found');
  return doc;
}

export async function createAccreditationCycle(collegeId: string, data: any, who: string) {
  const doc = await AccreditationCycle.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AccreditationCycle', entityId: String(doc._id), entityName: `Cycle ${data.cycle}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAccreditationCycle(collegeId: string, id: string, data: any, who: string) {
  const doc = await AccreditationCycle.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Accreditation cycle not found');
  await createAuditLog({ collegeId, entityType: 'AccreditationCycle', entityId: id, entityName: `Cycle ${doc.cycle}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAccreditationCycle(collegeId: string, id: string, who: string) {
  const doc = await AccreditationCycle.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Accreditation cycle not found');
  await createAuditLog({ collegeId, entityType: 'AccreditationCycle', entityId: id, entityName: `Cycle ${doc.cycle}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Compliance Criteria ════════════════════════════════════

export async function listComplianceCriteria(collegeId: string, page = 1, limit = 20, accreditationCycleId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (accreditationCycleId) filter.accreditationCycleId = accreditationCycleId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ComplianceCriteria, filter, page, limit, { criterionNumber: 1 }, CYCLE_POPULATE);
}

export async function getComplianceCriteria(collegeId: string, id: string) {
  const doc = await ComplianceCriteria.findOne({ _id: id, collegeId }).populate(CYCLE_POPULATE);
  if (!doc) throw new AppError(404, 'Compliance criteria not found');
  return doc;
}

export async function createComplianceCriteria(collegeId: string, data: any, who: string) {
  const doc = await ComplianceCriteria.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ComplianceCriteria', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateComplianceCriteria(collegeId: string, id: string, data: any, who: string) {
  const doc = await ComplianceCriteria.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Compliance criteria not found');
  await createAuditLog({ collegeId, entityType: 'ComplianceCriteria', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteComplianceCriteria(collegeId: string, id: string, who: string) {
  const doc = await ComplianceCriteria.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Compliance criteria not found');
  await createAuditLog({ collegeId, entityType: 'ComplianceCriteria', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Regulatory Filing ══════════════════════════════════════

export async function listRegulatoryFilings(collegeId: string, page = 1, limit = 20, body?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (body) filter.body = body;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(RegulatoryFiling, filter, page, limit, { dueDate: -1 });
}

export async function getRegulatoryFiling(collegeId: string, id: string) {
  const doc = await RegulatoryFiling.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Regulatory filing not found');
  return doc;
}

export async function createRegulatoryFiling(collegeId: string, data: any, who: string) {
  const doc = await RegulatoryFiling.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'RegulatoryFiling', entityId: String(doc._id), entityName: data.filingType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateRegulatoryFiling(collegeId: string, id: string, data: any, who: string) {
  const doc = await RegulatoryFiling.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Regulatory filing not found');
  await createAuditLog({ collegeId, entityType: 'RegulatoryFiling', entityId: id, entityName: doc.filingType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteRegulatoryFiling(collegeId: string, id: string, who: string) {
  const doc = await RegulatoryFiling.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Regulatory filing not found');
  await createAuditLog({ collegeId, entityType: 'RegulatoryFiling', entityId: id, entityName: doc.filingType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ AICTE Approval ═════════════════════════════════════════

export async function listAICTEApprovals(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AICTEApproval, filter, page, limit, { createdAt: -1 }, AICTE_POPULATE);
}

export async function getAICTEApproval(collegeId: string, id: string) {
  const doc = await AICTEApproval.findOne({ _id: id, collegeId }).populate(AICTE_POPULATE);
  if (!doc) throw new AppError(404, 'AICTE approval not found');
  return doc;
}

export async function createAICTEApproval(collegeId: string, data: any, who: string) {
  const doc = await AICTEApproval.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AICTEApproval', entityId: String(doc._id), entityName: data.applicationId || 'AICTE', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAICTEApproval(collegeId: string, id: string, data: any, who: string) {
  const doc = await AICTEApproval.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'AICTE approval not found');
  await createAuditLog({ collegeId, entityType: 'AICTEApproval', entityId: id, entityName: doc.applicationId || 'AICTE', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAICTEApproval(collegeId: string, id: string, who: string) {
  const doc = await AICTEApproval.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'AICTE approval not found');
  await createAuditLog({ collegeId, entityType: 'AICTEApproval', entityId: id, entityName: doc.applicationId || 'AICTE', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Affiliation Status ═════════════════════════════════════

export async function listAffiliationStatuses(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AffiliationStatus, filter, page, limit, { validTo: -1 }, [PROGRAMME_POPULATE]);
}

export async function getAffiliationStatus(collegeId: string, id: string) {
  const doc = await AffiliationStatus.findOne({ _id: id, collegeId }).populate(PROGRAMME_POPULATE);
  if (!doc) throw new AppError(404, 'Affiliation status not found');
  return doc;
}

export async function createAffiliationStatus(collegeId: string, data: any, who: string) {
  const doc = await AffiliationStatus.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AffiliationStatus', entityId: String(doc._id), entityName: data.universityName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAffiliationStatus(collegeId: string, id: string, data: any, who: string) {
  const doc = await AffiliationStatus.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Affiliation status not found');
  await createAuditLog({ collegeId, entityType: 'AffiliationStatus', entityId: id, entityName: doc.universityName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAffiliationStatus(collegeId: string, id: string, who: string) {
  const doc = await AffiliationStatus.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Affiliation status not found');
  await createAuditLog({ collegeId, entityType: 'AffiliationStatus', entityId: id, entityName: doc.universityName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Audit Finding ══════════════════════════════════════════

export async function listAuditFindings(collegeId: string, page = 1, limit = 20, auditType?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (auditType) filter.auditType = auditType;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AuditFinding, filter, page, limit, { auditDate: -1 });
}

export async function getAuditFinding(collegeId: string, id: string) {
  const doc = await AuditFinding.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Audit finding not found');
  return doc;
}

export async function createAuditFinding(collegeId: string, data: any, who: string) {
  const doc = await AuditFinding.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AuditFinding', entityId: String(doc._id), entityName: data.finding.slice(0, 50), action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAuditFinding(collegeId: string, id: string, data: any, who: string) {
  const doc = await AuditFinding.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Audit finding not found');
  await createAuditLog({ collegeId, entityType: 'AuditFinding', entityId: id, entityName: doc.finding.slice(0, 50), action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAuditFinding(collegeId: string, id: string, who: string) {
  const doc = await AuditFinding.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Audit finding not found');
  await createAuditLog({ collegeId, entityType: 'AuditFinding', entityId: id, entityName: doc.finding.slice(0, 50), action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ IQAC Report ════════════════════════════════════════════

export async function listIQACReports(collegeId: string, page = 1, limit = 20, reportType?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (reportType) filter.reportType = reportType;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(IQACReport, filter, page, limit, { createdAt: -1 }, [YEAR_POPULATE]);
}

export async function getIQACReport(collegeId: string, id: string) {
  const doc = await IQACReport.findOne({ _id: id, collegeId }).populate(YEAR_POPULATE);
  if (!doc) throw new AppError(404, 'IQAC report not found');
  return doc;
}

export async function createIQACReport(collegeId: string, data: any, who: string) {
  const doc = await IQACReport.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'IQACReport', entityId: String(doc._id), entityName: data.reportType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateIQACReport(collegeId: string, id: string, data: any, who: string) {
  const doc = await IQACReport.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'IQAC report not found');
  await createAuditLog({ collegeId, entityType: 'IQACReport', entityId: id, entityName: doc.reportType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteIQACReport(collegeId: string, id: string, who: string) {
  const doc = await IQACReport.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'IQAC report not found');
  await createAuditLog({ collegeId, entityType: 'IQACReport', entityId: id, entityName: doc.reportType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ RTI Request ════════════════════════════════════════════

export async function listRTIRequests(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(RTIRequest, filter, page, limit, { applicationDate: -1 }, [PERSON_POPULATE]);
}

export async function getRTIRequest(collegeId: string, id: string) {
  const doc = await RTIRequest.findOne({ _id: id, collegeId }).populate(PERSON_POPULATE);
  if (!doc) throw new AppError(404, 'RTI request not found');
  return doc;
}

export async function createRTIRequest(collegeId: string, data: any, who: string) {
  const doc = await RTIRequest.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'RTIRequest', entityId: String(doc._id), entityName: data.subject, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateRTIRequest(collegeId: string, id: string, data: any, who: string) {
  const doc = await RTIRequest.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'RTI request not found');
  await createAuditLog({ collegeId, entityType: 'RTIRequest', entityId: id, entityName: doc.subject, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteRTIRequest(collegeId: string, id: string, who: string) {
  const doc = await RTIRequest.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'RTI request not found');
  await createAuditLog({ collegeId, entityType: 'RTIRequest', entityId: id, entityName: doc.subject, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Legal Case ═════════════════════════════════════════════

export async function listLegalCases(collegeId: string, page = 1, limit = 20, caseType?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (caseType) filter.caseType = caseType;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(LegalCase, filter, page, limit, { filedDate: -1 });
}

export async function getLegalCase(collegeId: string, id: string) {
  const doc = await LegalCase.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Legal case not found');
  return doc;
}

export async function createLegalCase(collegeId: string, data: any, who: string) {
  const doc = await LegalCase.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LegalCase', entityId: String(doc._id), entityName: data.caseNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateLegalCase(collegeId: string, id: string, data: any, who: string) {
  const doc = await LegalCase.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Legal case not found');
  await createAuditLog({ collegeId, entityType: 'LegalCase', entityId: id, entityName: doc.caseNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteLegalCase(collegeId: string, id: string, who: string) {
  const doc = await LegalCase.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Legal case not found');
  await createAuditLog({ collegeId, entityType: 'LegalCase', entityId: id, entityName: doc.caseNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}
