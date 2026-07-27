import api from './api';

const BASE = '/compliance';

// ─── Stats ────────────────────────────────────────────────
export const getComplianceStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Accreditation Bodies ─────────────────────────────────
export const listAccreditationBodies = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/accreditation-bodies`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAccreditationBody = (id: string) =>
  api.get(`${BASE}/accreditation-bodies/${id}`).then(r => r.data);
export const createAccreditationBody = (data: any) =>
  api.post(`${BASE}/accreditation-bodies`, data).then(r => r.data);
export const updateAccreditationBody = (id: string, data: any) =>
  api.put(`${BASE}/accreditation-bodies/${id}`, data).then(r => r.data);
export const deleteAccreditationBody = (id: string) =>
  api.delete(`${BASE}/accreditation-bodies/${id}`).then(r => r.data);

// ─── Accreditation Cycles ─────────────────────────────────
export const listAccreditationCycles = (page = 1, limit = 20, bodyId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/accreditation-cycles`, { params: { page, limit, bodyId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAccreditationCycle = (id: string) =>
  api.get(`${BASE}/accreditation-cycles/${id}`).then(r => r.data);
export const createAccreditationCycle = (data: any) =>
  api.post(`${BASE}/accreditation-cycles`, data).then(r => r.data);
export const updateAccreditationCycle = (id: string, data: any) =>
  api.put(`${BASE}/accreditation-cycles/${id}`, data).then(r => r.data);
export const deleteAccreditationCycle = (id: string) =>
  api.delete(`${BASE}/accreditation-cycles/${id}`).then(r => r.data);

// ─── Compliance Criteria ──────────────────────────────────
export const listComplianceCriteria = (page = 1, limit = 20, accreditationCycleId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/compliance-criteria`, { params: { page, limit, accreditationCycleId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getComplianceCriteriaById = (id: string) =>
  api.get(`${BASE}/compliance-criteria/${id}`).then(r => r.data);
export const createComplianceCriteria = (data: any) =>
  api.post(`${BASE}/compliance-criteria`, data).then(r => r.data);
export const updateComplianceCriteria = (id: string, data: any) =>
  api.put(`${BASE}/compliance-criteria/${id}`, data).then(r => r.data);
export const deleteComplianceCriteria = (id: string) =>
  api.delete(`${BASE}/compliance-criteria/${id}`).then(r => r.data);

// ─── Regulatory Filings ──────────────────────────────────
export const listRegulatoryFilings = (page = 1, limit = 20, body?: string, status?: string, search?: string) =>
  api.get(`${BASE}/regulatory-filings`, { params: { page, limit, body, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getRegulatoryFiling = (id: string) =>
  api.get(`${BASE}/regulatory-filings/${id}`).then(r => r.data);
export const createRegulatoryFiling = (data: any) =>
  api.post(`${BASE}/regulatory-filings`, data).then(r => r.data);
export const updateRegulatoryFiling = (id: string, data: any) =>
  api.put(`${BASE}/regulatory-filings/${id}`, data).then(r => r.data);
export const deleteRegulatoryFiling = (id: string) =>
  api.delete(`${BASE}/regulatory-filings/${id}`).then(r => r.data);

// ─── AICTE Approvals ─────────────────────────────────────
export const listAICTEApprovals = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/aicte-approvals`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAICTEApproval = (id: string) =>
  api.get(`${BASE}/aicte-approvals/${id}`).then(r => r.data);
export const createAICTEApproval = (data: any) =>
  api.post(`${BASE}/aicte-approvals`, data).then(r => r.data);
export const updateAICTEApproval = (id: string, data: any) =>
  api.put(`${BASE}/aicte-approvals/${id}`, data).then(r => r.data);
export const deleteAICTEApproval = (id: string) =>
  api.delete(`${BASE}/aicte-approvals/${id}`).then(r => r.data);

// ─── Affiliation Statuses ────────────────────────────────
export const listAffiliationStatuses = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/affiliation-statuses`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAffiliationStatus = (id: string) =>
  api.get(`${BASE}/affiliation-statuses/${id}`).then(r => r.data);
export const createAffiliationStatus = (data: any) =>
  api.post(`${BASE}/affiliation-statuses`, data).then(r => r.data);
export const updateAffiliationStatus = (id: string, data: any) =>
  api.put(`${BASE}/affiliation-statuses/${id}`, data).then(r => r.data);
export const deleteAffiliationStatus = (id: string) =>
  api.delete(`${BASE}/affiliation-statuses/${id}`).then(r => r.data);

// ─── Audit Findings ──────────────────────────────────────
export const listAuditFindings = (page = 1, limit = 20, auditType?: string, status?: string, search?: string) =>
  api.get(`${BASE}/audit-findings`, { params: { page, limit, auditType, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAuditFinding = (id: string) =>
  api.get(`${BASE}/audit-findings/${id}`).then(r => r.data);
export const createAuditFinding = (data: any) =>
  api.post(`${BASE}/audit-findings`, data).then(r => r.data);
export const updateAuditFinding = (id: string, data: any) =>
  api.put(`${BASE}/audit-findings/${id}`, data).then(r => r.data);
export const deleteAuditFinding = (id: string) =>
  api.delete(`${BASE}/audit-findings/${id}`).then(r => r.data);

// ─── IQAC Reports ────────────────────────────────────────
export const listIQACReports = (page = 1, limit = 20, reportType?: string, status?: string, search?: string) =>
  api.get(`${BASE}/iqac-reports`, { params: { page, limit, reportType, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getIQACReport = (id: string) =>
  api.get(`${BASE}/iqac-reports/${id}`).then(r => r.data);
export const createIQACReport = (data: any) =>
  api.post(`${BASE}/iqac-reports`, data).then(r => r.data);
export const updateIQACReport = (id: string, data: any) =>
  api.put(`${BASE}/iqac-reports/${id}`, data).then(r => r.data);
export const deleteIQACReport = (id: string) =>
  api.delete(`${BASE}/iqac-reports/${id}`).then(r => r.data);

// ─── RTI Requests ────────────────────────────────────────
export const listRTIRequests = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/rti-requests`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getRTIRequest = (id: string) =>
  api.get(`${BASE}/rti-requests/${id}`).then(r => r.data);
export const createRTIRequest = (data: any) =>
  api.post(`${BASE}/rti-requests`, data).then(r => r.data);
export const updateRTIRequest = (id: string, data: any) =>
  api.put(`${BASE}/rti-requests/${id}`, data).then(r => r.data);
export const deleteRTIRequest = (id: string) =>
  api.delete(`${BASE}/rti-requests/${id}`).then(r => r.data);

// ─── Legal Cases ─────────────────────────────────────────
export const listLegalCases = (page = 1, limit = 20, caseType?: string, status?: string, search?: string) =>
  api.get(`${BASE}/legal-cases`, { params: { page, limit, caseType, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getLegalCase = (id: string) =>
  api.get(`${BASE}/legal-cases/${id}`).then(r => r.data);
export const createLegalCase = (data: any) =>
  api.post(`${BASE}/legal-cases`, data).then(r => r.data);
export const updateLegalCase = (id: string, data: any) =>
  api.put(`${BASE}/legal-cases/${id}`, data).then(r => r.data);
export const deleteLegalCase = (id: string) =>
  api.delete(`${BASE}/legal-cases/${id}`).then(r => r.data);
