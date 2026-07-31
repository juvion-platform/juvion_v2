import api from './api';

const BASE = '/finance';

// ─── Stats ────────────────────────────────────────────────
export const getFinanceStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Fee Structures ───────────────────────────────────────
export const listFeeStructures = (page = 1, limit = 20, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/fee-structures`, { params: { page, limit, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getFeeStructure = (id: string) =>
  api.get(`${BASE}/fee-structures/${id}`).then(r => r.data);
export const createFeeStructure = (data: any) =>
  api.post(`${BASE}/fee-structures`, data).then(r => r.data);
export const updateFeeStructure = (id: string, data: any) =>
  api.put(`${BASE}/fee-structures/${id}`, data).then(r => r.data);
export const deleteFeeStructure = (id: string) =>
  api.delete(`${BASE}/fee-structures/${id}`).then(r => r.data);

// ─── Student Fee Accounts ─────────────────────────────────
export const listStudentFeeAccounts = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/student-fee-accounts`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getStudentFeeAccount = (id: string) =>
  api.get(`${BASE}/student-fee-accounts/${id}`).then(r => r.data);
export const createStudentFeeAccount = (data: any) =>
  api.post(`${BASE}/student-fee-accounts`, data).then(r => r.data);
export const updateStudentFeeAccount = (id: string, data: any) =>
  api.put(`${BASE}/student-fee-accounts/${id}`, data).then(r => r.data);
export const deleteStudentFeeAccount = (id: string) =>
  api.delete(`${BASE}/student-fee-accounts/${id}`).then(r => r.data);

// ─── Fee Line Items ───────────────────────────────────────
export const listFeeLineItems = (page = 1, limit = 20, studentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/fee-line-items`, { params: { page, limit, studentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getFeeLineItem = (id: string) =>
  api.get(`${BASE}/fee-line-items/${id}`).then(r => r.data);
export const createFeeLineItem = (data: any) =>
  api.post(`${BASE}/fee-line-items`, data).then(r => r.data);
export const updateFeeLineItem = (id: string, data: any) =>
  api.put(`${BASE}/fee-line-items/${id}`, data).then(r => r.data);
export const deleteFeeLineItem = (id: string) =>
  api.delete(`${BASE}/fee-line-items/${id}`).then(r => r.data);

// ─── Payments ─────────────────────────────────────────────
export const listPayments = (page = 1, limit = 20, studentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/payments`, { params: { page, limit, studentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getPayment = (id: string) =>
  api.get(`${BASE}/payments/${id}`).then(r => r.data);
export const createPayment = (data: any) =>
  api.post(`${BASE}/payments`, data).then(r => r.data);
export const updatePayment = (id: string, data: any) =>
  api.put(`${BASE}/payments/${id}`, data).then(r => r.data);
export const deletePayment = (id: string) =>
  api.delete(`${BASE}/payments/${id}`).then(r => r.data);

// ─── Scholarships ─────────────────────────────────────────
export const listScholarships = (page = 1, limit = 20, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/scholarships`, { params: { page, limit, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getScholarship = (id: string) =>
  api.get(`${BASE}/scholarships/${id}`).then(r => r.data);
export const createScholarship = (data: any) =>
  api.post(`${BASE}/scholarships`, data).then(r => r.data);
export const updateScholarship = (id: string, data: any) =>
  api.put(`${BASE}/scholarships/${id}`, data).then(r => r.data);
export const deleteScholarship = (id: string) =>
  api.delete(`${BASE}/scholarships/${id}`).then(r => r.data);

// ─── Scholarship Allocations ──────────────────────────────
export const listScholarshipAllocations = (page = 1, limit = 20, scholarshipId?: string, studentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/scholarship-allocations`, { params: { page, limit, scholarshipId, studentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const createScholarshipAllocation = (data: any) =>
  api.post(`${BASE}/scholarship-allocations`, data).then(r => r.data);
export const updateScholarshipAllocation = (id: string, data: any) =>
  api.put(`${BASE}/scholarship-allocations/${id}`, data).then(r => r.data);
export const deleteScholarshipAllocation = (id: string) =>
  api.delete(`${BASE}/scholarship-allocations/${id}`).then(r => r.data);

// ─── Concessions ──────────────────────────────────────────
export const listConcessions = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/concessions`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createConcession = (data: any) =>
  api.post(`${BASE}/concessions`, data).then(r => r.data);
export const updateConcession = (id: string, data: any) =>
  api.put(`${BASE}/concessions/${id}`, data).then(r => r.data);
export const deleteConcession = (id: string) =>
  api.delete(`${BASE}/concessions/${id}`).then(r => r.data);

// ─── Refunds ──────────────────────────────────────────────
export const listRefunds = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/refunds`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createRefund = (data: any) =>
  api.post(`${BASE}/refunds`, data).then(r => r.data);
export const updateRefund = (id: string, data: any) =>
  api.put(`${BASE}/refunds/${id}`, data).then(r => r.data);
export const deleteRefund = (id: string) =>
  api.delete(`${BASE}/refunds/${id}`).then(r => r.data);

// ─── Fines & Penalties ────────────────────────────────────
export const listFinePenalties = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/fines`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createFinePenalty = (data: any) =>
  api.post(`${BASE}/fines`, data).then(r => r.data);
export const updateFinePenalty = (id: string, data: any) =>
  api.put(`${BASE}/fines/${id}`, data).then(r => r.data);
export const deleteFinePenalty = (id: string) =>
  api.delete(`${BASE}/fines/${id}`).then(r => r.data);

// ─── Invoices ─────────────────────────────────────────────
export const listInvoices = (page = 1, limit = 20, status?: string, studentId?: string, search?: string) =>
  api.get(`${BASE}/invoices`, { params: { page, limit, status, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getInvoice = (id: string) =>
  api.get(`${BASE}/invoices/${id}`).then(r => r.data);
export const createInvoice = (data: any) =>
  api.post(`${BASE}/invoices`, data).then(r => r.data);
export const updateInvoice = (id: string, data: any) =>
  api.put(`${BASE}/invoices/${id}`, data).then(r => r.data);
export const deleteInvoice = (id: string) =>
  api.delete(`${BASE}/invoices/${id}`).then(r => r.data);

// 007 — pin-driven semester-installment billing. Omit studentIds to bill every active
// pinned student; dryRun previews the outcome counts without writing.
export interface GenerateFeeBillsResult {
  dryRun: boolean;
  generated: number;
  alreadyBilled: number;
  noPin: number;
  pinnedToDifferentAy: number;
  noAmount: number;
  unsupportedSemesterNumber: number;
  errors: Array<{ studentId: string; error: string }>;
}
export const generateFeeBills = (body: {
  semesterId: string;
  studentIds?: string[];
  yearOfStudy?: number;
  dryRun?: boolean;
}): Promise<GenerateFeeBillsResult> =>
  api.post(`${BASE}/invoices/generate-from-pins`, body).then(r => r.data);

// ─── Budget ───────────────────────────────────────────────
export const listBudgets = (page = 1, limit = 20, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/budgets`, { params: { page, limit, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getBudget = (id: string) =>
  api.get(`${BASE}/budgets/${id}`).then(r => r.data);
export const createBudget = (data: any) =>
  api.post(`${BASE}/budgets`, data).then(r => r.data);
export const updateBudget = (id: string, data: any) =>
  api.put(`${BASE}/budgets/${id}`, data).then(r => r.data);
export const deleteBudget = (id: string) =>
  api.delete(`${BASE}/budgets/${id}`).then(r => r.data);

// ─── Expenses ─────────────────────────────────────────────
export const listExpenses = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/expenses`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getExpense = (id: string) =>
  api.get(`${BASE}/expenses/${id}`).then(r => r.data);
export const createExpense = (data: any) =>
  api.post(`${BASE}/expenses`, data).then(r => r.data);
export const updateExpense = (id: string, data: any) =>
  api.put(`${BASE}/expenses/${id}`, data).then(r => r.data);
export const deleteExpense = (id: string) =>
  api.delete(`${BASE}/expenses/${id}`).then(r => r.data);

// ─── Financial Ledger ─────────────────────────────────────
export const listFinancialLedger = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/ledger`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createFinancialLedger = (data: any) =>
  api.post(`${BASE}/ledger`, data).then(r => r.data);
export const updateFinancialLedger = (id: string, data: any) =>
  api.put(`${BASE}/ledger/${id}`, data).then(r => r.data);
export const deleteFinancialLedger = (id: string) =>
  api.delete(`${BASE}/ledger/${id}`).then(r => r.data);

// ─── Payment Gateway Logs ─────────────────────────────────
export const listPaymentGatewayLogs = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/gateway-logs`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPaymentGatewayLog = (data: any) =>
  api.post(`${BASE}/gateway-logs`, data).then(r => r.data);
export const updatePaymentGatewayLog = (id: string, data: any) =>
  api.put(`${BASE}/gateway-logs/${id}`, data).then(r => r.data);
export const deletePaymentGatewayLog = (id: string) =>
  api.delete(`${BASE}/gateway-logs/${id}`).then(r => r.data);

// ─── Fee Reminders ────────────────────────────────────────
export const listFeeReminders = (page = 1, limit = 20, studentId?: string, channel?: string, status?: string, search?: string) =>
  api.get(`${BASE}/reminders`, { params: { page, limit, studentId, channel, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const createFeeReminder = (data: any) =>
  api.post(`${BASE}/reminders`, data).then(r => r.data);
export const updateFeeReminder = (id: string, data: any) =>
  api.put(`${BASE}/reminders/${id}`, data).then(r => r.data);
export const deleteFeeReminder = (id: string) =>
  api.delete(`${BASE}/reminders/${id}`).then(r => r.data);

// ─── Financial Reports ────────────────────────────────────
export const listFinancialReports = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/reports`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const createFinancialReport = (data: any) =>
  api.post(`${BASE}/reports`, data).then(r => r.data);
export const deleteFinancialReport = (id: string) =>
  api.delete(`${BASE}/reports/${id}`).then(r => r.data);

// ─── Fee Analytics & Alerts (T8 / T11) ────────────────────
// Backend spec: .captain/specs/fee-collection-analytics-and-alerts

export interface DefaulterListItem {
  studentId: string;
  rollNumber: string;
  name: string;
  programmeName: string;
  overdueAmount: number;
  daysOverdue: number;
  escalationStage: string;
  /** ISO date string when the cron auto-escalation is paused until (future → skipped). */
  autoEscalationPaused?: string | null;
}

export interface DefaulterListResponse {
  items: DefaulterListItem[];
  total: number;
}

export const getDefaulters = (params: {
  limit?: number;
  offset?: number;
  sort?: 'overdueAmount' | 'daysOverdue';
} = {}) =>
  api
    .get<DefaulterListResponse>(`${BASE}/analytics/defaulters`, { params })
    .then(r => r.data);

export interface PauseEscalationResponse {
  updated: number;
  studentId: string;
  /** ISO date string the records are now paused until (server echoes what was set). */
  pausedUntil: string;
}

/**
 * Pause / resume auto-escalation for a student.
 * - To pause: pass a future-dated ISO string.
 * - To "resume now": pass `new Date().toISOString()` — cron skip-guard
 *   uses `autoEscalationPaused > now`, so a past/now value effectively
 *   un-pauses on the next run.
 */
export const pauseEscalation = (studentId: string, pausedUntil: string) =>
  api
    .post<PauseEscalationResponse>(`${BASE}/students/${studentId}/pause-escalation`, {
      pausedUntil,
    })
    .then(r => r.data);
