import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Accreditation Body ═════════════════════════════════════

export async function listAccreditationBodies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query as any;
    res.json(await service.listAccreditationBodies(req.collegeId!, Number(page) || 1, Number(limit) || 20));
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
    res.json(await service.listAccreditationCycles(req.collegeId!, Number(page) || 1, Number(limit) || 20, bodyId, status));
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
    res.json(await service.listComplianceCriteria(req.collegeId!, Number(page) || 1, Number(limit) || 20, accreditationCycleId, status));
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
    res.json(await service.listRegulatoryFilings(req.collegeId!, Number(page) || 1, Number(limit) || 20, body, status));
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
    res.json(await service.listAICTEApprovals(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
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
    res.json(await service.listAffiliationStatuses(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
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
    res.json(await service.listAuditFindings(req.collegeId!, Number(page) || 1, Number(limit) || 20, auditType, status));
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
    res.json(await service.listIQACReports(req.collegeId!, Number(page) || 1, Number(limit) || 20, reportType, status));
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
    res.json(await service.listRTIRequests(req.collegeId!, Number(page) || 1, Number(limit) || 20, status));
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
    res.json(await service.listLegalCases(req.collegeId!, Number(page) || 1, Number(limit) || 20, caseType, status));
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
