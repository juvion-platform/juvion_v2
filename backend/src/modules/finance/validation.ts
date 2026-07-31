import { z } from 'zod';

// ═══ Fee Configuration ════════════════════════════════════

export const createFeeStructureSchema = z.object({
  academicYearId: z.string().min(1),
  programmeId: z.string().min(1),
  branchId: z.string().optional(),
  category: z.string().optional(),
  // Quota is now admin-managed via the FeeQuota CRUD
  // (/api/finance/fee-quotas), so the validator must accept any
  // catalog code — not a hardcoded subset. Same string-equality
  // contract fee-pin-service relies on.
  quota: z.string().optional(),
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

/**
 * `totalPaid`, `totalWaived`, `totalRefunded` and `balance` are derived: the
 * payment pipeline maintains them with $inc (see fee-lifecycle-service
 * recordPayment / reversePayment). Accepting them from a client lets a stray
 * form write silently desync an account from its transactions, so they are
 * rejected here rather than merely hidden in the UI.
 * `totalDue` is the assessed amount and remains caller-supplied at creation.
 */
export const createStudentFeeAccountSchema = z.object({
  studentId: z.string().min(1),
  totalDue: z.number().min(0).optional(),
  lastPaymentDate: z.string().optional(),
}).strict();
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
  // 007 — the invoice this payment settles. When present, createPayment applies the
  // amount to that invoice and decrements StudentFeeAccount.balance.
  invoiceId: z.string().min(1).optional(),
  collectedBy: z.string().optional(),
  remarks: z.string().optional(),
  // NOTE (007): `status` is deliberately NOT accepted. Counter/manual capture is always
  // money-in-hand → the model default 'success' is the only reachable value. Allowing a
  // client to set status (esp. via PUT) would desync AR with no reversal. See T7/§4.3a.
});
// 007 — standalone .strict() schema, NOT createPaymentSchema.partial(). A partial would
// still accept amount/invoiceId/status on PUT, and updatePayment does a raw
// findOneAndUpdate with no recompute → AR desync. Only non-financial fields are editable;
// corrections go through delete-and-reenter (deletePayment reverses the balance).
export const updatePaymentSchema = z.object({
  remarks: z.string().optional(),
  transactionRef: z.string().optional(),
}).strict();

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
  // Admin-managed via FeeQuota CRUD — see createFeeStructureSchema.
  quota: z.string().optional(),
  // Optional year-of-study axis (1–8). Absent = wildcard across years.
  // The model + matcher already support it; it was previously unreachable
  // because this schema stripped it before it reached the service.
  yearOfStudy: z.number().int().min(1).max(8).optional(),
  totalAmount: z.number().min(0).optional(),
});

// Edit a DRAFT (or revision_required) FSI. All fields optional. The
// wildcardable axes accept null to explicitly clear them back to
// "any". academicYearId/programmeId are required refs so they may be
// changed but not cleared. Enforcement of the draft-only rule lives in
// the service.
export const updateFeeStructureInstanceSchema = z.object({
  academicYearId: z.string().min(1).optional(),
  programmeId: z.string().min(1).optional(),
  branchId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quota: z.string().nullable().optional(),
  yearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
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

// 007 — pin-driven semester-installment billing. `studentIds` omitted = bill every
// active pinned student; `yearOfStudy` narrows; `dryRun` previews without writing.
export const generateFeeBillsSchema = z.object({
  semesterId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).optional(),
  yearOfStudy: z.number().int().min(1).max(8).optional(),
  dryRun: z.boolean().optional(),
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

// ═══ W03 Phase 5: Defaulter Management ═══════════════════════

export const identifyDefaultersSchema = z.object({});

export const processEscalationsSchema = z.object({});

export const computeDistressScoreSchema = z.object({});

export const referToWelfareSchema = z.object({});

export const processWelfareOutcomeSchema = z.object({
  outcome: z.enum(['genuine_hardship', 'no_distress', 'inconclusive']),
  m06CaseId: z.string().optional(),
});

export const recommendHoldsSchema = z.object({});

export const applyFinancialHoldSchema = z.object({
  studentId: z.string().min(1),
  defaulterRecordId: z.string().min(1),
  holdType: z.enum(['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block']),
  approvedBy: z.string().min(1),
});

export const releaseFinancialHoldSchema = z.object({
  reason: z.string().min(1),
});

export const resolveDefaulterSchema = z.object({
  resolutionType: z.enum(['payment', 'write_off', 'concession', 'other']),
});

export const logPhoneFollowUpSchema = z.object({
  outcome: z.string().min(1),
  notes: z.string().optional(),
});

// ─── DefaulterRecord CRUD ─────────────────────────────────────

export const createDefaulterRecordSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1),
  overdueAmount: z.number().nonnegative(),
  daysOverdue: z.number().int().nonnegative().optional(),
  escalationStage: z.enum(['stage_1', 'stage_2', 'stage_3', 'stage_4', 'welfare_referred', 'resolved', 'exited_hardship', 'exited_write_off']).optional(),
  welfareReferralStatus: z.enum(['none', 'referred', 'returned']).optional(),
  distressScore: z.number().optional(),
  resolutionDate: z.string().optional(),
  resolutionType: z.enum(['payment', 'write_off', 'concession', 'other']).optional(),
});
export const updateDefaulterRecordSchema = createDefaulterRecordSchema.partial();

// ─── EscalationAction CRUD ────────────────────────────────────

export const createEscalationActionSchema = z.object({
  defaulterRecordId: z.string().min(1),
  actionType: z.enum(['sms_reminder', 'whatsapp_parent', 'hold_recommendation', 'phone_call_flag', 'legal_notice_flag', 'welfare_referral']),
  status: z.enum(['scheduled', 'executed', 'cancelled']).optional(),
  executedAt: z.string().optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
});
export const updateEscalationActionSchema = createEscalationActionSchema.partial();

// ─── FinancialHold CRUD ───────────────────────────────────────

export const createFinancialHoldSchema = z.object({
  studentId: z.string().min(1),
  defaulterRecordId: z.string().min(1),
  holdType: z.enum(['exam_debarment', 'hostel_restriction', 'transcript_hold', 'full_clearance_block']),
  approvedBy: z.string().min(1),
  holdStatus: z.enum(['active', 'released']).optional(),
  effectiveDate: z.string().optional(),
  releaseDate: z.string().optional(),
  releasedBy: z.string().optional(),
  releaseReason: z.string().optional(),
});
export const updateFinancialHoldSchema = createFinancialHoldSchema.partial();

// ─── WelfareReferral CRUD ─────────────────────────────────────

export const createWelfareReferralSchema = z.object({
  defaulterRecordId: z.string().min(1),
  studentId: z.string().min(1),
  distressScore: z.number().min(0).max(1),
  referredBy: z.string().min(1),
  referralStatus: z.enum(['referred', 'returned']).optional(),
  outcome: z.enum(['genuine_hardship', 'no_distress', 'inconclusive']).optional(),
  returnedAt: z.string().optional(),
  m06CaseId: z.string().optional(),
});
export const updateWelfareReferralSchema = createWelfareReferralSchema.partial();

// ═══ W03 Phase 7: Cross-Module Integration & Events ═════════

export const syncStudentStatusSchema = z.object({
  studentId: z.string().min(1),
});

export const independentHardshipSchema = z.object({
  studentId: z.string().min(1),
  recommendedRelief: z.number().min(0),
  documentation: z.string().optional(),
  referredBy: z.string().min(1),
});

export const initiateGatewayPaymentSchema = z.object({
  studentId: z.string().min(1),
  invoiceIds: z.array(z.string().min(1)).min(1),
  returnUrl: z.string().min(1),
});

export const submitTSEPassClaimsSchema = z.object({
  schemeCode: z.string().min(1),
  academicYearId: z.string().min(1),
});

export const triggerReminderSequenceSchema = z.object({
  defaulterRecordId: z.string().min(1),
});

// ═══ W03 Fee Lifecycle Schemas ══════════════════════════════
export const cloneFeeStructureSchema_wf = z.object({ priorYearId: z.string().min(1), newAcademicYearId: z.string().min(1), inflationRate: z.number().optional() });
export const approveFeeStructureSchema = z.object({ approvedBy: z.string().min(1) });
export const evaluateFeeRulesSchema_wf = z.object({ programmeId: z.string().min(1), quota: z.string().min(1), category: z.string().optional(), isHosteler: z.boolean().optional(), transportRequired: z.boolean().optional() });
export const generateSemesterInvoiceSchema = z.object({ studentId: z.string().min(1), semesterId: z.string().min(1), feeStructureInstanceId: z.string().min(1) });
export const generateBatchInvoicesSchema = z.object({ semesterId: z.string().min(1), academicYearId: z.string().min(1), feeStructureInstanceId: z.string().min(1) });
export const generateExamFeeInvoiceSchema = z.object({ studentId: z.string().min(1), semesterId: z.string().min(1), examType: z.string().min(1) });
export const adjustInvoiceSchema_wf = z.object({ reason: z.string().min(1), adjustments: z.array(z.object({ lineItemId: z.string(), newAmount: z.number() })).min(1) });
export const disputeInvoiceSchema_wf = z.object({ reason: z.string().min(1) });
export const writeOffInvoiceSchema_wf = z.object({ reason: z.string().min(1), approvedBy: z.string().min(1) });
export const recordOnlinePaymentSchema = z.object({ invoiceId: z.string().min(1), amount: z.number().min(0), gatewayTransactionId: z.string().min(1), gatewayName: z.string().min(1), paymentMode: z.string().min(1) });
export const recordCounterPaymentSchema_wf = z.object({ studentId: z.string().min(1), invoiceId: z.string().min(1), amount: z.number().min(0), mode: z.enum(['cash', 'dd', 'cheque']), ddNumber: z.string().optional(), ddBank: z.string().optional(), ddDate: z.string().optional() });
export const importBankStatementSchema_wf = z.object({ entries: z.array(z.object({ reference: z.string(), amount: z.number(), date: z.string(), narration: z.string() })).min(1) });
export const matchPaymentSchema = z.object({ invoiceId: z.string().min(1) });
export const handleBounceSchema = z.object({ reason: z.string().min(1) });
export const cancelReceiptSchema_wf = z.object({ reason: z.string().min(1) });
export const runReconciliationSchema = z.object({ periodFrom: z.string().min(1), periodTo: z.string().min(1) });
export const resolveDiscrepancySchema = z.object({ resolution: z.string().min(1), resolvedBy: z.string().min(1) });
export const requestRefundSchema = z.object({ invoiceId: z.string().min(1), studentId: z.string().min(1), amount: z.number().min(0), reason: z.string().min(1), sourceType: z.string().min(1) });
export const approveRefundSchema_wf = z.object({ approvedBy: z.string().min(1) });
export const verifyScholarshipSchema = z.object({ studentId: z.string().min(1), schemeCode: z.string().min(1) });
export const submitClaimBatchSchema = z.object({ eligibilityIds: z.array(z.string()).min(1) });
export const processDisbursementSchema = z.object({ amount: z.number().min(0), bankReference: z.string().min(1) });
export const applyHardshipConcessionSchema = z.object({ studentId: z.string().min(1), amount: z.number().min(0), reason: z.string().min(1), feeComponentId: z.string().optional(), approvedBy: z.string().min(1) });
export const applyMeritScholarshipSchema = z.object({ studentId: z.string().min(1), amount: z.number().min(0), academicYearId: z.string().min(1) });
export const renewScholarshipSchema = z.object({ studentId: z.string().min(1), newAcademicYearId: z.string().min(1) });
export const identifyDefaultersSchema_wf = z.object({ asOfDate: z.string().optional() });
export const escalateDefaulterSchema = z.object({ stage: z.string().min(1) });
export const referToWelfareSchema_wf = z.object({ distressScore: z.number(), signals: z.record(z.any()).optional() });
export const applyHoldSchema = z.object({ studentId: z.string().min(1), holdType: z.string().min(1), reason: z.string().min(1), appliedBy: z.string().min(1) });
export const releaseHoldSchema = z.object({ releasedBy: z.string().min(1), reason: z.string().min(1) });
export const scheduleVendorPaymentSchema = z.object({ paymentRequestId: z.string().min(1), scheduledDate: z.string().min(1), approvedBy: z.string().min(1) });
export const confirmVendorPaymentSchema = z.object({ bankReference: z.string().min(1) });
export const generateRevenueReportSchema = z.object({ academicYearId: z.string().min(1) });

// ═══ Fee Configuration (Task 12) ═════════════════════════════
// Pin management, component template, audit endpoints.

const feePinReasonEnum = z.enum([
  'initial',
  'branch_change',
  'quota_change',
  'programme_transfer',
  'admin_override',
  'data_correction',
  'year_back_carryforward',
]);

export const feePinRePinSchema = z.object({
  yearOfStudy: z.number().int().min(1).max(8),
  targetFeeStructureInstanceId: z.string().min(1),
  reason: feePinReasonEnum,
  remarks: z.string().optional(),
});

export const bulkPinSchema = z.object({
  studentIds: z.array(z.string().min(1)).optional(),
  filter: z.object({
    programmeId: z.string().min(1).optional(),
    branchId: z.string().min(1).optional(),
    quota: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
  }).optional(),
  academicYearId: z.string().min(1).optional(),
  dryRun: z.boolean().optional(),
});

export const commitmentSheetRegenerateSchema = z.object({
  pinId: z.string().min(1).optional(),
});

export const programmeTransferSchema = z.object({
  newProgrammeId: z.string().min(1),
  newBranchId: z.string().min(1).optional(),
  newRegulationId: z.string().min(1).optional(),
  effectiveYearOfStudy: z.number().int().min(1).max(8),
  academicYearId: z.string().min(1),
  reason: z.string().min(1),
  remarks: z.string().optional(),
});

const feeComponentTemplateCategoryEnum = z.enum([
  'academic',
  'admission_oneoff',
  'lab',
  'infrastructure',
  'student_life',
  'regulatory',
  'caution',
  'conditional',
]);

export const feeComponentCreateSchema = z.object({
  componentKey: z.string().min(1),
  displayLabel: z.string().min(1),
  category: feeComponentTemplateCategoryEnum,
  isRefundable: z.boolean().optional(),
  defaultOneTime: z.boolean().optional(),
  applicableToYears: z.array(z.number().int().min(1).max(8)).optional(),
  displayOrder: z.number().int().optional(),
});

export const feeComponentUpdateSchema = z.object({
  displayLabel: z.string().min(1).optional(),
  category: feeComponentTemplateCategoryEnum.optional(),
  isRefundable: z.boolean().optional(),
  defaultOneTime: z.boolean().optional(),
  applicableToYears: z.array(z.number().int().min(1).max(8)).optional(),
  displayOrder: z.number().int().optional(),
});

export const feeComponentTemplateListQuerySchema = z.object({
  category: feeComponentTemplateCategoryEnum.optional(),
  applicableToYear: z.coerce.number().int().min(1).max(8).optional(),
});

export const pinAuditQuerySchema = z.object({
  collegeId: z.string().optional(),
});

// ═══ Fee Analytics & Alerts (Task 8) ══════════════════════════
// Spec: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.8

/**
 * Normalize a query-string value that may come through as a string or
 * (when repeated like `?programmeIds=a&programmeIds=b`) as a string[].
 * Returns `string[] | undefined`. Empty strings are dropped.
 */
const stringOrStringArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const arr = Array.isArray(v) ? v : [v];
    const cleaned = arr.map((s) => String(s).trim()).filter((s) => s.length > 0);
    return cleaned.length === 0 ? undefined : cleaned;
  });

export const dashboardQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  programmeIds: stringOrStringArray,
  branchIds: stringOrStringArray,
  batchIds: stringOrStringArray,
  academicYearId: z.string().optional(),
});

export const defaultersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['overdueAmount', 'daysOverdue']).optional(),
});

export const holdsListQuerySchema = z.object({
  status: z.enum(['pending_approval', 'active', 'released']).optional(),
  studentId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const waiveHoldSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required'),
});

export const pauseEscalationSchema = z.object({
  pausedUntil: z.coerce.date(),
});

// ═══ Fee Category ═══════════════════════════════════════════════
// Per-college reservation-category catalog (OC, OBC, SC, ST, NRI, …).
// Drives the `Category` dropdown on FeeStructure forms; stored in
// `FeeStructure.category` as the string `code` (not an ObjectId) so the
// fee-pin-service category-matching contract stays string-equality.

const feeCategoryStatusEnum = z.enum(['active', 'inactive']);

export const createFeeCategorySchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  status: feeCategoryStatusEnum.optional(),
});

export const updateFeeCategorySchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: feeCategoryStatusEnum.optional(),
});

// Per-college admission-quota catalog (convener, management, nri, …).
// Drives the Quota dropdown on FeeStructure + Student forms; stored in
// `Student.quota` and `FeeStructureInstance.quota` as the string `code`
// (not an ObjectId) so the fee-pin-service quota-matching contract
// stays string-equality.

const feeQuotaStatusEnum = z.enum(['active', 'inactive']);

export const createFeeQuotaSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  status: feeQuotaStatusEnum.optional(),
});

export const updateFeeQuotaSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: feeQuotaStatusEnum.optional(),
});

export const feeQuotaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: feeQuotaStatusEnum.optional(),
});

export const feeCategoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: feeCategoryStatusEnum.optional(),
});
