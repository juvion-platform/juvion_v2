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

export default router;
