import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as evidCritService from './evid-crit-service';
import * as readyRemedService from './ready-remed-service';
import * as reportService from './report-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Accreditation Body ═════════════════════════════════════

export async function listAccreditationBodies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await service.listAccreditationBodies(req.collegeId!, Number(page) || 1, Number(limit) || 20, req.authScope));
  } catch (err) { next(err); }
}
export async function getAccreditationBody(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAccreditationBody(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAccreditationBody(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAccreditationBody(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAccreditationBody(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAccreditationBody(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAccreditationBody(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAccreditationBody(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Accreditation Cycle ════════════════════════════════════

export async function listAccreditationCycles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, status } = req.query as any;
    res.json(await service.listAccreditationCycles(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getAccreditationCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAccreditationCycle(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAccreditationCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAccreditationCycle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAccreditationCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAccreditationCycle(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAccreditationCycle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAccreditationCycle(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Compliance Criteria ════════════════════════════════════

export async function listComplianceCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, accreditationCycleId, status } = req.query as any;
    res.json(await service.listComplianceCriteria(req.collegeId!, Number(page) || 1, Number(limit) || 20, accreditationCycleId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getComplianceCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getComplianceCriteria(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createComplianceCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createComplianceCriteria(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateComplianceCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateComplianceCriteria(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteComplianceCriteria(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteComplianceCriteria(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Regulatory Filing ══════════════════════════════════════

export async function listRegulatoryFilings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, body, status } = req.query as any;
    res.json(await service.listRegulatoryFilings(req.collegeId!, Number(page) || 1, Number(limit) || 20, body, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getRegulatoryFiling(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRegulatoryFiling(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRegulatoryFiling(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRegulatoryFiling(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRegulatoryFiling(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRegulatoryFiling(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRegulatoryFiling(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRegulatoryFiling(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ AICTE Approval ═════════════════════════════════════════

export async function listAICTEApprovals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listAICTEApprovals(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getAICTEApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAICTEApproval(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAICTEApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAICTEApproval(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAICTEApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAICTEApproval(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAICTEApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAICTEApproval(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Affiliation Status ═════════════════════════════════════

export async function listAffiliationStatuses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listAffiliationStatuses(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getAffiliationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAffiliationStatus(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAffiliationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAffiliationStatus(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAffiliationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAffiliationStatus(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAffiliationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAffiliationStatus(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Audit Finding ══════════════════════════════════════════

export async function listAuditFindings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, auditType, status } = req.query as any;
    res.json(await service.listAuditFindings(req.collegeId!, Number(page) || 1, Number(limit) || 20, auditType, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getAuditFinding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAuditFinding(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAuditFinding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAuditFinding(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAuditFinding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAuditFinding(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAuditFinding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAuditFinding(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ IQAC Report ════════════════════════════════════════════

export async function listIQACReports(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, reportType, status } = req.query as any;
    res.json(await service.listIQACReports(req.collegeId!, Number(page) || 1, Number(limit) || 20, reportType, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getIQACReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getIQACReport(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createIQACReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createIQACReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateIQACReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateIQACReport(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteIQACReport(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteIQACReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ RTI Request ════════════════════════════════════════════

export async function listRTIRequests(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = req.query as any;
    res.json(await service.listRTIRequests(req.collegeId!, Number(page) || 1, Number(limit) || 20, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getRTIRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRTIRequest(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRTIRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRTIRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRTIRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRTIRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRTIRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRTIRequest(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Legal Case ═════════════════════════════════════════════

export async function listLegalCases(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, caseType, status } = req.query as any;
    res.json(await service.listLegalCases(req.collegeId!, Number(page) || 1, Number(limit) || 20, caseType, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getLegalCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLegalCase(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLegalCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLegalCase(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLegalCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLegalCase(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLegalCase(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLegalCase(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ W07 Workflow Controllers ══════════════════════════════

// ─── Evidence Types ────────────────────────────────────────

export async function listEvidenceTypesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, sourceModule, category } = req.query as any;
    res.json(await evidCritService.listEvidenceTypes(req.collegeId!, Number(page) || 1, Number(limit) || 20, sourceModule, category));
  } catch (err) { next(err); }
}
export async function getEvidenceTypeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getEvidenceType(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEvidenceTypeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.createEvidenceType(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEvidenceTypeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.updateEvidenceType(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEvidenceTypeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.deleteEvidenceType(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Collection Rules ──────────────────────────────────────

export async function listCollectionRulesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, evidenceTypeId } = req.query as any;
    res.json(await evidCritService.listEvidenceCollectionRules(req.collegeId!, Number(page) || 1, Number(limit) || 20, evidenceTypeId));
  } catch (err) { next(err); }
}
export async function getCollectionRuleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getEvidenceCollectionRule(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCollectionRuleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.createEvidenceCollectionRule(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCollectionRuleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.updateEvidenceCollectionRule(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCollectionRuleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.deleteEvidenceCollectionRule(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Evidence Records ──────────────────────────────────────

export async function listEvidenceRecordsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, evidenceTypeId, status, academicYearId } = req.query as any;
    res.json(await evidCritService.listEvidenceRecords(req.collegeId!, Number(page) || 1, Number(limit) || 20, evidenceTypeId, status, academicYearId));
  } catch (err) { next(err); }
}
export async function getEvidenceRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getEvidenceRecord(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function uploadEvidenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.uploadEvidence(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function overrideEvidenceQualityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.overrideEvidenceQuality(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function verifyEvidenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.verifyEvidence(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function syncModuleEvidenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.syncModuleEvidence(req.collegeId!, req.params.sourceModule as string, who(req))); } catch (err) { next(err); }
}
export async function getEvidenceStatsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getEvidenceStats(req.collegeId!)); } catch (err) { next(err); }
}

// ─── Criterion Mappings ────────────────────────────────────

export async function listCriterionMappingsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, criterionId } = req.query as any;
    res.json(await evidCritService.listCriterionEvidenceMappings(req.collegeId!, Number(page) || 1, Number(limit) || 20, criterionId));
  } catch (err) { next(err); }
}
export async function getCriterionMappingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getCriterionEvidenceMapping(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCriterionMappingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.createCriterionEvidenceMapping(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCriterionMappingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.updateCriterionEvidenceMapping(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCriterionMappingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.deleteCriterionEvidenceMapping(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function suggestMappingsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.suggestEvidenceMappings(req.collegeId!, req.params.criterionId as string)); } catch (err) { next(err); }
}

// ─── Assessment Rubrics ────────────────────────────────────

export async function listRubricsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, criterionId } = req.query as any;
    res.json(await evidCritService.listAssessmentRubrics(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, criterionId));
  } catch (err) { next(err); }
}
export async function getRubricCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.getAssessmentRubric(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRubricCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.createAssessmentRubric(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRubricCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.updateAssessmentRubric(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRubricCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.deleteAssessmentRubric(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ─── Criteria Enhancement ──────────────────────────────────

export async function interpretCriterionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await evidCritService.interpretCriterion(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function loadFrameworkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await evidCritService.loadFramework(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Readiness ─────────────────────────────────────────────

export async function listReadinessScoresCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, status } = req.query as any;
    res.json(await readyRemedService.listReadinessScores(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, status));
  } catch (err) { next(err); }
}
export async function computeReadinessCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.computeReadiness(req.collegeId!, req.body.bodyId, req.body.programmeId, who(req))); } catch (err) { next(err); }
}
export async function listSnapshotsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId } = req.query as any;
    res.json(await readyRemedService.listReadinessSnapshots(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId));
  } catch (err) { next(err); }
}
export async function createSnapshotCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await readyRemedService.createReadinessSnapshot(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getReadinessDashboardCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.getReadinessDashboard(req.collegeId!, req.params.bodyId as string)); } catch (err) { next(err); }
}
export async function predictGradeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.predictGrade(req.collegeId!, req.params.bodyId as string)); } catch (err) { next(err); }
}

// ─── Gaps ──────────────────────────────────────────────────

export async function listGapsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, severity, status } = req.query as any;
    res.json(await readyRemedService.listGaps(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, severity, status));
  } catch (err) { next(err); }
}
export async function getGapCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.getGap(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function detectGapsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await readyRemedService.detectGaps(req.collegeId!, req.body.bodyId, who(req))); } catch (err) { next(err); }
}
export async function assignGapCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.assignGap(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateGapPriorityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.updateGapPriority(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveGapCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.resolveGap(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function getGapStatsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.getGapStats(req.collegeId!, req.query.bodyId as string)); } catch (err) { next(err); }
}

// ─── Remediation ───────────────────────────────────────────

export async function listRemediationPlansCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, status } = req.query as any;
    res.json(await readyRemedService.listRemediationPlans(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, status));
  } catch (err) { next(err); }
}
export async function getRemediationPlanCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.getRemediationPlan(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRemediationPlanCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await readyRemedService.createRemediationPlan(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRemediationPlanCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.updateRemediationPlan(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRemediationTaskCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.updateRemediationTask(req.collegeId!, req.params.id as string, Number(req.params.taskIdx), req.body, who(req))); } catch (err) { next(err); }
}
export async function verifyRemediationTaskCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.verifyRemediationTask(req.collegeId!, req.params.id as string, Number(req.params.taskIdx), req.body, who(req))); } catch (err) { next(err); }
}
export async function closeRemediationPlanCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.closeRemediationPlan(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getRemediationProgressCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await readyRemedService.getRemediationProgress(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ─── Report Templates ──────────────────────────────────────

export async function listReportTemplatesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, reportType } = req.query as any;
    res.json(await reportService.listReportTemplates(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, reportType));
  } catch (err) { next(err); }
}
export async function getReportTemplateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.getReportTemplate(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createReportTemplateCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await reportService.createReportTemplate(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Reports ───────────────────────────────────────────────

export async function listReportsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, bodyId, status } = req.query as any;
    res.json(await reportService.listReports(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, status));
  } catch (err) { next(err); }
}
export async function getReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.getReport(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function initiateReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await reportService.initiateReport(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function generateSectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.generateSection(req.collegeId!, req.params.id as string, req.params.sectionId as string, who(req))); } catch (err) { next(err); }
}
export async function updateSectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.updateSection(req.collegeId!, req.params.id as string, req.params.sectionId as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function reviewSectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.reviewSection(req.collegeId!, req.params.id as string, req.params.sectionId as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveSectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.approveSection(req.collegeId!, req.params.id as string, req.params.sectionId as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function requestSectionRevisionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.requestSectionRevision(req.collegeId!, req.params.id as string, req.params.sectionId as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.approveReport(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function assembleReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.assembleReport(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function submitReportCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.submitReport(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// ─── Submission Artifacts ──────────────────────────────────

export async function listSubmissionArtifactsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, reportId } = req.query as any;
    res.json(await reportService.listSubmissionArtifacts(req.collegeId!, Number(page) || 1, Number(limit) || 20, reportId));
  } catch (err) { next(err); }
}

// ─── Deadlines + Visit ─────────────────────────────────────

export async function listDeadlinesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await reportService.listDeadlines(req.collegeId!, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
}
export async function createDeadlineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await reportService.createDeadline(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateDeadlineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.updateDeadline(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function acknowledgeDeadlineCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.acknowledgeDeadline(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordVisitOutcomeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.recordVisitOutcome(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function transitionCycleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await reportService.transitionCycle(req.collegeId!, req.params.id as string, req.body.status, who(req))); } catch (err) { next(err); }
}
