import mongoose from 'mongoose';
import { Invoice } from '../../models/finance/Invoice';
import { PaymentTransaction } from '../../models/finance/PaymentTransaction';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { ScholarshipEligibility } from '../../models/finance/ScholarshipEligibility';
import { ScholarshipReceivable } from '../../models/finance/ScholarshipReceivable';
import { ScholarshipCredit } from '../../models/finance/ScholarshipCredit';
import { PaymentPlan } from '../../models/finance/PaymentPlan';
import { PaymentGatewayLog } from '../../models/finance/PaymentGatewayLog';
import { JuviNoticeCard } from '../../models/juvi/JuviNoticeCard';
import { InferenceLog } from '../../models/platform/InferenceLog';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';

// ---------------------------------------------------------------------------
// 1. Fee Status Widget (W03-L2-063)
// ---------------------------------------------------------------------------

export async function getFeeStatusWidget(collegeId: string, studentId: string) {
  // Fetch invoices for the student that are not draft/cancelled, ordered by newest
  const invoices = await Invoice.find({
    collegeId,
    studentId,
    status: { $nin: ['draft', 'cancelled'] },
  })
    .sort({ issuedDate: -1 })
    .lean();

  // Compute totals from invoices
  const totalFees = invoices.reduce(
    (sum, inv) => sum + (inv.netPayable ?? inv.totalAmount),
    0,
  );

  // Get total paid from PaymentTransaction
  const paidAgg = await PaymentTransaction.aggregate([
    { $match: { collegeId: new mongoose.Types.ObjectId(collegeId), studentId: new mongoose.Types.ObjectId(studentId) } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);
  const totalPaid = paidAgg[0]?.totalPaid ?? 0;

  // Get total scholarship credits
  const scholarshipAgg = await ScholarshipCredit.aggregate([
    { $match: { collegeId: new mongoose.Types.ObjectId(collegeId), studentId: new mongoose.Types.ObjectId(studentId) } },
    { $group: { _id: null, totalScholarship: { $sum: '$amount' } } },
  ]);
  const totalScholarship = scholarshipAgg[0]?.totalScholarship ?? 0;

  const balanceDue = totalFees - totalPaid - totalScholarship;

  // Active payment plan — next installment
  const activePlan = await PaymentPlan.findOne({
    collegeId,
    studentId,
    status: 'active',
  }).lean();

  let nextDueDate: Date | undefined;
  let nextDueAmount: number | undefined;

  if (activePlan) {
    const nextInstallment = activePlan.installments.find(
      (inst) => inst.status === 'pending',
    );
    if (nextInstallment) {
      nextDueDate = nextInstallment.dueDate;
      nextDueAmount = nextInstallment.amount;
    }
  }

  // Active defaulter record
  const activeDefaulter = await DefaulterRecord.findOne({
    collegeId,
    studentId,
    escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
  }).lean();

  // Active financial holds
  const activeHolds = await FinancialHold.find({
    collegeId,
    studentId,
    holdStatus: 'active',
  }).lean();

  const holdTypes = activeHolds.map((h) => h.holdType);

  // Determine fee status
  let feeStatus: 'clear' | 'partial' | 'overdue' | 'pending';
  const hasOverdue = invoices.some((inv) => inv.status === 'overdue');

  if (balanceDue <= 0) {
    feeStatus = 'clear';
  } else if (hasOverdue) {
    feeStatus = 'overdue';
  } else if (totalPaid > 0) {
    feeStatus = 'partial';
  } else {
    feeStatus = 'pending';
  }

  // Recent payments (last 5)
  const recentTxns = await PaymentTransaction.find({
    collegeId,
    studentId,
  })
    .sort({ paymentDate: -1 })
    .limit(5)
    .lean();

  const recentPayments = recentTxns.map((txn) => ({
    amount: txn.amount,
    date: txn.paymentDate,
    channel: txn.channel,
  }));

  return {
    totalFees,
    totalPaid,
    totalScholarship,
    balanceDue,
    feeStatus,
    nextDueDate,
    nextDueAmount,
    hasHold: activeHolds.length > 0,
    holdTypes,
    isDefaulter: !!activeDefaulter,
    escalationStage: activeDefaulter?.escalationStage,
    recentPayments,
  };
}

// ---------------------------------------------------------------------------
// 2. Push Fee Notices (W03-L2-064)
// ---------------------------------------------------------------------------

type FeeEventType =
  | 'invoice_generated'
  | 'payment_received'
  | 'due_date_approaching'
  | 'overdue_warning'
  | 'scholarship_credited'
  | 'hold_applied'
  | 'hold_released';

interface FeeEventData {
  amount?: number;
  dueDate?: string;
  receiptNumber?: string;
  daysOverdue?: number;
  holdType?: string;
}

function buildFeeNotice(eventType: FeeEventType, eventData: FeeEventData) {
  let title: string;
  let body: string;
  let priority: 'high' | 'medium' | 'low';

  switch (eventType) {
    case 'invoice_generated':
      title = 'New Fee Invoice';
      body = `Your fee invoice for \u20B9${eventData.amount ?? 0} has been generated. Due: ${eventData.dueDate ?? 'N/A'}`;
      priority = 'low';
      break;
    case 'payment_received':
      title = 'Payment Confirmed';
      body = `Your payment of \u20B9${eventData.amount ?? 0} has been received. Receipt: ${eventData.receiptNumber ?? 'N/A'}`;
      priority = 'low';
      break;
    case 'due_date_approaching':
      title = 'Payment Due Soon';
      body = `Your fee payment of \u20B9${eventData.amount ?? 0} is due on ${eventData.dueDate ?? 'N/A'}. Pay now to avoid late fees.`;
      priority = 'medium';
      break;
    case 'overdue_warning':
      title = 'Payment Overdue';
      body = `Your fee payment of \u20B9${eventData.amount ?? 0} is overdue by ${eventData.daysOverdue ?? 0} days. Please pay immediately.`;
      priority = 'high';
      break;
    case 'scholarship_credited':
      title = 'Scholarship Applied';
      body = `A scholarship of \u20B9${eventData.amount ?? 0} has been applied to your account.`;
      priority = 'low';
      break;
    case 'hold_applied':
      title = 'Financial Hold Applied';
      body = `A financial hold (${eventData.holdType ?? 'unknown'}) has been placed on your account due to pending fees.`;
      priority = 'high';
      break;
    case 'hold_released':
      title = 'Financial Hold Removed';
      body = 'The financial hold on your account has been removed.';
      priority = 'low';
      break;
  }

  return { title, body, priority };
}

export async function pushFeeNotices(
  collegeId: string,
  studentId: string,
  eventType: FeeEventType,
  eventData: FeeEventData,
  _performedBy: string,
) {
  const { title, body, priority } = buildFeeNotice(eventType, eventData);

  const card = await JuviNoticeCard.create({
    collegeId,
    title,
    body,
    noticeType: 'general',
    targetAudience: 'individual',
    targetIds: [new mongoose.Types.ObjectId(studentId)],
    publishedAt: new Date(),
    isActive: true,
    createdBy: new mongoose.Types.ObjectId(_performedBy),
  });

  await createAuditLog({
    collegeId,
    entityType: 'JuviNoticeCard',
    entityId: String(card._id),
    entityName: `Fee notice: ${title}`,
    action: 'create',
    changes: [
      { field: 'eventType', displayName: 'Event Type', oldValue: null, newValue: eventType },
      { field: 'priority', displayName: 'Priority', oldValue: null, newValue: priority },
    ],
    performedBy: _performedBy,
    studentId,
  });

  return card;
}

// ---------------------------------------------------------------------------
// 3. Handle Fee Query (W03-L2-065)
// ---------------------------------------------------------------------------

type FeeQueryIntent =
  | 'balance_inquiry'
  | 'payment_history'
  | 'scholarship_info'
  | 'due_date'
  | 'payment_plan'
  | 'hold_status'
  | 'general';

function detectFeeQueryIntent(query: string): FeeQueryIntent {
  const q = query.toLowerCase();

  if (/balance|how much|total fees|pending/.test(q)) return 'balance_inquiry';
  if (/payment|paid|receipt|transaction/.test(q)) return 'payment_history';
  if (/scholarship|concession|discount/.test(q)) return 'scholarship_info';
  if (/due date|when|deadline/.test(q)) return 'due_date';
  if (/plan|installment|emi/.test(q)) return 'payment_plan';
  if (/hold|block|debarment/.test(q)) return 'hold_status';

  return 'general';
}

async function handleBalanceInquiry(collegeId: string, studentId: string) {
  const invoices = await Invoice.find({
    collegeId,
    studentId,
    status: { $nin: ['draft', 'cancelled'] },
  }).lean();

  const totalFees = invoices.reduce(
    (sum, inv) => sum + (inv.netPayable ?? inv.totalAmount),
    0,
  );

  const paidAgg = await PaymentTransaction.aggregate([
    { $match: { collegeId: new mongoose.Types.ObjectId(collegeId), studentId: new mongoose.Types.ObjectId(studentId) } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);
  const totalPaid = paidAgg[0]?.totalPaid ?? 0;

  const scholarshipAgg = await ScholarshipCredit.aggregate([
    { $match: { collegeId: new mongoose.Types.ObjectId(collegeId), studentId: new mongoose.Types.ObjectId(studentId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalScholarship = scholarshipAgg[0]?.total ?? 0;

  const balance = totalFees - totalPaid - totalScholarship;

  return {
    response: `Your total fees are \u20B9${totalFees.toLocaleString('en-IN')}. You have paid \u20B9${totalPaid.toLocaleString('en-IN')} with \u20B9${totalScholarship.toLocaleString('en-IN')} in scholarships applied. Your current balance is \u20B9${balance.toLocaleString('en-IN')}.`,
    data: { totalFees, totalPaid, totalScholarship, balance } as Record<string, unknown>,
    suggestedActions: balance > 0
      ? ['Pay Now', 'View Payment Plan', 'Contact Finance Office']
      : ['View Payment History', 'Download Receipt'],
  };
}

async function handlePaymentHistory(collegeId: string, studentId: string) {
  const transactions = await PaymentTransaction.find({
    collegeId,
    studentId,
  })
    .sort({ paymentDate: -1 })
    .limit(10)
    .lean();

  if (transactions.length === 0) {
    return {
      response: 'No payment transactions found for your account.',
      data: { transactions: [] } as Record<string, unknown>,
      suggestedActions: ['Pay Now', 'View Fee Balance'],
    };
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const latestDate = transactions[0]?.paymentDate;

  return {
    response: `You have ${transactions.length} recent payment(s) totalling \u20B9${total.toLocaleString('en-IN')}. Your last payment was on ${latestDate ? new Date(latestDate).toLocaleDateString('en-IN') : 'N/A'}.`,
    data: {
      transactions: transactions.map((t) => ({
        amount: t.amount,
        date: t.paymentDate,
        channel: t.channel,
        ref: t.transactionRef,
      })),
    } as Record<string, unknown>,
    suggestedActions: ['Download Receipt', 'View Fee Balance'],
  };
}

async function handleScholarshipInfo(collegeId: string, studentId: string) {
  const [eligibilities, credits] = await Promise.all([
    ScholarshipEligibility.find({ collegeId, studentId }).lean(),
    ScholarshipCredit.find({ collegeId, studentId }).lean(),
  ]);

  const totalCredited = credits.reduce((sum, c) => sum + c.amount, 0);
  const eligibleCount = eligibilities.filter((e) => e.status === 'eligible').length;

  return {
    response: `You have ${eligibleCount} eligible scholarship(s). Total scholarship amount credited: \u20B9${totalCredited.toLocaleString('en-IN')}.`,
    data: {
      eligibilities: eligibilities.map((e) => ({
        schemeCode: e.schemeCode,
        status: e.status,
      })),
      totalCredited,
      creditCount: credits.length,
    } as Record<string, unknown>,
    suggestedActions: ['View Scholarship Details', 'Check Eligibility Status'],
  };
}

async function handleDueDate(collegeId: string, studentId: string) {
  const nextInvoice = await Invoice.findOne({
    collegeId,
    studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'confirmed'] },
  })
    .sort({ dueDate: 1 })
    .lean();

  if (!nextInvoice) {
    return {
      response: 'You have no upcoming fee due dates.',
      data: {} as Record<string, unknown>,
      suggestedActions: ['View Fee Balance', 'View Payment History'],
    };
  }

  const dueDate = new Date(nextInvoice.dueDate).toLocaleDateString('en-IN');
  const amount = nextInvoice.netPayable ?? nextInvoice.totalAmount;

  return {
    response: `Your next fee payment of \u20B9${amount.toLocaleString('en-IN')} is due on ${dueDate}.`,
    data: {
      invoiceId: String(nextInvoice._id),
      dueDate: nextInvoice.dueDate,
      amount,
      invoiceNumber: nextInvoice.invoiceNumber,
    } as Record<string, unknown>,
    suggestedActions: ['Pay Now', 'View Payment Plan'],
  };
}

async function handlePaymentPlanQuery(collegeId: string, studentId: string) {
  const plan = await PaymentPlan.findOne({
    collegeId,
    studentId,
    status: 'active',
  }).lean();

  if (!plan) {
    return {
      response: 'You do not have an active payment plan.',
      data: {} as Record<string, unknown>,
      suggestedActions: ['Request Payment Plan', 'View Fee Balance'],
    };
  }

  const pendingInstallments = plan.installments.filter(
    (inst) => inst.status === 'pending',
  );
  const paidInstallments = plan.installments.filter(
    (inst) => inst.status === 'paid',
  );
  const nextInstallment = pendingInstallments[0];

  return {
    response: `Your payment plan has ${plan.installments.length} installments (${paidInstallments.length} paid, ${pendingInstallments.length} remaining). ${nextInstallment ? `Next installment of \u20B9${nextInstallment.amount.toLocaleString('en-IN')} is due on ${new Date(nextInstallment.dueDate).toLocaleDateString('en-IN')}.` : 'All installments are paid.'}`,
    data: {
      planId: String(plan._id),
      totalAmount: plan.totalAmount,
      installments: plan.installments.map((inst) => ({
        dueDate: inst.dueDate,
        amount: inst.amount,
        status: inst.status,
      })),
    } as Record<string, unknown>,
    suggestedActions: nextInstallment
      ? ['Pay Installment', 'View Full Plan']
      : ['View Fee Balance'],
  };
}

async function handleHoldStatus(collegeId: string, studentId: string) {
  const holds = await FinancialHold.find({
    collegeId,
    studentId,
    holdStatus: 'active',
  }).lean();

  if (holds.length === 0) {
    return {
      response: 'You have no active financial holds on your account.',
      data: { holds: [] } as Record<string, unknown>,
      suggestedActions: ['View Fee Balance'],
    };
  }

  const holdTypes = holds.map((h) => h.holdType).join(', ');

  return {
    response: `You have ${holds.length} active financial hold(s): ${holdTypes}. Please clear your pending fees to get them released.`,
    data: {
      holds: holds.map((h) => ({
        holdType: h.holdType,
        effectiveDate: h.effectiveDate,
      })),
    } as Record<string, unknown>,
    suggestedActions: ['Pay Now', 'Contact Finance Office'],
  };
}

export async function handleFeeQuery(
  collegeId: string,
  studentId: string,
  query: string,
) {
  const startTime = Date.now();
  const intent = detectFeeQueryIntent(query);

  let result: {
    response: string;
    data: Record<string, unknown>;
    suggestedActions: string[];
  };

  switch (intent) {
    case 'balance_inquiry':
      result = await handleBalanceInquiry(collegeId, studentId);
      break;
    case 'payment_history':
      result = await handlePaymentHistory(collegeId, studentId);
      break;
    case 'scholarship_info':
      result = await handleScholarshipInfo(collegeId, studentId);
      break;
    case 'due_date':
      result = await handleDueDate(collegeId, studentId);
      break;
    case 'payment_plan':
      result = await handlePaymentPlanQuery(collegeId, studentId);
      break;
    case 'hold_status':
      result = await handleHoldStatus(collegeId, studentId);
      break;
    case 'general':
    default:
      result = await handleBalanceInquiry(collegeId, studentId);
      break;
  }

  const latencyMs = Date.now() - startTime;

  // Log to InferenceLog
  await InferenceLog.create({
    collegeId,
    agentId: 'AG-03',
    agentName: 'Juvi Finance Companion',
    inputData: { studentId, query, intent },
    outputData: { response: result.response, suggestedActions: result.suggestedActions },
    status: 'success',
    latencyMs,
    startedAt: new Date(startTime),
    completedAt: new Date(),
  });

  return {
    intent,
    response: result.response,
    data: result.data,
    suggestedActions: result.suggestedActions,
  };
}

// ---------------------------------------------------------------------------
// 4. Process Juvi Payment (W03-L2-066)
// ---------------------------------------------------------------------------

export async function processJuviPayment(
  collegeId: string,
  studentId: string,
  data: { invoiceIds: string[]; returnUrl?: string },
  performedBy: string,
) {
  if (!data.invoiceIds || data.invoiceIds.length === 0) {
    throw new AppError(400, 'At least one invoice must be selected');
  }

  // Validate all invoiceIds belong to the student and are not already paid/cancelled
  const invoices = await Invoice.find({
    _id: { $in: data.invoiceIds },
    collegeId,
    studentId,
  }).lean();

  if (invoices.length !== data.invoiceIds.length) {
    throw new AppError(400, 'One or more invoices not found or do not belong to this student');
  }

  const invalidInvoices = invoices.filter(
    (inv) => inv.status === 'paid' || inv.status === 'cancelled',
  );
  if (invalidInvoices.length > 0) {
    throw new AppError(400, 'One or more invoices are already paid or cancelled');
  }

  // Calculate total amount
  const totalAmount = invoices.reduce(
    (sum, inv) => sum + (inv.netPayable ?? inv.totalAmount),
    0,
  );

  // Generate idempotency key
  const idempotencyKey = new mongoose.Types.ObjectId().toString();

  // Create PaymentGatewayLog
  const log = await PaymentGatewayLog.create({
    collegeId,
    studentId,
    orderId: idempotencyKey,
    gateway: 'razorpay',
    amount: totalAmount,
    currency: 'INR',
    status: 'initiated',
    invoiceId: invoices[0]?._id,
    idempotencyKey,
    initiatedAt: new Date(),
  });

  const gatewayUrl = `${data.returnUrl || '/payment'}?order=${String(log._id)}`;

  // Audit log the initiation
  await createAuditLog({
    collegeId,
    entityType: 'PaymentGatewayLog',
    entityId: String(log._id),
    entityName: `Payment initiation for ${data.invoiceIds.length} invoice(s)`,
    action: 'create',
    changes: [
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: totalAmount },
      { field: 'invoiceIds', displayName: 'Invoice IDs', oldValue: null, newValue: data.invoiceIds.join(', ') },
    ],
    performedBy,
    studentId,
  });

  return {
    orderId: String(log._id),
    amount: totalAmount,
    invoiceCount: data.invoiceIds.length,
    gatewayUrl,
  };
}

// ---------------------------------------------------------------------------
// 5. Predict Default Risk (W03-L2-059 AG-03)
// ---------------------------------------------------------------------------

export async function predictDefaultRisk(collegeId: string, studentId: string) {
  const startTime = Date.now();

  const [invoices, transactions, defaulterRecords, scholarshipReceivables, activePlan] =
    await Promise.all([
      Invoice.find({
        collegeId,
        studentId,
        status: { $nin: ['draft', 'cancelled'] },
      }).lean(),
      PaymentTransaction.find({ collegeId, studentId })
        .sort({ paymentDate: -1 })
        .lean(),
      DefaulterRecord.find({ collegeId, studentId }).lean(),
      ScholarshipReceivable.find({
        collegeId,
        studentId,
        status: 'pending',
      }).lean(),
      PaymentPlan.findOne({ collegeId, studentId, status: 'active' }).lean(),
    ]);

  // Signal 1: Has overdue invoice
  const hasOverdueInvoice = invoices.some((inv) => inv.status === 'overdue');

  // Signal 2: Average payment delay (days between dueDate and payment date)
  // Match transactions to invoices to compute delays
  const invoiceMap = new Map<string, Date>();
  for (const inv of invoices) {
    invoiceMap.set(String(inv._id), inv.dueDate);
  }

  const delays: number[] = [];
  for (const txn of transactions) {
    const dueDate = invoiceMap.get(String(txn.invoiceId));
    if (dueDate) {
      const delayMs = txn.paymentDate.getTime() - new Date(dueDate).getTime();
      const delayDays = delayMs / (1000 * 60 * 60 * 24);
      delays.push(delayDays);
    }
  }
  // Use last ~4 semesters worth of data, approximate with last 8 transactions
  const recentDelays = delays.slice(0, 8);
  const avgPaymentDelay =
    recentDelays.length > 0
      ? recentDelays.reduce((sum, d) => sum + d, 0) / recentDelays.length
      : 0;

  // Signal 3: Prior default count
  const priorDefaultCount = defaulterRecords.filter(
    (d) => d.escalationStage === 'resolved' || d.escalationStage === 'exited_hardship' || d.escalationStage === 'exited_write_off',
  ).length;

  // Signal 4: Scholarship pending
  const scholarshipPending = scholarshipReceivables.length > 0;

  // Signal 5: Has active payment plan
  const paymentPlanActive = !!activePlan;

  // Compute risk score (0-1)
  // hasOverdue: 0.3
  const overdueScore = hasOverdueInvoice ? 0.3 : 0;

  // avgDelay normalized: 0.25 (normalize: clamp delay to 0-90 days, then scale)
  const normalizedDelay = Math.min(Math.max(avgPaymentDelay, 0), 90) / 90;
  const delayScore = normalizedDelay * 0.25;

  // priorDefault: 0.15 (each prior default adds weight, capped)
  const defaultScore = Math.min(priorDefaultCount, 3) / 3 * 0.15;

  // scholarshipPending: 0.15
  const scholarshipScore = scholarshipPending ? 0.15 : 0;

  // !paymentPlan: 0.15 (no plan = higher risk)
  const planScore = paymentPlanActive ? 0 : 0.15;

  const riskScore = Math.round((overdueScore + delayScore + defaultScore + scholarshipScore + planScore) * 100) / 100;

  let riskLevel: 'high' | 'medium' | 'low';
  if (riskScore > 0.7) {
    riskLevel = 'high';
  } else if (riskScore > 0.4) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Build recommendations
  const recommendations: string[] = [];
  if (hasOverdueInvoice) {
    recommendations.push('Clear overdue invoices immediately to avoid escalation');
  }
  if (avgPaymentDelay > 15) {
    recommendations.push('Set up auto-debit or reminders to improve payment timeliness');
  }
  if (priorDefaultCount > 0) {
    recommendations.push('Student has prior default history — consider proactive outreach');
  }
  if (scholarshipPending) {
    recommendations.push('Follow up on pending scholarship disbursement');
  }
  if (!paymentPlanActive && riskScore > 0.4) {
    recommendations.push('Suggest setting up a payment plan to ease fee burden');
  }
  if (recommendations.length === 0) {
    recommendations.push('No immediate risk factors detected');
  }

  const latencyMs = Date.now() - startTime;

  // Log to InferenceLog
  await InferenceLog.create({
    collegeId,
    agentId: 'AG-03',
    agentName: 'Juvi Finance Risk Predictor',
    inputData: { studentId },
    outputData: { riskScore, riskLevel, recommendations },
    status: 'success',
    latencyMs,
    startedAt: new Date(startTime),
    completedAt: new Date(),
  });

  return {
    riskScore,
    riskLevel,
    signals: {
      hasOverdueInvoice,
      avgPaymentDelay: Math.round(avgPaymentDelay * 100) / 100,
      priorDefaultCount,
      scholarshipPending,
      paymentPlanActive,
    },
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// 6. Detect Revenue Anomaly (W03-L2-059 AG-03)
// ---------------------------------------------------------------------------

export async function detectRevenueAnomaly(
  collegeId: string,
  _academicYearId?: string,
) {
  const startTime = Date.now();

  // Get monthly collection totals for last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyAgg = await PaymentTransaction.aggregate([
    {
      $match: {
        collegeId: new mongoose.Types.ObjectId(collegeId),
        paymentDate: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$paymentDate' },
          month: { $month: '$paymentDate' },
        },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Build monthly collections array
  const monthlyCollections: { month: string; amount: number; isAnomaly: boolean }[] = [];
  const amounts: number[] = [];

  for (const entry of monthlyAgg) {
    const yearVal = entry._id?.year as number | undefined;
    const monthVal = entry._id?.month as number | undefined;
    if (yearVal == null || monthVal == null) continue;
    const monthStr = `${yearVal}-${String(monthVal).padStart(2, '0')}`;
    const amount = entry.amount as number;
    monthlyCollections.push({ month: monthStr, amount, isAnomaly: false });
    amounts.push(amount);
  }

  // Compute mean and standard deviation
  const n = amounts.length;
  let mean = 0;
  let stdDev = 0;

  if (n > 0) {
    mean = amounts.reduce((sum, a) => sum + a, 0) / n;

    if (n > 1) {
      const variance = amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / n;
      stdDev = Math.sqrt(variance);
    }
  }

  // Flag anomalies: deviation > 2 standard deviations from mean
  let anomalyCount = 0;
  const alerts: string[] = [];

  for (const mc of monthlyCollections) {
    if (stdDev > 0 && Math.abs(mc.amount - mean) > 2 * stdDev) {
      mc.isAnomaly = true;
      anomalyCount++;
      const direction = mc.amount > mean ? 'above' : 'below';
      alerts.push(
        `${mc.month}: Collection of \u20B9${mc.amount.toLocaleString('en-IN')} is significantly ${direction} average (\u20B9${Math.round(mean).toLocaleString('en-IN')})`,
      );
    }
  }

  // Check current month vs same month last year
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastYearMonthStr = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonth = monthlyCollections.find((mc) => mc.month === currentMonthStr);
  const lastYearSameMonth = monthlyCollections.find((mc) => mc.month === lastYearMonthStr);

  if (currentMonth && lastYearSameMonth && lastYearSameMonth.amount > 0) {
    const yoyChange = ((currentMonth.amount - lastYearSameMonth.amount) / lastYearSameMonth.amount) * 100;
    if (Math.abs(yoyChange) > 30) {
      const direction = yoyChange > 0 ? 'increase' : 'decrease';
      alerts.push(
        `Year-over-year ${direction} of ${Math.abs(Math.round(yoyChange))}% for ${currentMonthStr} compared to ${lastYearMonthStr}`,
      );
    }
  }

  const latencyMs = Date.now() - startTime;

  // Log to InferenceLog
  await InferenceLog.create({
    collegeId,
    agentId: 'AG-03',
    agentName: 'Juvi Revenue Anomaly Detector',
    inputData: { academicYearId: _academicYearId ?? 'all', monthsAnalyzed: n },
    outputData: { anomalyCount, mean: Math.round(mean), stdDev: Math.round(stdDev) },
    status: 'success',
    latencyMs,
    startedAt: new Date(startTime),
    completedAt: new Date(),
  });

  return {
    monthlyCollections,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    anomalyCount,
    alerts,
  };
}
