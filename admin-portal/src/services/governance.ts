import api from './api';

const BASE = '/governance';

// ─── Stats ────────────────────────────────────────────────
export const getGovernanceStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Committees ───────────────────────────────────────────
export const listCommittees = (page = 1, limit = 20, type?: string) =>
  api.get(`${BASE}/committees`, { params: { page, limit, type } }).then(r => r.data);
export const getCommittee = (id: string) =>
  api.get(`${BASE}/committees/${id}`).then(r => r.data);
export const createCommittee = (data: any) =>
  api.post(`${BASE}/committees`, data).then(r => r.data);
export const updateCommittee = (id: string, data: any) =>
  api.put(`${BASE}/committees/${id}`, data).then(r => r.data);
export const deleteCommittee = (id: string) =>
  api.delete(`${BASE}/committees/${id}`).then(r => r.data);

// ─── Committee Meetings ──────────────────────────────────
export const listMeetings = (page = 1, limit = 20, committeeId?: string, status?: string) =>
  api.get(`${BASE}/meetings`, { params: { page, limit, committeeId, status } }).then(r => r.data);
export const getMeeting = (id: string) =>
  api.get(`${BASE}/meetings/${id}`).then(r => r.data);
export const createMeeting = (data: any) =>
  api.post(`${BASE}/meetings`, data).then(r => r.data);
export const updateMeeting = (id: string, data: any) =>
  api.put(`${BASE}/meetings/${id}`, data).then(r => r.data);
export const deleteMeeting = (id: string) =>
  api.delete(`${BASE}/meetings/${id}`).then(r => r.data);

// ─── Policies ─────────────────────────────────────────────
export const listPolicies = (page = 1, limit = 20, category?: string, status?: string) =>
  api.get(`${BASE}/policies`, { params: { page, limit, category, status } }).then(r => r.data);
export const getPolicy = (id: string) =>
  api.get(`${BASE}/policies/${id}`).then(r => r.data);
export const createPolicy = (data: any) =>
  api.post(`${BASE}/policies`, data).then(r => r.data);
export const updatePolicy = (id: string, data: any) =>
  api.put(`${BASE}/policies/${id}`, data).then(r => r.data);
export const deletePolicy = (id: string) =>
  api.delete(`${BASE}/policies/${id}`).then(r => r.data);

// ─── Governing Body Members ──────────────────────────────
export const listBoardMembers = (page = 1, limit = 20, role?: string) =>
  api.get(`${BASE}/board-members`, { params: { page, limit, role } }).then(r => r.data);
export const getBoardMember = (id: string) =>
  api.get(`${BASE}/board-members/${id}`).then(r => r.data);
export const createBoardMember = (data: any) =>
  api.post(`${BASE}/board-members`, data).then(r => r.data);
export const updateBoardMember = (id: string, data: any) =>
  api.put(`${BASE}/board-members/${id}`, data).then(r => r.data);
export const deleteBoardMember = (id: string) =>
  api.delete(`${BASE}/board-members/${id}`).then(r => r.data);

// ─── Strategic Goals ──────────────────────────────────────
export const listGoals = (page = 1, limit = 20, category?: string, status?: string) =>
  api.get(`${BASE}/goals`, { params: { page, limit, category, status } }).then(r => r.data);
export const getGoal = (id: string) =>
  api.get(`${BASE}/goals/${id}`).then(r => r.data);
export const createGoal = (data: any) =>
  api.post(`${BASE}/goals`, data).then(r => r.data);
export const updateGoal = (id: string, data: any) =>
  api.put(`${BASE}/goals/${id}`, data).then(r => r.data);
export const deleteGoal = (id: string) =>
  api.delete(`${BASE}/goals/${id}`).then(r => r.data);

// ─── Strategic Gap 4 — Declarative Report Engine ──────────────────

export interface ReportParam {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select' | 'boolean';
  required?: boolean;
  default?: unknown;
  options?: { value: string; label: string }[];
  helpText?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'percent' | 'currency';
}

export interface ReportDefinition {
  code: string;
  label: string;
  category: string;
  description: string;
  parameters: ReportParam[];
  columns: ReportColumn[];
  implementationStatus: 'implemented' | 'phase_b';
}

export interface ReportRun {
  _id: string;
  collegeId: string;
  definitionCode: string;
  parameters: Record<string, unknown>;
  status: 'queued' | 'running' | 'success' | 'failed' | 'unimplemented';
  result?: unknown[];
  resultCount: number;
  summary?: Record<string, unknown>;
  unimplementedReason?: string;
  error?: string;
  executedAt?: string;
  durationMs?: number;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const listReportDefinitions = (): Promise<{ definitions: ReportDefinition[] }> =>
  api.get(`${BASE}/reports/definitions`).then((r) => r.data);

export const listReportRuns = (page = 1, limit = 20, definitionCode?: string) =>
  api.get(`${BASE}/reports/runs`, { params: { page, limit, definitionCode } }).then((r) => r.data);

export const getReportRun = (id: string): Promise<ReportRun> =>
  api.get(`${BASE}/reports/runs/${id}`).then((r) => r.data);

export const runReport = (code: string, parameters: Record<string, unknown>): Promise<ReportRun> =>
  api.post(`${BASE}/reports/run/${code}`, { parameters }).then((r) => r.data);

// ─── 003-ai-nl-report-queries ─────────────────────────────────────

export const ALLOWED_NL_REPORTS = [
  'admissions-funnel',
  'lead-source-performance',
  'student-roster-snapshot',
] as const;

export type AllowedNlReportCode = (typeof ALLOWED_NL_REPORTS)[number];

export interface NlMatchedResponse {
  status: 'matched';
  reportCode: AllowedNlReportCode;
  params: Record<string, unknown>;
  runId: string;
  results: unknown;
  rationale: string;
  llmModel: string;
  costInr: number;
  isDuplicate?: boolean;
}

export interface NlRefusedResponse {
  status: 'refused';
  reason: string;
  supportedReports: ReadonlyArray<string>;
  llmModel: string;
  costInr: number;
  isDuplicate?: boolean;
  capReached?: boolean;
}

export type NlQueryResponse = NlMatchedResponse | NlRefusedResponse;

export interface NlReportStats {
  range: 'today' | 'week' | 'month';
  totalQueries: number;
  matched: number;
  refused: number;
  llmCostInr: number;
  byReport: Array<{ reportCode: string; count: number; costInr: number }>;
}

export const runNlQuery = (question: string): Promise<NlQueryResponse> =>
  api.post(`${BASE}/reports/nl-query`, { question }).then((r) => r.data);

export const getNlReportStats = (
  range: 'today' | 'week' | 'month' = 'today',
): Promise<NlReportStats> =>
  api.get(`${BASE}/reports/nl-query/stats`, { params: { range } }).then((r) => r.data);
