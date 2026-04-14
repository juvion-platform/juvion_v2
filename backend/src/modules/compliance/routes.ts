import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createAccreditationBodySchema, updateAccreditationBodySchema,
  createAccreditationCycleSchema, updateAccreditationCycleSchema,
  createComplianceCriteriaSchema, updateComplianceCriteriaSchema,
  createRegulatoryFilingSchema, updateRegulatoryFilingSchema,
  createAICTEApprovalSchema, updateAICTEApprovalSchema,
  createAffiliationStatusSchema, updateAffiliationStatusSchema,
  createAuditFindingSchema, updateAuditFindingSchema,
  createIQACReportSchema, updateIQACReportSchema,
  createRTIRequestSchema, updateRTIRequestSchema,
  createLegalCaseSchema, updateLegalCaseSchema,
  // W07 Workflow Schemas
  createEvidenceTypeSchema, updateEvidenceTypeSchema,
  createCollectionRuleSchema, updateCollectionRuleSchema,
  uploadEvidenceSchema, overrideQualitySchema,
  createCriterionMappingSchema, updateCriterionMappingSchema,
  createRubricSchema, updateRubricSchema,
  interpretCriterionSchema, loadFrameworkSchema,
  computeReadinessSchema, createSnapshotSchema,
  detectGapsSchema, assignGapSchema, updateGapPrioritySchema,
  createRemediationPlanSchema, updateRemediationPlanSchema,
  updateRemediationTaskSchema, verifyRemediationTaskSchema, closeRemediationPlanSchema,
  createReportTemplateSchema,
  initiateReportSchema, updateSectionSchema, reviewSectionSchema,
  approveSectionSchema, requestRevisionSchema, approveReportSchema, submitReportSchema,
  createDeadlineSchema, updateDeadlineSchema, acknowledgeDeadlineSchema,
  recordVisitOutcomeSchema, transitionCycleSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('compliance', 'read'), ctrl.dashboardStats);

// Accreditation Bodies
router.get('/accreditation-bodies', authorize('compliance', 'read'), ctrl.listAccreditationBodies);
router.get('/accreditation-bodies/:id', authorize('compliance', 'read'), ctrl.getAccreditationBody);
router.post('/accreditation-bodies', authorize('compliance', 'create'), validate(createAccreditationBodySchema), ctrl.createAccreditationBody);
router.put('/accreditation-bodies/:id', authorize('compliance', 'update'), validate(updateAccreditationBodySchema), ctrl.updateAccreditationBody);
router.delete('/accreditation-bodies/:id', authorize('compliance', 'delete'), ctrl.deleteAccreditationBody);

// Accreditation Cycles
router.get('/accreditation-cycles', authorize('compliance', 'read'), ctrl.listAccreditationCycles);
router.get('/accreditation-cycles/:id', authorize('compliance', 'read'), ctrl.getAccreditationCycle);
router.post('/accreditation-cycles', authorize('compliance', 'create'), validate(createAccreditationCycleSchema), ctrl.createAccreditationCycle);
router.put('/accreditation-cycles/:id', authorize('compliance', 'update'), validate(updateAccreditationCycleSchema), ctrl.updateAccreditationCycle);
router.delete('/accreditation-cycles/:id', authorize('compliance', 'delete'), ctrl.deleteAccreditationCycle);

// Compliance Criteria
router.get('/compliance-criteria', authorize('compliance', 'read'), ctrl.listComplianceCriteria);
router.get('/compliance-criteria/:id', authorize('compliance', 'read'), ctrl.getComplianceCriteria);
router.post('/compliance-criteria', authorize('compliance', 'create'), validate(createComplianceCriteriaSchema), ctrl.createComplianceCriteria);
router.put('/compliance-criteria/:id', authorize('compliance', 'update'), validate(updateComplianceCriteriaSchema), ctrl.updateComplianceCriteria);
router.delete('/compliance-criteria/:id', authorize('compliance', 'delete'), ctrl.deleteComplianceCriteria);

// Regulatory Filings
router.get('/regulatory-filings', authorize('compliance', 'read'), ctrl.listRegulatoryFilings);
router.get('/regulatory-filings/:id', authorize('compliance', 'read'), ctrl.getRegulatoryFiling);
router.post('/regulatory-filings', authorize('compliance', 'create'), validate(createRegulatoryFilingSchema), ctrl.createRegulatoryFiling);
router.put('/regulatory-filings/:id', authorize('compliance', 'update'), validate(updateRegulatoryFilingSchema), ctrl.updateRegulatoryFiling);
router.delete('/regulatory-filings/:id', authorize('compliance', 'delete'), ctrl.deleteRegulatoryFiling);

// AICTE Approvals
router.get('/aicte-approvals', authorize('compliance', 'read'), ctrl.listAICTEApprovals);
router.get('/aicte-approvals/:id', authorize('compliance', 'read'), ctrl.getAICTEApproval);
router.post('/aicte-approvals', authorize('compliance', 'create'), validate(createAICTEApprovalSchema), ctrl.createAICTEApproval);
router.put('/aicte-approvals/:id', authorize('compliance', 'update'), validate(updateAICTEApprovalSchema), ctrl.updateAICTEApproval);
router.delete('/aicte-approvals/:id', authorize('compliance', 'delete'), ctrl.deleteAICTEApproval);

// Affiliation Statuses
router.get('/affiliation-statuses', authorize('compliance', 'read'), ctrl.listAffiliationStatuses);
router.get('/affiliation-statuses/:id', authorize('compliance', 'read'), ctrl.getAffiliationStatus);
router.post('/affiliation-statuses', authorize('compliance', 'create'), validate(createAffiliationStatusSchema), ctrl.createAffiliationStatus);
router.put('/affiliation-statuses/:id', authorize('compliance', 'update'), validate(updateAffiliationStatusSchema), ctrl.updateAffiliationStatus);
router.delete('/affiliation-statuses/:id', authorize('compliance', 'delete'), ctrl.deleteAffiliationStatus);

// Audit Findings
router.get('/audit-findings', authorize('compliance', 'read'), ctrl.listAuditFindings);
router.get('/audit-findings/:id', authorize('compliance', 'read'), ctrl.getAuditFinding);
router.post('/audit-findings', authorize('compliance', 'create'), validate(createAuditFindingSchema), ctrl.createAuditFinding);
router.put('/audit-findings/:id', authorize('compliance', 'update'), validate(updateAuditFindingSchema), ctrl.updateAuditFinding);
router.delete('/audit-findings/:id', authorize('compliance', 'delete'), ctrl.deleteAuditFinding);

// IQAC Reports
router.get('/iqac-reports', authorize('compliance', 'read'), ctrl.listIQACReports);
router.get('/iqac-reports/:id', authorize('compliance', 'read'), ctrl.getIQACReport);
router.post('/iqac-reports', authorize('compliance', 'create'), validate(createIQACReportSchema), ctrl.createIQACReport);
router.put('/iqac-reports/:id', authorize('compliance', 'update'), validate(updateIQACReportSchema), ctrl.updateIQACReport);
router.delete('/iqac-reports/:id', authorize('compliance', 'delete'), ctrl.deleteIQACReport);

// RTI Requests
router.get('/rti-requests', authorize('compliance', 'read'), ctrl.listRTIRequests);
router.get('/rti-requests/:id', authorize('compliance', 'read'), ctrl.getRTIRequest);
router.post('/rti-requests', authorize('compliance', 'create'), validate(createRTIRequestSchema), ctrl.createRTIRequest);
router.put('/rti-requests/:id', authorize('compliance', 'update'), validate(updateRTIRequestSchema), ctrl.updateRTIRequest);
router.delete('/rti-requests/:id', authorize('compliance', 'delete'), ctrl.deleteRTIRequest);

// Legal Cases
router.get('/legal-cases', authorize('compliance', 'read'), ctrl.listLegalCases);
router.get('/legal-cases/:id', authorize('compliance', 'read'), ctrl.getLegalCase);
router.post('/legal-cases', authorize('compliance', 'create'), validate(createLegalCaseSchema), ctrl.createLegalCase);
router.put('/legal-cases/:id', authorize('compliance', 'update'), validate(updateLegalCaseSchema), ctrl.updateLegalCase);
router.delete('/legal-cases/:id', authorize('compliance', 'delete'), ctrl.deleteLegalCase);

// ═══ W07 Workflow Routes ═══════════════════════════════════

// ── Evidence Types ─────────────────────────────────────────
router.get('/evidence-types', authorize('compliance', 'read'), ctrl.listEvidenceTypesCtrl);
router.get('/evidence-types/:id', authorize('compliance', 'read'), ctrl.getEvidenceTypeCtrl);
router.post('/evidence-types', authorize('compliance', 'create'), validate(createEvidenceTypeSchema), ctrl.createEvidenceTypeCtrl);
router.put('/evidence-types/:id', authorize('compliance', 'update'), validate(updateEvidenceTypeSchema), ctrl.updateEvidenceTypeCtrl);
router.delete('/evidence-types/:id', authorize('compliance', 'delete'), ctrl.deleteEvidenceTypeCtrl);

// ── Collection Rules ───────────────────────────────────────
router.get('/evidence-collection-rules', authorize('compliance', 'read'), ctrl.listCollectionRulesCtrl);
router.get('/evidence-collection-rules/:id', authorize('compliance', 'read'), ctrl.getCollectionRuleCtrl);
router.post('/evidence-collection-rules', authorize('compliance', 'create'), validate(createCollectionRuleSchema), ctrl.createCollectionRuleCtrl);
router.put('/evidence-collection-rules/:id', authorize('compliance', 'update'), validate(updateCollectionRuleSchema), ctrl.updateCollectionRuleCtrl);
router.delete('/evidence-collection-rules/:id', authorize('compliance', 'delete'), ctrl.deleteCollectionRuleCtrl);

// ── Evidence Records ───────────────────────────────────────
router.get('/evidence/stats', authorize('compliance', 'read'), ctrl.getEvidenceStatsCtrl);
router.get('/evidence-records', authorize('compliance', 'read'), ctrl.listEvidenceRecordsCtrl);
router.get('/evidence-records/:id', authorize('compliance', 'read'), ctrl.getEvidenceRecordCtrl);
router.post('/evidence-records/upload', authorize('compliance', 'create'), validate(uploadEvidenceSchema), ctrl.uploadEvidenceCtrl);
router.put('/evidence-records/:id/quality-override', authorize('compliance', 'update'), validate(overrideQualitySchema), ctrl.overrideEvidenceQualityCtrl);
router.post('/evidence-records/:id/verify', authorize('compliance', 'update'), ctrl.verifyEvidenceCtrl);
router.post('/evidence/sync/:sourceModule', authorize('compliance', 'update'), ctrl.syncModuleEvidenceCtrl);

// ── Criterion Mappings ─────────────────────────────────────
router.get('/criterion-evidence-mappings', authorize('compliance', 'read'), ctrl.listCriterionMappingsCtrl);
router.post('/criterion-evidence-mappings/suggest/:criterionId', authorize('compliance', 'read'), ctrl.suggestMappingsCtrl);
router.get('/criterion-evidence-mappings/:id', authorize('compliance', 'read'), ctrl.getCriterionMappingCtrl);
router.post('/criterion-evidence-mappings', authorize('compliance', 'create'), validate(createCriterionMappingSchema), ctrl.createCriterionMappingCtrl);
router.put('/criterion-evidence-mappings/:id', authorize('compliance', 'update'), validate(updateCriterionMappingSchema), ctrl.updateCriterionMappingCtrl);
router.delete('/criterion-evidence-mappings/:id', authorize('compliance', 'delete'), ctrl.deleteCriterionMappingCtrl);

// ── Assessment Rubrics ─────────────────────────────────────
router.get('/assessment-rubrics', authorize('compliance', 'read'), ctrl.listRubricsCtrl);
router.get('/assessment-rubrics/:id', authorize('compliance', 'read'), ctrl.getRubricCtrl);
router.post('/assessment-rubrics', authorize('compliance', 'create'), validate(createRubricSchema), ctrl.createRubricCtrl);
router.put('/assessment-rubrics/:id', authorize('compliance', 'update'), validate(updateRubricSchema), ctrl.updateRubricCtrl);
router.delete('/assessment-rubrics/:id', authorize('compliance', 'delete'), ctrl.deleteRubricCtrl);

// ── Criteria Enhancement ───────────────────────────────────
router.put('/compliance-criteria/:id/interpret', authorize('compliance', 'update'), validate(interpretCriterionSchema), ctrl.interpretCriterionCtrl);
router.post('/frameworks/load', authorize('compliance', 'create'), validate(loadFrameworkSchema), ctrl.loadFrameworkCtrl);

// ── Readiness ──────────────────────────────────────────────
router.get('/readiness/scores', authorize('compliance', 'read'), ctrl.listReadinessScoresCtrl);
router.post('/readiness/compute', authorize('compliance', 'create'), validate(computeReadinessSchema), ctrl.computeReadinessCtrl);
router.get('/readiness/snapshots', authorize('compliance', 'read'), ctrl.listSnapshotsCtrl);
router.post('/readiness/snapshots', authorize('compliance', 'create'), validate(createSnapshotSchema), ctrl.createSnapshotCtrl);
router.get('/readiness/dashboard/:bodyId', authorize('compliance', 'read'), ctrl.getReadinessDashboardCtrl);
router.get('/readiness/predict/:bodyId', authorize('compliance', 'read'), ctrl.predictGradeCtrl);

// ── Gaps ───────────────────────────────────────────────────
router.get('/gaps/stats', authorize('compliance', 'read'), ctrl.getGapStatsCtrl);
router.get('/gaps', authorize('compliance', 'read'), ctrl.listGapsCtrl);
router.get('/gaps/:id', authorize('compliance', 'read'), ctrl.getGapCtrl);
router.post('/gaps/prioritize', authorize('compliance', 'create'), validate(detectGapsSchema), ctrl.detectGapsCtrl);
router.put('/gaps/:id/assign', authorize('compliance', 'update'), validate(assignGapSchema), ctrl.assignGapCtrl);
router.put('/gaps/:id/priority', authorize('compliance', 'update'), validate(updateGapPrioritySchema), ctrl.updateGapPriorityCtrl);
router.post('/gaps/:id/resolve', authorize('compliance', 'update'), ctrl.resolveGapCtrl);

// ── Remediation ────────────────────────────────────────────
router.get('/remediation-plans', authorize('compliance', 'read'), ctrl.listRemediationPlansCtrl);
router.get('/remediation-plans/:id', authorize('compliance', 'read'), ctrl.getRemediationPlanCtrl);
router.post('/remediation-plans', authorize('compliance', 'create'), validate(createRemediationPlanSchema), ctrl.createRemediationPlanCtrl);
router.put('/remediation-plans/:id', authorize('compliance', 'update'), validate(updateRemediationPlanSchema), ctrl.updateRemediationPlanCtrl);
router.put('/remediation-plans/:id/tasks/:taskIdx', authorize('compliance', 'update'), validate(updateRemediationTaskSchema), ctrl.updateRemediationTaskCtrl);
router.post('/remediation-plans/:id/tasks/:taskIdx/verify', authorize('compliance', 'update'), validate(verifyRemediationTaskSchema), ctrl.verifyRemediationTaskCtrl);
router.post('/remediation-plans/:id/close', authorize('compliance', 'update'), validate(closeRemediationPlanSchema), ctrl.closeRemediationPlanCtrl);
router.get('/remediation-plans/:id/progress', authorize('compliance', 'read'), ctrl.getRemediationProgressCtrl);

// ── Report Templates ───────────────────────────────────────
router.get('/report-templates', authorize('compliance', 'read'), ctrl.listReportTemplatesCtrl);
router.get('/report-templates/:id', authorize('compliance', 'read'), ctrl.getReportTemplateCtrl);
router.post('/report-templates', authorize('compliance', 'create'), validate(createReportTemplateSchema), ctrl.createReportTemplateCtrl);

// ── Reports ────────────────────────────────────────────────
router.get('/reports', authorize('compliance', 'read'), ctrl.listReportsCtrl);
router.post('/reports/initiate', authorize('compliance', 'create'), validate(initiateReportSchema), ctrl.initiateReportCtrl);
router.get('/reports/:id', authorize('compliance', 'read'), ctrl.getReportCtrl);
router.post('/reports/:id/sections/:sectionId/generate', authorize('compliance', 'update'), ctrl.generateSectionCtrl);
router.put('/reports/:id/sections/:sectionId', authorize('compliance', 'update'), validate(updateSectionSchema), ctrl.updateSectionCtrl);
router.post('/reports/:id/sections/:sectionId/review', authorize('compliance', 'update'), validate(reviewSectionSchema), ctrl.reviewSectionCtrl);
router.post('/reports/:id/sections/:sectionId/approve', authorize('compliance', 'update'), validate(approveSectionSchema), ctrl.approveSectionCtrl);
router.post('/reports/:id/sections/:sectionId/revision', authorize('compliance', 'update'), validate(requestRevisionSchema), ctrl.requestSectionRevisionCtrl);
router.post('/reports/:id/assemble', authorize('compliance', 'update'), ctrl.assembleReportCtrl);
router.post('/reports/:id/approve', authorize('compliance', 'update'), validate(approveReportSchema), ctrl.approveReportCtrl);
router.post('/reports/:id/submit', authorize('compliance', 'update'), validate(submitReportSchema), ctrl.submitReportCtrl);

// ── Submission Artifacts ───────────────────────────────────
router.get('/submission-artifacts', authorize('compliance', 'read'), ctrl.listSubmissionArtifactsCtrl);

// ── Deadlines + Visit ──────────────────────────────────────
router.get('/deadlines', authorize('compliance', 'read'), ctrl.listDeadlinesCtrl);
router.post('/deadlines', authorize('compliance', 'create'), validate(createDeadlineSchema), ctrl.createDeadlineCtrl);
router.put('/deadlines/:id', authorize('compliance', 'update'), validate(updateDeadlineSchema), ctrl.updateDeadlineCtrl);
router.post('/deadlines/:id/acknowledge', authorize('compliance', 'update'), validate(acknowledgeDeadlineSchema), ctrl.acknowledgeDeadlineCtrl);
router.post('/accreditation-cycles/:id/visit-outcome', authorize('compliance', 'update'), validate(recordVisitOutcomeSchema), ctrl.recordVisitOutcomeCtrl);
router.put('/accreditation-cycles/:id/status', authorize('compliance', 'update'), validate(transitionCycleSchema), ctrl.transitionCycleCtrl);

export default router;
