import { ActivityBudget } from '../../models/student-dev/ActivityBudget';
import { BudgetLineItem } from '../../models/student-dev/BudgetLineItem';
import { Sponsorship } from '../../models/student-dev/Sponsorship';
import { SponsorContact } from '../../models/student-dev/SponsorContact';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ─── Helper ──────────────────────────────────────────────

function determineApprovalThreshold(amount: number): 'f1' | 'f2' | 'l1' {
  if (amount < 10000) return 'f1';
  if (amount <= 100000) return 'f2';
  return 'l1';
}

// ═══ Activity Budget CRUD + Workflow ═════════════════════

export async function listActivityBudgets(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
  entityType?: string,
) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (entityType) filter.entityType = entityType;
  return paginate(ActivityBudget, filter, page, limit, { createdAt: -1 });
}

export async function getActivityBudget(collegeId: string, id: string) {
  const doc = await ActivityBudget.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Activity budget not found');
  const lineItems = await BudgetLineItem.find({ collegeId, budgetId: doc._id });
  return { ...doc.toObject(), lineItems };
}

export async function requestBudget(
  collegeId: string,
  data: {
    entityType: string;
    entityId?: string;
    academicYearId: string;
    requestedBy: string;
    requestedAmount: number;
    justification?: string;
    lineItems: { category: string; description: string; estimatedAmount: number }[];
  },
  performedBy: string,
) {
  const approvalThreshold = determineApprovalThreshold(data.requestedAmount);

  // AI placeholder — reasonableness score
  const reasonablenessScore = Math.min(
    100,
    Math.max(0, 70 + Math.floor(Math.random() * 30)),
  );

  const budget = await ActivityBudget.create({
    collegeId,
    entityType: data.entityType,
    entityId: data.entityId,
    academicYearId: data.academicYearId,
    requestedBy: data.requestedBy,
    requestedAmount: data.requestedAmount,
    justification: data.justification,
    status: 'requested',
    approvalThreshold,
    reasonablenessScore,
  });

  const lineItemDocs = await BudgetLineItem.insertMany(
    data.lineItems.map((li) => ({
      collegeId,
      budgetId: budget._id,
      category: li.category,
      description: li.description,
      estimatedAmount: li.estimatedAmount,
    })),
  );

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: String(budget._id),
    entityName: `${data.entityType} budget`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return { ...budget.toObject(), lineItems: lineItemDocs };
}

export async function approveBudget(
  collegeId: string,
  budgetId: string,
  data: { approvedBy: string; approvedAmount?: number },
  performedBy: string,
) {
  const budget = await ActivityBudget.findOne({ _id: budgetId, collegeId });
  if (!budget) throw new AppError(404, 'Activity budget not found');
  if (budget.status !== 'requested') {
    throw new AppError(400, 'Budget must be in requested status to approve');
  }

  const approvedAmount = data.approvedAmount ?? budget.requestedAmount;
  budget.approvedAmount = approvedAmount;
  budget.status = 'approved';
  budget.approvedBy = data.approvedBy as any;
  budget.approvalDate = new Date();
  await budget.save();

  // Proportionally reduce line item approved amounts if approved < requested
  const lineItems = await BudgetLineItem.find({ collegeId, budgetId: budget._id });
  if (approvedAmount < budget.requestedAmount && lineItems.length > 0) {
    const ratio = approvedAmount / budget.requestedAmount;
    await Promise.all(
      lineItems.map((li) => {
        li.approvedAmount = Math.round(li.estimatedAmount * ratio * 100) / 100;
        li.status = 'approved';
        return li.save();
      }),
    );
  } else {
    await Promise.all(
      lineItems.map((li) => {
        li.approvedAmount = li.estimatedAmount;
        li.status = 'approved';
        return li.save();
      }),
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: budgetId,
    entityName: `${budget.entityType} budget`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'requested', newValue: 'approved' }],
    performedBy,
  });

  return budget;
}

export async function rejectBudget(
  collegeId: string,
  budgetId: string,
  data: { rejectedReason: string },
  performedBy: string,
) {
  const budget = await ActivityBudget.findOne({ _id: budgetId, collegeId });
  if (!budget) throw new AppError(404, 'Activity budget not found');
  if (budget.status !== 'requested') {
    throw new AppError(400, 'Budget must be in requested status to reject');
  }

  budget.status = 'rejected';
  budget.rejectedReason = data.rejectedReason;
  await budget.save();

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: budgetId,
    entityName: `${budget.entityType} budget`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'requested', newValue: 'rejected' }],
    performedBy,
  });

  return budget;
}

export async function getUtilisation(collegeId: string, budgetId: string) {
  const budget = await ActivityBudget.findOne({ _id: budgetId, collegeId });
  if (!budget) throw new AppError(404, 'Activity budget not found');

  const lineItems = await BudgetLineItem.find({ collegeId, budgetId: budget._id });

  const totalApproved = budget.approvedAmount ?? 0;
  const totalUtilised = budget.utilisedAmount ?? 0;
  const utilisationPercent =
    totalApproved > 0 ? Math.round((totalUtilised / totalApproved) * 10000) / 100 : 0;

  const alerts: string[] = [];
  if (utilisationPercent >= 100) alerts.push('100%_blocked');
  else if (utilisationPercent >= 80) alerts.push('80%_warning');

  return {
    budget,
    lineItems,
    utilisationPercent,
    alerts,
  };
}

export async function recordExpense(
  collegeId: string,
  budgetId: string,
  data: { lineItemId: string; amount: number; transactionRef?: string },
  performedBy: string,
) {
  const budget = await ActivityBudget.findOne({ _id: budgetId, collegeId });
  if (!budget) throw new AppError(404, 'Activity budget not found');
  if (!['approved', 'active'].includes(budget.status)) {
    throw new AppError(400, 'Budget must be approved or active to record expenses');
  }

  if (budget.status === 'approved') {
    budget.status = 'active';
  }

  const lineItem = await BudgetLineItem.findOne({ _id: data.lineItemId, collegeId, budgetId: budget._id });
  if (!lineItem) throw new AppError(404, 'Budget line item not found');

  lineItem.actualAmount = (lineItem.actualAmount ?? 0) + data.amount;
  if (data.transactionRef) {
    lineItem.transactionRefs.push(data.transactionRef);
  }
  lineItem.status = 'spent';
  await lineItem.save();

  // Recompute utilised amount from all line items
  const allLineItems = await BudgetLineItem.find({ collegeId, budgetId: budget._id });
  budget.utilisedAmount = allLineItems.reduce((sum, li) => sum + (li.actualAmount ?? 0), 0);
  await budget.save();

  const warning =
    budget.approvedAmount && budget.utilisedAmount >= budget.approvedAmount
      ? 'Budget fully utilised'
      : undefined;

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: budgetId,
    entityName: `${budget.entityType} budget expense`,
    action: 'update',
    changes: [{ field: 'expense', displayName: 'Expense', oldValue: '', newValue: String(data.amount) }],
    performedBy,
  });

  return { budget, lineItem, warning };
}

export async function reconcileBudget(
  collegeId: string,
  budgetId: string,
  data: { varianceNotes?: string },
  performedBy: string,
) {
  const budget = await ActivityBudget.findOne({ _id: budgetId, collegeId });
  if (!budget) throw new AppError(404, 'Activity budget not found');
  if (budget.status !== 'active') {
    throw new AppError(400, 'Budget must be active to reconcile');
  }

  budget.status = 'reconciled';
  budget.varianceNotes = data.varianceNotes;

  // AI placeholder — reconciliation report
  const planned = budget.approvedAmount ?? budget.requestedAmount;
  const actual = budget.utilisedAmount ?? 0;
  const variance = planned - actual;
  budget.reconciliationReport = `Reconciliation summary: Planned INR ${planned}, Actual INR ${actual}, Variance INR ${variance} (${variance >= 0 ? 'under' : 'over'} budget).`;

  await budget.save();

  // Mark all line items as reconciled
  await BudgetLineItem.updateMany(
    { collegeId, budgetId: budget._id },
    { status: 'reconciled' },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: budgetId,
    entityName: `${budget.entityType} budget`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'active', newValue: 'reconciled' }],
    performedBy,
  });

  return budget;
}

export async function allocateActivityFeePool(
  collegeId: string,
  data: { academicYearId: string; amount: number; allocatedBy: string },
  performedBy: string,
) {
  const budget = await ActivityBudget.create({
    collegeId,
    entityType: 'pool',
    academicYearId: data.academicYearId,
    requestedBy: data.allocatedBy,
    requestedAmount: data.amount,
    approvedAmount: data.amount,
    status: 'approved',
    approvalDate: new Date(),
    approvedBy: data.allocatedBy,
  });

  await createAuditLog({
    collegeId,
    entityType: 'ActivityBudget',
    entityId: String(budget._id),
    entityName: 'Activity fee pool',
    action: 'create',
    changes: [],
    performedBy,
  });

  return budget;
}

// ═══ Budget Line Item CRUD ═══════════════════════════════

export async function listBudgetLineItems(
  collegeId: string,
  budgetId: string,
  page = 1,
  limit = 20,
) {
  const filter: any = { collegeId, budgetId };
  return paginate(BudgetLineItem, filter, page, limit, { createdAt: -1 });
}

export async function getBudgetLineItem(collegeId: string, id: string) {
  const doc = await BudgetLineItem.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Budget line item not found');
  return doc;
}

export async function createBudgetLineItem(collegeId: string, data: any, performedBy: string) {
  const doc = await BudgetLineItem.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'BudgetLineItem',
    entityId: String(doc._id),
    entityName: doc.category,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateBudgetLineItem(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await BudgetLineItem.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Budget line item not found');
  await createAuditLog({
    collegeId,
    entityType: 'BudgetLineItem',
    entityId: id,
    entityName: doc.category,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteBudgetLineItem(collegeId: string, id: string, performedBy: string) {
  const doc = await BudgetLineItem.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Budget line item not found');
  await createAuditLog({
    collegeId,
    entityType: 'BudgetLineItem',
    entityId: id,
    entityName: doc.category,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ Sponsor Contact CRUD ════════════════════════════════

export async function listSponsorContacts(
  collegeId: string,
  page = 1,
  limit = 20,
  company?: string,
) {
  const filter: any = { collegeId };
  if (company) filter.company = company;
  return paginate(SponsorContact, filter, page, limit, { createdAt: -1 });
}

export async function getSponsorContact(collegeId: string, id: string) {
  const doc = await SponsorContact.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Sponsor contact not found');
  return doc;
}

export async function createSponsorContact(collegeId: string, data: any, performedBy: string) {
  const doc = await SponsorContact.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'SponsorContact',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateSponsorContact(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await SponsorContact.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Sponsor contact not found');
  await createAuditLog({
    collegeId,
    entityType: 'SponsorContact',
    entityId: id,
    entityName: doc.name,
    action: 'update',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function deleteSponsorContact(collegeId: string, id: string, performedBy: string) {
  const doc = await SponsorContact.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Sponsor contact not found');
  await createAuditLog({
    collegeId,
    entityType: 'SponsorContact',
    entityId: id,
    entityName: doc.name,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}

// ═══ Sponsorship CRUD + Workflow ═════════════════════════

export async function listSponsorships(
  collegeId: string,
  page = 1,
  limit = 20,
  eventType?: string,
  status?: string,
) {
  const filter: any = { collegeId };
  if (eventType) filter.eventType = eventType;
  if (status) filter.status = status;
  return paginate(Sponsorship, filter, page, limit, { createdAt: -1 }, [
    { path: 'sponsorContactId' },
  ]);
}

export async function getSponsorship(collegeId: string, id: string) {
  const doc = await Sponsorship.findOne({ _id: id, collegeId }).populate('sponsorContactId');
  if (!doc) throw new AppError(404, 'Sponsorship not found');
  return doc;
}

export async function createSponsorship(collegeId: string, data: any, performedBy: string) {
  const doc = await Sponsorship.create({ ...data, collegeId, status: 'prospective' });
  await createAuditLog({
    collegeId,
    entityType: 'Sponsorship',
    entityId: String(doc._id),
    entityName: `${doc.eventType} sponsorship`,
    action: 'create',
    changes: [],
    performedBy,
  });
  return doc;
}

export async function updateSponsorshipStatus(
  collegeId: string,
  sponsorshipId: string,
  data: { status: string; receivedAmount?: number; deliverables?: { description: string; status: string }[] },
  performedBy: string,
) {
  const doc = await Sponsorship.findOne({ _id: sponsorshipId, collegeId });
  if (!doc) throw new AppError(404, 'Sponsorship not found');

  const oldStatus = doc.status;
  doc.status = data.status;

  if (data.status === 'received' && data.receivedAmount !== undefined) {
    doc.receivedAmount = data.receivedAmount;
  }
  if (data.deliverables) {
    doc.deliverables = data.deliverables;
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'Sponsorship',
    entityId: sponsorshipId,
    entityName: `${doc.eventType} sponsorship`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status }],
    performedBy,
  });

  return doc;
}

export async function deleteSponsorship(collegeId: string, id: string, performedBy: string) {
  const doc = await Sponsorship.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Sponsorship not found');
  await createAuditLog({
    collegeId,
    entityType: 'Sponsorship',
    entityId: id,
    entityName: `${doc.eventType} sponsorship`,
    action: 'delete',
    changes: [],
    performedBy,
  });
  return doc;
}
