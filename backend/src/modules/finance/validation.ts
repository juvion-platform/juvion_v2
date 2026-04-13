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

// ═══ W03: Billing — Invoice Batch Generation ═════════════════

export const generateSemesterInvoiceBatchSchema = z.object({
  semesterId: z.string().min(1),
  academicYearId: z.string().min(1),
});

export const generateEnrolmentInvoiceSchema = z.object({
  studentId: z.string().min(1),
  feeStructureInstanceId: z.string().min(1),
  firstPaymentAmount: z.number().min(0).optional(),
});

export const generateExamFeeInvoiceBatchSchema = z.object({
  semesterId: z.string().min(1),
  examType: z.string().min(1),
  feeAmount: z.number().min(0),
  studentIds: z.array(z.string().min(1)),
});

export const generateAdHocInvoiceSchema = z.object({
  studentId: z.string().min(1),
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().min(0),
  })),
  dueDate: z.string().min(1),
  description: z.string().optional(),
});

// ═══ W03: Billing — Invoice Actions ══════════════════════════

export const adjustInvoiceSchema = z.object({
  adjustments: z.array(z.object({
    lineItemId: z.string().min(1),
    newAmount: z.number().min(0),
    reason: z.string().min(1),
  })),
  reason: z.string().min(1),
});

export const disputeInvoiceSchema = z.object({
  disputeReason: z.string().min(1),
});

export const writeOffInvoiceSchema = z.object({
  approvedBy: z.string().min(1),
  reason: z.string().min(1),
});

export const detectSiblingDiscountSchema = z.object({
  academicYearId: z.string().min(1),
});

// ═══ W03: Fee Agreement ══════════════════════════════════════

export const createFeeAgreementSchema = z.object({
  studentId: z.string().min(1),
  feeStructureInstanceId: z.string().min(1),
  negotiatedTotal: z.number().min(0),
  baseTotal: z.number().min(0),
  waiverAmount: z.number().min(0).optional(),
  approvalAuthority: z.string().min(1),
  concessionDetails: z.string().optional(),
  validityPeriodYears: z.number().int().min(1).optional(),
});
export const updateFeeAgreementSchema = createFeeAgreementSchema.partial();

// ═══ W03: Payment Plan ═══════════════════════════════════════

export const createPaymentPlanSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  feeAgreementId: z.string().optional(),
  templateId: z.string().optional(),
  totalAmount: z.number().min(0),
  installments: z.array(z.object({
    dueDate: z.string().min(1),
    amount: z.number().min(0),
    status: z.enum(['pending', 'paid', 'overdue']).optional(),
  })),
});
export const updatePaymentPlanSchema = createPaymentPlanSchema.partial();

// ═══ W03: Invoice Line Item ══════════════════════════════════

export const createInvoiceLineItemSchema = z.object({
  invoiceId: z.string().min(1),
  feeComponentId: z.string().optional(),
  description: z.string().min(1),
  grossAmount: z.number().min(0),
  scholarshipAllocated: z.number().min(0).optional(),
  concessionApplied: z.number().min(0).optional(),
  netAmount: z.number().min(0),
});
export const updateInvoiceLineItemSchema = createInvoiceLineItemSchema.partial();

// ═══ W03: Payment Collection ═════════════════════════════════

export const processGatewayWebhookSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().min(0),
  transactionRef: z.string().min(1),
  gatewayResponse: z.any().optional(),
});

export const recordCounterPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  studentId: z.string().min(1),
  amount: z.number().min(0),
  paymentMode: z.enum(['cash', 'dd']),
  ddNumber: z.string().optional(),
  ddBank: z.string().optional(),
  ddDate: z.string().optional(),
  collectedBy: z.string().min(1),
});

export const importBankStatementSchema = z.object({
  entries: z.array(z.object({
    bankRef: z.string().min(1),
    amount: z.number().min(0),
    senderName: z.string().optional(),
    creditDate: z.string().min(1),
  })),
});

export const manualMatchPaymentSchema = z.object({
  invoiceId: z.string().min(1),
});

// ═══ W03: Receipt Management ═════════════════════════════════

export const reissueReceiptSchema = z.object({
  channel: z.enum(['email', 'print', 'whatsapp']).optional(),
});

// ═══ W03: Bounce & Overpayment ═══════════════════════════════

export const recordPaymentBounceSchema = z.object({
  reason: z.string().min(1),
  penaltyAmount: z.number().min(0).optional(),
});

export const resolveOverpaymentSchema = z.object({
  resolution: z.enum(['refund', 'credit_forward']),
});

export const executeRefundSchema = z.object({
  refundTransactionRef: z.string().min(1),
});

// ═══ W03: PaymentTransaction CRUD ════════════════════════════

export const createPaymentTransactionSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: z.number().min(0),
  channel: z.enum(['gateway', 'cash', 'dd', 'neft', 'rtgs', 'upi', 'card']),
  paymentMode: z.string().min(1),
  transactionRef: z.string().optional(),
  reconciliationStatus: z.enum(['initiated', 'received', 'matched', 'discrepancy', 'resolved', 'reversed', 'refunded']).optional(),
  gatewayOrderId: z.string().optional(),
  ddNumber: z.string().optional(),
  ddBank: z.string().optional(),
  ddDate: z.string().optional(),
});
export const updatePaymentTransactionSchema = createPaymentTransactionSchema.partial();

// ═══ W03: Receipt CRUD ═══════════════════════════════════════

export const createReceiptSchema = z.object({
  receiptNumber: z.string().min(1),
  paymentTransactionId: z.string().min(1),
  studentId: z.string().min(1),
  amount: z.number().min(0),
  channel: z.enum(['email', 'print', 'whatsapp']).optional(),
});
export const updateReceiptSchema = createReceiptSchema.partial();

// ═══ W03: ReconciliationEntry CRUD ═══════════════════════════

export const createReconciliationEntrySchema = z.object({
  paymentTransactionId: z.string().min(1),
  bankStatementRef: z.string().optional(),
  matchedAmount: z.number().min(0),
  status: z.enum(['matched', 'discrepancy_flagged', 'resolved']).optional(),
  discrepancyType: z.string().optional(),
  discrepancyAmount: z.number().optional(),
  notes: z.string().optional(),
});
export const updateReconciliationEntrySchema = createReconciliationEntrySchema.partial();

// ═══ W03: BounceRecord CRUD ══════════════════════════════════

export const createBounceRecordSchema = z.object({
  paymentTransactionId: z.string().min(1),
  invoiceId: z.string().min(1),
  reason: z.string().min(1),
  penaltyAmount: z.number().min(0).optional(),
});
export const updateBounceRecordSchema = createBounceRecordSchema.partial();

// ═══ W03: OverpaymentRecord CRUD ═════════════════════════════

export const createOverpaymentRecordSchema = z.object({
  studentId: z.string().min(1),
  paymentTransactionId: z.string().min(1),
  invoiceId: z.string().min(1),
  overpaymentAmount: z.number().min(0),
  resolution: z.enum(['refund', 'credit_forward', 'pending']).optional(),
});
export const updateOverpaymentRecordSchema = createOverpaymentRecordSchema.partial();

// ═══ W03 Phase 4: Scholarship & Concession Workflow Schemas ══════════════════

export const verifyScholarshipEligibilityBatchSchema = z.object({
  academicYearId: z.string().min(1),
});

export const submitScholarshipClaimsBatchSchema = z.object({
  schemeCode: z.string().min(1),
  academicYearId: z.string().min(1),
});

export const pollScholarshipClaimStatusSchema = z.object({
  academicYearId: z.string().min(1),
});

export const processScholarshipDisbursementSchema = z.object({
  scholarshipClaimId: z.string().min(1),
  disbursedAmount: z.number().positive(),
});

export const processHardshipConcessionSchema = z.object({
  studentId: z.string().min(1),
  recommendedRelief: z.number().positive(),
  welfareReferralId: z.string().optional(),
  approvedBy: z.string().min(1),
});

export const applyMeritScholarshipBatchSchema = z.object({
  academicYearId: z.string().min(1),
  minCGPA: z.number().min(0).max(10),
  amount: z.number().positive(),
  maxRecipients: z.number().int().positive(),
});

export const detectStaffWardConcessionSchema = z.object({
  academicYearId: z.string().min(1),
});

export const renewScholarshipsBatchSchema = z.object({
  academicYearId: z.string().min(1),
});

// ═══ ScholarshipEligibility CRUD ═════════════════════════════

export const createScholarshipEligibilitySchema = z.object({
  studentId: z.string().min(1),
  schemeCode: z.string().min(1),
  academicYearId: z.string().min(1),
  status: z.enum(['pending', 'eligible', 'ineligible', 'expired']).optional(),
  verificationMethod: z.enum(['auto', 'manual']).optional(),
  verifiedAt: z.string().optional(),
  documentsStatus: z.enum(['complete', 'incomplete', 'expired']).optional(),
});
export const updateScholarshipEligibilitySchema = createScholarshipEligibilitySchema.partial();

// ═══ ScholarshipClaim CRUD ════════════════════════════════════

export const createScholarshipClaimSchema = z.object({
  scholarshipEligibilityId: z.string().min(1),
  studentId: z.string().min(1),
  schemeCode: z.string().min(1),
  academicYearId: z.string().min(1),
  claimAmount: z.number().positive(),
  portalReference: z.string().optional(),
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected']).optional(),
  rejectionReason: z.string().optional(),
});
export const updateScholarshipClaimSchema = createScholarshipClaimSchema.partial();

// ═══ ScholarshipReceivable CRUD ═══════════════════════════════

export const createScholarshipReceivableSchema = z.object({
  scholarshipClaimId: z.string().min(1),
  studentId: z.string().min(1),
  expectedAmount: z.number().positive(),
  expectedDisbursementDate: z.string().optional(),
  status: z.enum(['pending', 'disbursed', 'overdue', 'converted_to_liability']).optional(),
  disbursedAmount: z.number().optional(),
  disbursedAt: z.string().optional(),
});
export const updateScholarshipReceivableSchema = createScholarshipReceivableSchema.partial();

// ═══ ScholarshipCredit CRUD ═══════════════════════════════════

export const createScholarshipCreditSchema = z.object({
  scholarshipReceivableId: z.string().min(1),
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  invoiceLineItemId: z.string().optional(),
  amount: z.number().positive(),
  appliedAt: z.string().optional(),
});
export const updateScholarshipCreditSchema = createScholarshipCreditSchema.partial();
