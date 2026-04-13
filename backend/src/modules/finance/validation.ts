import { z } from 'zod';

// ═══ Fee Configuration ════════════════════════════════════

export const createFeeStructureSchema = z.object({
  academicYearId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().optional(),
  category: z.string().optional(),
  quota: z.enum(['convener', 'management', 'nri']).optional(),
  year: z.number().int().min(1),
  components: z.array(z.object({
    name: z.string().min(1),
    amount: z.number().min(0),
    isRefundable: z.boolean().optional(),
  })),
  totalAmount: z.number().min(0),
});
export const updateFeeStructureSchema = createFeeStructureSchema.partial();

// ═══ Student Fee Account ══════════════════════════════════

export const createStudentFeeAccountSchema = z.object({
  studentId: z.string().min(1),
  totalDue: z.number().min(0).optional(),
  totalPaid: z.number().min(0).optional(),
  totalWaived: z.number().min(0).optional(),
  totalRefunded: z.number().min(0).optional(),
  balance: z.number().optional(),
  lastPaymentDate: z.string().optional(),
});
export const updateStudentFeeAccountSchema = createStudentFeeAccountSchema.partial();

// ═══ Fee Line Items ═══════════════════════════════════════

export const createFeeLineItemSchema = z.object({
  studentId: z.string().min(1),
  feeStructureId: z.string().optional(),
  component: z.string().min(1),
  academicYearId: z.string().min(1),
  semester: z.number().int().optional(),
  amount: z.number().min(0),
  paidAmount: z.number().min(0).optional(),
  waivedAmount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'partial', 'paid', 'overdue', 'waived']).optional(),
});
export const updateFeeLineItemSchema = createFeeLineItemSchema.partial();

// ═══ Payments ═════════════════════════════════════════════

export const createPaymentSchema = z.object({
  studentId: z.string().min(1),
  receiptNumber: z.string().min(1).optional(),
  amount: z.number().min(0),
  paymentMode: z.enum(['cash', 'cheque', 'dd', 'online', 'upi', 'neft', 'rtgs', 'card']),
  transactionRef: z.string().optional(),
  paymentDate: z.string().optional(),
  allocations: z.array(z.object({
    lineItemId: z.string().min(1),
    amount: z.number().min(0),
  })).optional(),
  status: z.enum(['success', 'pending', 'failed', 'reversed']).optional(),
  collectedBy: z.string().optional(),
  remarks: z.string().optional(),
});
export const updatePaymentSchema = createPaymentSchema.partial();

// ═══ Scholarships ═════════════════════════════════════════

export const createScholarshipSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(['government', 'institutional', 'private', 'corporate']),
  type: z.enum(['merit', 'need_based', 'sports', 'sc_st', 'bc', 'minority', 'ebc']),
  amount: z.number().min(0),
  criteria: z.string().optional(),
  academicYearId: z.string().min(1),
  maxRecipients: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateScholarshipSchema = createScholarshipSchema.partial();

// ═══ Scholarship Allocations ══════════════════════════════

export const createScholarshipAllocationSchema = z.object({
  scholarshipId: z.string().min(1),
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  amount: z.number().min(0),
  status: z.enum(['applied', 'approved', 'disbursed', 'rejected']).optional(),
  disbursedDate: z.string().optional(),
});
export const updateScholarshipAllocationSchema = createScholarshipAllocationSchema.partial();

// ═══ Concessions ══════════════════════════════════════════

export const createConcessionSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(['sibling', 'staff_ward', 'merit', 'financial_hardship', 'sports', 'other']),
  percentage: z.number().min(0).max(100).optional(),
  flatAmount: z.number().min(0).optional(),
  reason: z.string().min(1),
  approvedBy: z.string().optional(),
  academicYearId: z.string().min(1),
  status: z.enum(['requested', 'approved', 'rejected']).optional(),
});
export const updateConcessionSchema = createConcessionSchema.partial();

// ═══ Refunds ══════════════════════════════════════════════

export const createRefundSchema = z.object({
  studentId: z.string().min(1),
  paymentId: z.string().optional(),
  amount: z.number().min(0),
  reason: z.string().min(1),
  refundMode: z.enum(['cash', 'cheque', 'online', 'neft']),
  status: z.enum(['requested', 'approved', 'processed', 'rejected']).optional(),
  approvedBy: z.string().optional(),
  processedDate: z.string().optional(),
});
export const updateRefundSchema = createRefundSchema.partial();

// ═══ Fines & Penalties ════════════════════════════════════

export const createFinePenaltySchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(['late_fee', 'library', 'disciplinary', 'damage', 'other']),
  reason: z.string().min(1),
  amount: z.number().min(0),
  dueDate: z.string().min(1),
  paidAmount: z.number().min(0).optional(),
  status: z.enum(['pending', 'partial', 'paid', 'waived']).optional(),
  imposedBy: z.string().optional(),
});
export const updateFinePenaltySchema = createFinePenaltySchema.partial();

// ═══ Invoices ═════════════════════════════════════════════

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  studentId: z.string().optional(),
  type: z.enum(['fee', 'hostel', 'transport', 'other']),
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().min(0),
  })).optional(),
  totalAmount: z.number().min(0),
  dueDate: z.string().min(1),
  status: z.enum(['draft', 'issued', 'paid', 'overdue', 'cancelled']).optional(),
  issuedDate: z.string().optional(),
});
export const updateInvoiceSchema = createInvoiceSchema.partial();

// ═══ Budget ═══════════════════════════════════════════════

export const createBudgetSchema = z.object({
  academicYearId: z.string().min(1),
  departmentId: z.string().optional(),
  category: z.string().min(1),
  allocatedAmount: z.number().min(0),
  spentAmount: z.number().min(0).optional(),
  status: z.enum(['draft', 'approved', 'active', 'closed']).optional(),
});
export const updateBudgetSchema = createBudgetSchema.partial();

// ═══ Expenses ═════════════════════════════════════════════

export const createExpenseSchema = z.object({
  budgetId: z.string().optional(),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().min(0),
  vendorName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  paidDate: z.string().optional(),
  status: z.enum(['submitted', 'approved', 'paid', 'rejected']).optional(),
  approvedBy: z.string().optional(),
});
export const updateExpenseSchema = createExpenseSchema.partial();

// ═══ Financial Ledger ═════════════════════════════════════

export const createFinancialLedgerSchema = z.object({
  entryDate: z.string().min(1),
  entryType: z.enum(['income', 'expense', 'transfer', 'adjustment']),
  category: z.string().min(1),
  description: z.string().min(1),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  balance: z.number().optional(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
});
export const updateFinancialLedgerSchema = createFinancialLedgerSchema.partial();

// ═══ Payment Gateway Log ══════════════════════════════════

export const createPaymentGatewayLogSchema = z.object({
  studentId: z.string().min(1),
  orderId: z.string().min(1),
  gateway: z.enum(['razorpay', 'paytm', 'ccavenue', 'hdfc']),
  amount: z.number().min(0),
  currency: z.string().optional(),
  status: z.enum(['initiated', 'success', 'failed', 'refunded']).optional(),
  gatewayResponse: z.any().optional(),
  initiatedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export const updatePaymentGatewayLogSchema = createPaymentGatewayLogSchema.partial();

// ═══ Fee Reminders ════════════════════════════════════════

export const createFeeReminderSchema = z.object({
  studentId: z.string().min(1),
  lineItemId: z.string().optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'app']),
  dueAmount: z.number().min(0),
  status: z.enum(['sent', 'delivered', 'failed']).optional(),
});
export const updateFeeReminderSchema = createFeeReminderSchema.partial();

// ═══ Financial Reports ════════════════════════════════════

export const createFinancialReportSchema = z.object({
  reportType: z.enum(['collection_summary', 'defaulter_list', 'scholarship_report', 'budget_utilization', 'income_expense']),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  generatedBy: z.string().min(1),
  data: z.any().optional(),
});
export const updateFinancialReportSchema = createFinancialReportSchema.partial();

// ═══ W03: Fee Structure Instance ═════════════════════════════

export const createFeeStructureInstanceSchema = z.object({
  academicYearId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().optional(),
  category: z.string().optional(),
  quota: z.enum(['management', 'convener', 'nri', 'spot', 'lateral']).optional(),
  totalAmount: z.number().min(0).optional(),
});

export const cloneFeeStructureSchema = z.object({
  sourceInstanceId: z.string().min(1),
  newAcademicYearId: z.string().min(1),
});

export const rejectFeeStructureSchema = z.object({
  comments: z.string().min(1),
});

// ═══ W03: Fee Component ══════════════════════════════════════

export const createFeeComponentSchema = z.object({
  feeStructureInstanceId: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().min(0),
  isRefundable: z.boolean().optional(),
  componentType: z.enum(['tuition', 'hostel', 'transport', 'lab', 'exam', 'library', 'development', 'caution_deposit', 'other']),
  isConditional: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});
export const updateFeeComponentSchema = createFeeComponentSchema.partial();

// ═══ W03: Fee Component Rule ═════════════════════════════════

export const createFeeComponentRuleSchema = z.object({
  feeComponentId: z.string().min(1),
  conditionType: z.enum(['hostel', 'transport', 'lab_programme', 'quota', 'category', 'regulation', 'batch']),
  conditionValue: z.string().min(1),
  operator: z.enum(['equals', 'in', 'not_in', 'exists', 'not_exists']),
  status: z.enum(['configured', 'draft']).optional(),
});
export const updateFeeComponentRuleSchema = createFeeComponentRuleSchema.partial();

// ═══ W03: Fee Rules Engine ═══════════════════════════════════

export const evaluateFeeRulesSchema = z.object({
  feeStructureInstanceId: z.string().min(1),
  studentProfile: z.object({
    programmeId: z.string().optional(),
    branchId: z.string().optional(),
    regulationId: z.string().optional(),
    quota: z.string().optional(),
    category: z.string().optional(),
    isHosteler: z.boolean().optional(),
    hasTransport: z.boolean().optional(),
    labProgramme: z.boolean().optional(),
    batchId: z.string().optional(),
  }),
});

export const testFeeRulesSchema = z.object({
  feeStructureInstanceId: z.string().min(1),
  profiles: z.array(z.object({
    programmeId: z.string().optional(),
    branchId: z.string().optional(),
    regulationId: z.string().optional(),
    quota: z.string().optional(),
    category: z.string().optional(),
    isHosteler: z.boolean().optional(),
    hasTransport: z.boolean().optional(),
    labProgramme: z.boolean().optional(),
    batchId: z.string().optional(),
  })),
});
