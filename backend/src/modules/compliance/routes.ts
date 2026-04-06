import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Accreditation Bodies
router.get('/accreditation-bodies', ctrl.listAccreditationBodies);
router.get('/accreditation-bodies/:id', ctrl.getAccreditationBody);
router.post('/accreditation-bodies', validate(createAccreditationBodySchema), ctrl.createAccreditationBody);
router.put('/accreditation-bodies/:id', validate(updateAccreditationBodySchema), ctrl.updateAccreditationBody);
router.delete('/accreditation-bodies/:id', ctrl.deleteAccreditationBody);

// Accreditation Cycles
router.get('/accreditation-cycles', ctrl.listAccreditationCycles);
router.get('/accreditation-cycles/:id', ctrl.getAccreditationCycle);
router.post('/accreditation-cycles', validate(createAccreditationCycleSchema), ctrl.createAccreditationCycle);
router.put('/accreditation-cycles/:id', validate(updateAccreditationCycleSchema), ctrl.updateAccreditationCycle);
router.delete('/accreditation-cycles/:id', ctrl.deleteAccreditationCycle);

// Compliance Criteria
router.get('/compliance-criteria', ctrl.listComplianceCriteria);
router.get('/compliance-criteria/:id', ctrl.getComplianceCriteria);
router.post('/compliance-criteria', validate(createComplianceCriteriaSchema), ctrl.createComplianceCriteria);
router.put('/compliance-criteria/:id', validate(updateComplianceCriteriaSchema), ctrl.updateComplianceCriteria);
router.delete('/compliance-criteria/:id', ctrl.deleteComplianceCriteria);

// Regulatory Filings
router.get('/regulatory-filings', ctrl.listRegulatoryFilings);
router.get('/regulatory-filings/:id', ctrl.getRegulatoryFiling);
router.post('/regulatory-filings', validate(createRegulatoryFilingSchema), ctrl.createRegulatoryFiling);
router.put('/regulatory-filings/:id', validate(updateRegulatoryFilingSchema), ctrl.updateRegulatoryFiling);
router.delete('/regulatory-filings/:id', ctrl.deleteRegulatoryFiling);

// AICTE Approvals
router.get('/aicte-approvals', ctrl.listAICTEApprovals);
router.get('/aicte-approvals/:id', ctrl.getAICTEApproval);
router.post('/aicte-approvals', validate(createAICTEApprovalSchema), ctrl.createAICTEApproval);
router.put('/aicte-approvals/:id', validate(updateAICTEApprovalSchema), ctrl.updateAICTEApproval);
router.delete('/aicte-approvals/:id', ctrl.deleteAICTEApproval);

// Affiliation Statuses
router.get('/affiliation-statuses', ctrl.listAffiliationStatuses);
router.get('/affiliation-statuses/:id', ctrl.getAffiliationStatus);
router.post('/affiliation-statuses', validate(createAffiliationStatusSchema), ctrl.createAffiliationStatus);
router.put('/affiliation-statuses/:id', validate(updateAffiliationStatusSchema), ctrl.updateAffiliationStatus);
router.delete('/affiliation-statuses/:id', ctrl.deleteAffiliationStatus);

// Audit Findings
router.get('/audit-findings', ctrl.listAuditFindings);
router.get('/audit-findings/:id', ctrl.getAuditFinding);
router.post('/audit-findings', validate(createAuditFindingSchema), ctrl.createAuditFinding);
router.put('/audit-findings/:id', validate(updateAuditFindingSchema), ctrl.updateAuditFinding);
router.delete('/audit-findings/:id', ctrl.deleteAuditFinding);

// IQAC Reports
router.get('/iqac-reports', ctrl.listIQACReports);
router.get('/iqac-reports/:id', ctrl.getIQACReport);
router.post('/iqac-reports', validate(createIQACReportSchema), ctrl.createIQACReport);
router.put('/iqac-reports/:id', validate(updateIQACReportSchema), ctrl.updateIQACReport);
router.delete('/iqac-reports/:id', ctrl.deleteIQACReport);

// RTI Requests
router.get('/rti-requests', ctrl.listRTIRequests);
router.get('/rti-requests/:id', ctrl.getRTIRequest);
router.post('/rti-requests', validate(createRTIRequestSchema), ctrl.createRTIRequest);
router.put('/rti-requests/:id', validate(updateRTIRequestSchema), ctrl.updateRTIRequest);
router.delete('/rti-requests/:id', ctrl.deleteRTIRequest);

// Legal Cases
router.get('/legal-cases', ctrl.listLegalCases);
router.get('/legal-cases/:id', ctrl.getLegalCase);
router.post('/legal-cases', validate(createLegalCaseSchema), ctrl.createLegalCase);
router.put('/legal-cases/:id', validate(updateLegalCaseSchema), ctrl.updateLegalCase);
router.delete('/legal-cases/:id', ctrl.deleteLegalCase);

export default router;
