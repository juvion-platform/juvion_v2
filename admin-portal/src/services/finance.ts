import api from './api';

const BASE = '/finance';

// ─── Stats ────────────────────────────────────────────────
export const getFinanceStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Fee Structures ───────────────────────────────────────
export const listFeeStructures = (page = 1, limit = 20, academicYearId?: string) =>
  api.get(`${BASE}/fee-structures`, { params: { page, limit, academicYearId } }).then(r => r.data);
export const getFeeStructure = (id: string) =>
  api.get(`${BASE}/fee-structures/${id}`).then(r => r.data);
export const createFeeStructure = (data: any) =>
  api.post(`${BASE}/fee-structures`, data).then(r => r.data);
export const updateFeeStructure = (id: string, data: any) =>
  api.put(`${BASE}/fee-structures/${id}`, data).then(r => r.data);
export const deleteFeeStructure = (id: string) =>
  api.delete(`${BASE}/fee-structures/${id}`).then(r => r.data);

// ─── Student Fee Accounts ─────────────────────────────────
export const listStudentFeeAccounts = (page = 1, limit = 20) =>
  api.get(`${BASE}/student-fee-accounts`, { params: { page, limit } }).then(r => r.data);
export const getStudentFeeAccount = (id: string) =>
  api.get(`${BASE}/student-fee-accounts/${id}`).then(r => r.data);
export const createStudentFeeAccount = (data: any) =>
  api.post(`${BASE}/student-fee-accounts`, data).then(r => r.data);
export const updateStudentFeeAccount = (id: string, data: any) =>
  api.put(`${BASE}/student-fee-accounts/${id}`, data).then(r => r.data);
export const deleteStudentFeeAccount = (id: string) =>
  api.delete(`${BASE}/student-fee-accounts/${id}`).then(r => r.data);

// ─── Fee Line Items ───────────────────────────────────────
export const listFeeLineItems = (page = 1, limit = 20, studentId?: string, status?: string) =>
  api.get(`${BASE}/fee-line-items`, { params: { page, limit, studentId, status } }).then(r => r.data);
export const getFeeLineItem = (id: string) =>
  api.get(`${BASE}/fee-line-items/${id}`).then(r => r.data);
export const createFeeLineItem = (data: any) =>
  api.post(`${BASE}/fee-line-items`, data).then(r => r.data);
export const updateFeeLineItem = (id: string, data: any) =>
  api.put(`${BASE}/fee-line-items/${id}`, data).then(r => r.data);
export const deleteFeeLineItem = (id: string) =>
  api.delete(`${BASE}/fee-line-items/${id}`).then(r => r.data);

// ─── Payments ─────────────────────────────────────────────
export const listPayments = (page = 1, limit = 20, studentId?: string, status?: string) =>
  api.get(`${BASE}/payments`, { params: { page, limit, studentId, status } }).then(r => r.data);
export const getPayment = (id: string) =>
  api.get(`${BASE}/payments/${id}`).then(r => r.data);
export const createPayment = (data: any) =>
  api.post(`${BASE}/payments`, data).then(r => r.data);
export const updatePayment = (id: string, data: any) =>
  api.put(`${BASE}/payments/${id}`, data).then(r => r.data);
export const deletePayment = (id: string) =>
  api.delete(`${BASE}/payments/${id}`).then(r => r.data);

// ─── Scholarships ─────────────────────────────────────────
export const listScholarships = (page = 1, limit = 20, academicYearId?: string) =>
  api.get(`${BASE}/scholarships`, { params: { page, limit, academicYearId } }).then(r => r.data);
export const getScholarship = (id: string) =>
  api.get(`${BASE}/scholarships/${id}`).then(r => r.data);
export const createScholarship = (data: any) =>
  api.post(`${BASE}/scholarships`, data).then(r => r.data);
export const updateScholarship = (id: string, data: any) =>
  api.put(`${BASE}/scholarships/${id}`, data).then(r => r.data);
export const deleteScholarship = (id: string) =>
  api.delete(`${BASE}/scholarships/${id}`).then(r => r.data);

// ─── Scholarship Allocations ──────────────────────────────
export const listScholarshipAllocations = (page = 1, limit = 20, scholarshipId?: string, studentId?: string, status?: string) =>
  api.get(`${BASE}/scholarship-allocations`, { params: { page, limit, scholarshipId, studentId, status } }).then(r => r.data);
export const createScholarshipAllocation = (data: any) =>
  api.post(`${BASE}/scholarship-allocations`, data).then(r => r.data);
export const updateScholarshipAllocation = (id: string, data: any) =>
  api.put(`${BASE}/scholarship-allocations/${id}`, data).then(r => r.data);
export const deleteScholarshipAllocation = (id: string) =>
  api.delete(`${BASE}/scholarship-allocations/${id}`).then(r => r.data);

// ─── Concessions ──────────────────────────────────────────
export const listConcessions = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/concessions`, { params: { page, limit, studentId } }).then(r => r.data);
export const createConcession = (data: any) =>
  api.post(`${BASE}/concessions`, data).then(r => r.data);
export const updateConcession = (id: string, data: any) =>
  api.put(`${BASE}/concessions/${id}`, data).then(r => r.data);
export const deleteConcession = (id: string) =>
  api.delete(`${BASE}/concessions/${id}`).then(r => r.data);

// ─── Refunds ──────────────────────────────────────────────
export const listRefunds = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/refunds`, { params: { page, limit, studentId } }).then(r => r.data);
export const createRefund = (data: any) =>
  api.post(`${BASE}/refunds`, data).then(r => r.data);
export const updateRefund = (id: string, data: any) =>
  api.put(`${BASE}/refunds/${id}`, data).then(r => r.data);
export const deleteRefund = (id: string) =>
  api.delete(`${BASE}/refunds/${id}`).then(r => r.data);

// ─── Fines & Penalties ────────────────────────────────────
export const listFinePenalties = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/fines`, { params: { page, limit, studentId } }).then(r => r.data);
export const createFinePenalty = (data: any) =>
  api.post(`${BASE}/fines`, data).then(r => r.data);
export const updateFinePenalty = (id: string, data: any) =>
  api.put(`${BASE}/fines/${id}`, data).then(r => r.data);
export const deleteFinePenalty = (id: string) =>
  api.delete(`${BASE}/fines/${id}`).then(r => r.data);

// ─── Invoices ─────────────────────────────────────────────
export const listInvoices = (page = 1, limit = 20, status?: string, studentId?: string) =>
  api.get(`${BASE}/invoices`, { params: { page, limit, status, studentId } }).then(r => r.data);
export const getInvoice = (id: string) =>
  api.get(`${BASE}/invoices/${id}`).then(r => r.data);
export const createInvoice = (data: any) =>
  api.post(`${BASE}/invoices`, data).then(r => r.data);
export const updateInvoice = (id: string, data: any) =>
  api.put(`${BASE}/invoices/${id}`, data).then(r => r.data);
export const deleteInvoice = (id: string) =>
  api.delete(`${BASE}/invoices/${id}`).then(r => r.data);

// ─── Budget ───────────────────────────────────────────────
export const listBudgets = (page = 1, limit = 20, academicYearId?: string) =>
  api.get(`${BASE}/budgets`, { params: { page, limit, academicYearId } }).then(r => r.data);
export const getBudget = (id: string) =>
  api.get(`${BASE}/budgets/${id}`).then(r => r.data);
export const createBudget = (data: any) =>
  api.post(`${BASE}/budgets`, data).then(r => r.data);
export const updateBudget = (id: string, data: any) =>
  api.put(`${BASE}/budgets/${id}`, data).then(r => r.data);
export const deleteBudget = (id: string) =>
  api.delete(`${BASE}/budgets/${id}`).then(r => r.data);

// ─── Expenses ─────────────────────────────────────────────
export const listExpenses = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/expenses`, { params: { page, limit, status } }).then(r => r.data);
export const getExpense = (id: string) =>
  api.get(`${BASE}/expenses/${id}`).then(r => r.data);
export const createExpense = (data: any) =>
  api.post(`${BASE}/expenses`, data).then(r => r.data);
export const updateExpense = (id: string, data: any) =>
  api.put(`${BASE}/expenses/${id}`, data).then(r => r.data);
export const deleteExpense = (id: string) =>
  api.delete(`${BASE}/expenses/${id}`).then(r => r.data);

// ─── Financial Ledger ─────────────────────────────────────
export const listFinancialLedger = (page = 1, limit = 20) =>
  api.get(`${BASE}/ledger`, { params: { page, limit } }).then(r => r.data);
export const createFinancialLedger = (data: any) =>
  api.post(`${BASE}/ledger`, data).then(r => r.data);
export const updateFinancialLedger = (id: string, data: any) =>
  api.put(`${BASE}/ledger/${id}`, data).then(r => r.data);
export const deleteFinancialLedger = (id: string) =>
  api.delete(`${BASE}/ledger/${id}`).then(r => r.data);

// ─── Payment Gateway Logs ─────────────────────────────────
export const listPaymentGatewayLogs = (page = 1, limit = 20) =>
  api.get(`${BASE}/gateway-logs`, { params: { page, limit } }).then(r => r.data);
export const createPaymentGatewayLog = (data: any) =>
  api.post(`${BASE}/gateway-logs`, data).then(r => r.data);
export const updatePaymentGatewayLog = (id: string, data: any) =>
  api.put(`${BASE}/gateway-logs/${id}`, data).then(r => r.data);
export const deletePaymentGatewayLog = (id: string) =>
  api.delete(`${BASE}/gateway-logs/${id}`).then(r => r.data);

// ─── Fee Reminders ────────────────────────────────────────
export const listFeeReminders = (page = 1, limit = 20, studentId?: string, channel?: string, status?: string) =>
  api.get(`${BASE}/reminders`, { params: { page, limit, studentId, channel, status } }).then(r => r.data);
export const createFeeReminder = (data: any) =>
  api.post(`${BASE}/reminders`, data).then(r => r.data);
export const updateFeeReminder = (id: string, data: any) =>
  api.put(`${BASE}/reminders/${id}`, data).then(r => r.data);
export const deleteFeeReminder = (id: string) =>
  api.delete(`${BASE}/reminders/${id}`).then(r => r.data);

// ─── Financial Reports ────────────────────────────────────
export const listFinancialReports = (page = 1, limit = 20) =>
  api.get(`${BASE}/reports`, { params: { page, limit } }).then(r => r.data);
export const createFinancialReport = (data: any) =>
  api.post(`${BASE}/reports`, data).then(r => r.data);
export const deleteFinancialReport = (id: string) =>
  api.delete(`${BASE}/reports/${id}`).then(r => r.data);

// ─── Fee Components ──────────────────────────────────────
export const listFeeComponents = (page = 1, limit = 20) =>
  api.get(`${BASE}/fee-components`, { params: { page, limit } }).then(r => r.data);
export const createFeeComponent = (data: any) =>
  api.post(`${BASE}/fee-components`, data).then(r => r.data);
export const updateFeeComponent = (id: string, data: any) =>
  api.put(`${BASE}/fee-components/${id}`, data).then(r => r.data);
export const deleteFeeComponent = (id: string) =>
  api.delete(`${BASE}/fee-components/${id}`).then(r => r.data);

// ─── Fee Component Rules ─────────────────────────────────
export const listFeeComponentRules = (page = 1, limit = 20) =>
  api.get(`${BASE}/fee-component-rules`, { params: { page, limit } }).then(r => r.data);
export const createFeeComponentRule = (data: any) =>
  api.post(`${BASE}/fee-component-rules`, data).then(r => r.data);
export const updateFeeComponentRule = (id: string, data: any) =>
  api.put(`${BASE}/fee-component-rules/${id}`, data).then(r => r.data);
export const deleteFeeComponentRule = (id: string) =>
  api.delete(`${BASE}/fee-component-rules/${id}`).then(r => r.data);

// ─── Payment Transactions ────────────────────────────────
export const listPaymentTransactions = (page = 1, limit = 20) =>
  api.get(`${BASE}/payment-transactions`, { params: { page, limit } }).then(r => r.data);
export const createPaymentTransaction = (data: any) =>
  api.post(`${BASE}/payment-transactions`, data).then(r => r.data);
export const updatePaymentTransaction = (id: string, data: any) =>
  api.put(`${BASE}/payment-transactions/${id}`, data).then(r => r.data);
export const deletePaymentTransaction = (id: string) =>
  api.delete(`${BASE}/payment-transactions/${id}`).then(r => r.data);

// ─── Receipts ────────────────────────────────────────────
export const listReceipts = (page = 1, limit = 20) =>
  api.get(`${BASE}/receipts`, { params: { page, limit } }).then(r => r.data);
export const createReceipt = (data: any) =>
  api.post(`${BASE}/receipts`, data).then(r => r.data);
export const updateReceipt = (id: string, data: any) =>
  api.put(`${BASE}/receipts/${id}`, data).then(r => r.data);
export const deleteReceipt = (id: string) =>
  api.delete(`${BASE}/receipts/${id}`).then(r => r.data);

// ─── Defaulter Records ──────────────────────────────────
export const listDefaulterRecords = (page = 1, limit = 20) =>
  api.get(`${BASE}/defaulter-records`, { params: { page, limit } }).then(r => r.data);
export const createDefaulterRecord = (data: any) =>
  api.post(`${BASE}/defaulter-records`, data).then(r => r.data);
export const updateDefaulterRecord = (id: string, data: any) =>
  api.put(`${BASE}/defaulter-records/${id}`, data).then(r => r.data);
export const deleteDefaulterRecord = (id: string) =>
  api.delete(`${BASE}/defaulter-records/${id}`).then(r => r.data);

// ─── Financial Holds ─────────────────────────────────────
export const listFinancialHolds = (page = 1, limit = 20) =>
  api.get(`${BASE}/financial-holds`, { params: { page, limit } }).then(r => r.data);
export const createFinancialHold = (data: any) =>
  api.post(`${BASE}/financial-holds`, data).then(r => r.data);
export const updateFinancialHold = (id: string, data: any) =>
  api.put(`${BASE}/financial-holds/${id}`, data).then(r => r.data);
export const deleteFinancialHold = (id: string) =>
  api.delete(`${BASE}/financial-holds/${id}`).then(r => r.data);

// ─── Scholarship Eligibility ─────────────────────────────
export const listScholarshipEligibility = (page = 1, limit = 20) =>
  api.get(`${BASE}/scholarship-eligibility`, { params: { page, limit } }).then(r => r.data);
export const createScholarshipEligibility = (data: any) =>
  api.post(`${BASE}/scholarship-eligibility`, data).then(r => r.data);
export const updateScholarshipEligibility = (id: string, data: any) =>
  api.put(`${BASE}/scholarship-eligibility/${id}`, data).then(r => r.data);
export const deleteScholarshipEligibility = (id: string) =>
  api.delete(`${BASE}/scholarship-eligibility/${id}`).then(r => r.data);

// ─── Scholarship Claims ──────────────────────────────────
export const listScholarshipClaims = (page = 1, limit = 20) =>
  api.get(`${BASE}/scholarship-claims`, { params: { page, limit } }).then(r => r.data);
export const createScholarshipClaim = (data: any) =>
  api.post(`${BASE}/scholarship-claims`, data).then(r => r.data);
export const updateScholarshipClaim = (id: string, data: any) =>
  api.put(`${BASE}/scholarship-claims/${id}`, data).then(r => r.data);
export const deleteScholarshipClaim = (id: string) =>
  api.delete(`${BASE}/scholarship-claims/${id}`).then(r => r.data);

// ─── Fee Agreements ──────────────────────────────────────
export const listFeeAgreements = (page = 1, limit = 20) =>
  api.get(`${BASE}/fee-agreements`, { params: { page, limit } }).then(r => r.data);
export const createFeeAgreement = (data: any) =>
  api.post(`${BASE}/fee-agreements`, data).then(r => r.data);
export const updateFeeAgreement = (id: string, data: any) =>
  api.put(`${BASE}/fee-agreements/${id}`, data).then(r => r.data);
export const deleteFeeAgreement = (id: string) =>
  api.delete(`${BASE}/fee-agreements/${id}`).then(r => r.data);

// ─── Payment Plans ───────────────────────────────────────
export const listPaymentPlans = (page = 1, limit = 20) =>
  api.get(`${BASE}/payment-plans`, { params: { page, limit } }).then(r => r.data);
export const createPaymentPlan = (data: any) =>
  api.post(`${BASE}/payment-plans`, data).then(r => r.data);
export const updatePaymentPlan = (id: string, data: any) =>
  api.put(`${BASE}/payment-plans/${id}`, data).then(r => r.data);
export const deletePaymentPlan = (id: string) =>
  api.delete(`${BASE}/payment-plans/${id}`).then(r => r.data);

// ─── Reconciliation Entries ──────────────────────────────
export const listReconciliationEntries = (page = 1, limit = 20) =>
  api.get(`${BASE}/reconciliation-entries`, { params: { page, limit } }).then(r => r.data);
export const createReconciliationEntry = (data: any) =>
  api.post(`${BASE}/reconciliation-entries`, data).then(r => r.data);
export const updateReconciliationEntry = (id: string, data: any) =>
  api.put(`${BASE}/reconciliation-entries/${id}`, data).then(r => r.data);
export const deleteReconciliationEntry = (id: string) =>
  api.delete(`${BASE}/reconciliation-entries/${id}`).then(r => r.data);

// ─── Bounce Records ──────────────────────────────────────
export const listBounceRecords = (page = 1, limit = 20) =>
  api.get(`${BASE}/bounce-records`, { params: { page, limit } }).then(r => r.data);
export const createBounceRecord = (data: any) =>
  api.post(`${BASE}/bounce-records`, data).then(r => r.data);
export const updateBounceRecord = (id: string, data: any) =>
  api.put(`${BASE}/bounce-records/${id}`, data).then(r => r.data);
export const deleteBounceRecord = (id: string) =>
  api.delete(`${BASE}/bounce-records/${id}`).then(r => r.data);
