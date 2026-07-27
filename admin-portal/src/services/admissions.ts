import api from './api';

const BASE = '/admissions';
const WORKFLOW_BASE = '/admissions/workflow';

// ─── Stats ─────────────────────────────────────────────
export const getStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Inquiries ─────────────────────────────────────────
export interface ListInquiriesOpts {
  status?: string;
  /** Lead-grade filter. 'hot_warm' covers both top tiers. */
  grade?: 'hot' | 'warm' | 'cold' | 'dormant' | 'hot_warm';
  /** 'newest' (default) or 'score' (highest leadScore first). */
  sort?: 'newest' | 'score';
}
export const listInquiries = (page = 1, limit = 20, statusOrOpts?: string | ListInquiriesOpts, search?: string) => {
  // Back-compat: callers that already pass a status string keep working.
  const opts: ListInquiriesOpts = typeof statusOrOpts === 'string'
    ? { status: statusOrOpts }
    : statusOrOpts ?? {};
  return api.get(`${BASE}/inquiries`, { params: { page, limit, ...opts, ...(search ? { search } : {}) } }).then(r => r.data);
};

export const getInquiry = (id: string) =>
  api.get(`${BASE}/inquiries/${id}`).then(r => r.data);

export const createInquiry = (data: any) =>
  api.post(`${BASE}/inquiries`, data).then(r => r.data);

export const updateInquiry = (id: string, data: any) =>
  api.put(`${BASE}/inquiries/${id}`, data).then(r => r.data);

export const deleteInquiry = (id: string) =>
  api.delete(`${BASE}/inquiries/${id}`).then(r => r.data);

export const convertInquiry = (id: string, data: any) =>
  api.post(`${BASE}/inquiries/${id}/convert`, data).then(r => r.data);

// ─── Applicants ────────────────────────────────────────
export const listApplicants = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/applicants`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);

export const getApplicant = (id: string) =>
  api.get(`${BASE}/applicants/${id}`).then(r => r.data);

export const createApplicant = (data: any) =>
  api.post(`${BASE}/applicants`, data).then(r => r.data);

export const updateApplicant = (id: string, data: any) =>
  api.put(`${BASE}/applicants/${id}`, data).then(r => r.data);

// ─── Exam Scores ───────────────────────────────────────
export const listExamScores = (page = 1, limit = 20, applicantId?: string, search?: string) =>
  api.get(`${BASE}/exam-scores`, { params: { page, limit, applicantId, ...(search ? { search } : {}) } }).then(r => r.data);

export const createExamScore = (data: any) =>
  api.post(`${BASE}/exam-scores`, data).then(r => r.data);

export const updateExamScore = (id: string, data: any) =>
  api.put(`${BASE}/exam-scores/${id}`, data).then(r => r.data);

export const deleteExamScore = (id: string) =>
  api.delete(`${BASE}/exam-scores/${id}`).then(r => r.data);

// ─── Counseling ────────────────────────────────────────
export const listCounseling = (page = 1, limit = 20, applicantId?: string, search?: string) =>
  api.get(`${BASE}/counseling`, { params: { page, limit, applicantId, ...(search ? { search } : {}) } }).then(r => r.data);

export const createCounseling = (data: any) =>
  api.post(`${BASE}/counseling`, data).then(r => r.data);

export const updateCounseling = (id: string, data: any) =>
  api.put(`${BASE}/counseling/${id}`, data).then(r => r.data);

export const deleteCounseling = (id: string) =>
  api.delete(`${BASE}/counseling/${id}`).then(r => r.data);

// ─── Offers ────────────────────────────────────────────
export const listOffers = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/offers`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);

export const createOffer = (data: any) =>
  api.post(`${BASE}/offers`, data).then(r => r.data);

export const updateOffer = (id: string, data: any) =>
  api.put(`${BASE}/offers/${id}`, data).then(r => r.data);

// ─── Documents ─────────────────────────────────────────
export const listDocumentChecklists = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/documents`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);

export const getDocumentChecklist = (applicantId: string) =>
  api.get(`${BASE}/documents/${applicantId}`).then(r => r.data);

export const upsertDocumentChecklist = (applicantId: string, data: any) =>
  api.put(`${BASE}/documents/${applicantId}`, data).then(r => r.data);

// ─── Enrollments ───────────────────────────────────────
export const listEnrollments = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/enrollments`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);

export const createEnrollment = (data: any) =>
  api.post(`${BASE}/enrollments`, data).then(r => r.data);

export const updateEnrollment = (id: string, data: any) =>
  api.put(`${BASE}/enrollments/${id}`, data).then(r => r.data);

export const deleteEnrollment = (id: string) =>
  api.delete(`${BASE}/enrollments/${id}`).then(r => r.data);

// ─── Workflow ──────────────────────────────────────────
export const getWorkflowStats = () =>
  api.get(`${WORKFLOW_BASE}/stats`).then(r => r.data);

export const listWorkflowInstances = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${WORKFLOW_BASE}/instances`, { params: { workflowId: 'W01', page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);

export const getWorkflowStatus = (instanceId: string) =>
  api.get(`${WORKFLOW_BASE}/instances/${instanceId}`).then(r => r.data);

export const startWorkflow = (data: any) =>
  api.post(`${WORKFLOW_BASE}/instances`, data).then(r => r.data);

export const triggerWorkflowStep = (instanceId: string, data: any) =>
  api.post(`${WORKFLOW_BASE}/instances/${instanceId}/trigger-step`, data).then(r => r.data);

export const completeWorkflowTask = (taskId: string, data: any) =>
  api.post(`${WORKFLOW_BASE}/tasks/${taskId}/complete`, data).then(r => r.data);

export const failWorkflowTask = (taskId: string, reason: string) =>
  api.post(`${WORKFLOW_BASE}/tasks/${taskId}/fail`, { reason }).then(r => r.data);

export const skipWorkflowTask = (taskId: string, reason: string) =>
  api.post(`${WORKFLOW_BASE}/tasks/${taskId}/skip`, { reason }).then(r => r.data);

export const listWorkflowTasks = (page = 1, limit = 20, status?: string, phase?: string, search?: string) =>
  api.get(`${WORKFLOW_BASE}/tasks`, { params: { page, limit, status, phase, ...(search ? { search } : {}) } }).then(r => r.data);

export const listWorkflowAllotmentRounds = (academicYearId?: string) =>
  api.get(`${WORKFLOW_BASE}/allotment-rounds`, { params: { academicYearId } }).then(r => r.data);

// ─── Strategic Gap 5 — AssignmentRule + CRM dashboard clients ──────

export type AssignmentRuleField =
  | 'source' | 'utmSource' | 'utmMedium' | 'utmCampaign'
  | 'programmeInterest' | 'branchInterest'
  | 'leadScore' | 'leadGrade'
  | 'state' | 'city' | 'interStream';
export type AssignmentRuleOperator =
  | 'equals' | 'not_equals' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

export interface AssignmentRuleCondition {
  field: AssignmentRuleField;
  operator: AssignmentRuleOperator;
  value: string | number | string[];
}

export interface AssignmentRuleDoc {
  _id: string;
  collegeId: string;
  name: string;
  description?: string;
  conditions: AssignmentRuleCondition[];
  assignedOfficerId: string;
  clusterHeadId?: string;
  priority: number;
  enabled: boolean;
  createdBy: string;
  matchCount: number;
  lastMatchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const listAssignmentRules = (): Promise<AssignmentRuleDoc[]> =>
  api.get(`${BASE}/assignment-rules`).then((r) => r.data);

export const getAssignmentRule = (id: string): Promise<AssignmentRuleDoc> =>
  api.get(`${BASE}/assignment-rules/${id}`).then((r) => r.data);

export const createAssignmentRule = (
  data: Partial<AssignmentRuleDoc>,
): Promise<AssignmentRuleDoc> =>
  api.post(`${BASE}/assignment-rules`, data).then((r) => r.data);

export const updateAssignmentRule = (
  id: string,
  patch: Partial<AssignmentRuleDoc>,
): Promise<AssignmentRuleDoc> =>
  api.put(`${BASE}/assignment-rules/${id}`, patch).then((r) => r.data);

export const deleteAssignmentRule = (id: string): Promise<{ deleted: true }> =>
  api.delete(`${BASE}/assignment-rules/${id}`).then((r) => r.data);

export const previewAssignmentRule = (
  inquiry: Record<string, unknown>,
): Promise<{ matched: boolean; rule: AssignmentRuleDoc | null }> =>
  api
    .post(`${BASE}/assignment-rules/preview`, { inquiry })
    .then((r) => r.data);

// ─── CRM dashboard ─────────────────────────────────────────────────

export interface CRMPipelineStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface CRMFunnelStats {
  stages: Array<{ stage: string; count: number; statuses: string[] }>;
}

export interface CRMOfficerStats {
  officers: Array<{
    officerId: string;
    name: string;
    assigned: number;
    converted: number;
    conversionRate: number;
  }>;
  unassigned: number;
}

export interface CRMSourceStats {
  bySource: Array<{ source: string | null; inquiries: number; converted: number; conversionRate: number }>;
  byUtmCampaign: Array<{ utmCampaign: string | null; inquiries: number; converted: number; conversionRate: number }>;
}

export const getCRMPipeline = (): Promise<CRMPipelineStats> =>
  api.get(`${BASE}/crm/pipeline`).then((r) => r.data);
export const getCRMFunnel = (): Promise<CRMFunnelStats> =>
  api.get(`${BASE}/crm/funnel`).then((r) => r.data);
export const getCRMOfficers = (): Promise<CRMOfficerStats> =>
  api.get(`${BASE}/crm/officers`).then((r) => r.data);
export const getCRMSources = (): Promise<CRMSourceStats> =>
  api.get(`${BASE}/crm/sources`).then((r) => r.data);

// ─── 001-ai-lead-scoring ───────────────────────────────────────────

export type LeadGrade = 'hot' | 'warm' | 'cold' | 'dormant';

export interface ScoreFactor {
  label: string;
  weight: number;
  source: 'rule' | 'llm';
}

export interface ScoreRationale {
  ruleScore: number;
  llmScore: number | null;
  blendedScore: number;
  factors: ScoreFactor[];
  lastInteractionInfluence?: { factor: string; shift: number };
  llmSkipped?: boolean;
  llmFallback?: boolean;
  llmCostInr?: number;
  computedAt: string;
  modelVersion: string;
}

export interface LeadScoringStats {
  range: 'today' | 'week' | 'month';
  days: number;
  totalScored: number;
  llmScored: number;
  rulesOnlyScored: number;
  totalLlmCostInr: number;
  avgLatencyMs: number;
  gradeDistribution: { hot: number; warm: number; cold: number; dormant: number };
  capReached: boolean;
  modelVersion: string | null;
  daily: Array<{
    date: string;
    totalScored: number;
    llmScored: number;
    rulesOnlyScored: number;
    totalLlmCostInr: number;
    gradeDistribution: { hot: number; warm: number; cold: number; dormant: number };
    llmCapHit: boolean;
  }>;
}

export interface RescoreResponse {
  status: 'enqueued' | 'already_scored';
  jobId: string;
  lastScoredAt?: string;
}

export interface BatchScoreResponse {
  enqueued: number;
  requestedBy: string;
  filterMatched: number;
}

export interface BatchScoreFilter {
  status?: string;
  source?: string;
  leadGrade?: LeadGrade;
  updatedSince?: string;
  maxJobs?: number;
}

export const rescoreInquiry = (id: string): Promise<RescoreResponse> =>
  api.post(`${BASE}/inquiries/${id}/rescore`).then((r) => r.data);

export const batchScoreInquiries = (filter: BatchScoreFilter): Promise<BatchScoreResponse> =>
  api.post(`${BASE}/lead-scoring/batch`, filter).then((r) => r.data);

export const getLeadScoringStats = (range: 'today' | 'week' | 'month' = 'today'): Promise<LeadScoringStats> =>
  api.get(`${BASE}/lead-scoring/stats`, { params: { range } }).then((r) => r.data);
