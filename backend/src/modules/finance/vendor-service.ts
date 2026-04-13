import { PaymentRequest } from '../../models/finance/PaymentRequest';
import { VendorPayment } from '../../models/finance/VendorPayment';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────

function calcExecutionDate(paymentTerms: string): Date {
  const now = new Date();
  if (paymentTerms === 'net_30') {
    now.setDate(now.getDate() + 30);
  } else if (paymentTerms === 'net_15') {
    now.setDate(now.getDate() + 15);
  }
  // 'immediate' or unknown → today
  return now;
}

// ─── W03-L2-047: Receive Payment Request ─────────────────

export interface ReceivePaymentRequestInput {
  vendorId: string;
  invoiceReference: string;
  amount: number;
  costCenter?: string;
  servicePeriod?: string;
  m08ApprovalDate?: Date;
  m08Approver?: string;
}

export async function receivePaymentRequest(
  collegeId: string,
  data: ReceivePaymentRequestInput,
  performedBy: string,
) {
  if (data.amount <= 0) {
    throw new AppError(400, 'Amount must be greater than 0');
  }

  const doc = await PaymentRequest.create({
    ...data,
    collegeId,
    status: 'received',
  });

  await createAuditLog({
    collegeId,
    entityType: 'PaymentRequest',
    entityId: String(doc._id),
    entityName: doc.invoiceReference,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

// ─── W03-L2-048: Schedule Vendor Payment ─────────────────

export async function scheduleVendorPayment(
  collegeId: string,
  paymentRequestId: string,
  paymentTerms: string,
  performedBy: string,
) {
  const request = await PaymentRequest.findOne({ _id: paymentRequestId, collegeId });
  if (!request) throw new AppError(404, 'PaymentRequest not found');
  if (request.status !== 'received') {
    throw new AppError(400, `PaymentRequest status must be 'received', got '${request.status}'`);
  }

  const needsApproval = request.amount > 100000;
  const vpStatus = needsApproval ? 'pending_approval' : 'scheduled';
  const executionDate = calcExecutionDate(paymentTerms);

  const vendorPayment = await VendorPayment.create({
    collegeId,
    paymentRequestId: request._id,
    vendorId: request.vendorId,
    amount: request.amount,
    paymentTerms,
    executionDate,
    status: vpStatus,
  });

  request.status = 'scheduled';
  await request.save();

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(vendorPayment._id),
    entityName: String(vendorPayment._id),
    action: 'create',
    changes: [],
    performedBy,
  });

  return {
    vendorPaymentId: String(vendorPayment._id),
    needsApproval,
    executionDate,
  };
}

// ─── Threshold Approval ───────────────────────────────────

export async function approveVendorPayment(
  collegeId: string,
  vendorPaymentId: string,
  performedBy: string,
) {
  const payment = await VendorPayment.findOne({ _id: vendorPaymentId, collegeId });
  if (!payment) throw new AppError(404, 'VendorPayment not found');
  if (payment.status !== 'pending_approval') {
    throw new AppError(400, `VendorPayment status must be 'pending_approval', got '${payment.status}'`);
  }

  payment.status = 'approved';
  await payment.save();

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(payment._id),
    entityName: String(payment._id),
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'pending_approval', newValue: 'approved' }],
    performedBy,
  });

  return payment;
}

// ─── W03-L2-049: Execute Vendor Payment Batch ─────────────

export async function executeVendorPaymentBatch(
  collegeId: string,
  performedBy: string,
) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const duePayments = await VendorPayment.find({
    collegeId,
    status: { $in: ['scheduled', 'approved'] },
    executionDate: { $lte: today },
  });

  if (duePayments.length === 0) {
    return { batchId: null, executed: 0, totalAmount: 0 };
  }

  const batchId = `VBATCH-${Date.now()}`;
  let totalAmount = 0;
  const paymentRequestIds: string[] = [];

  for (const vp of duePayments) {
    vp.status = 'executed';
    vp.batchId = batchId;
    await vp.save();
    totalAmount += vp.amount;
    paymentRequestIds.push(String(vp.paymentRequestId));
  }

  await PaymentRequest.updateMany(
    { _id: { $in: paymentRequestIds }, collegeId },
    { $set: { status: 'executed' } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'VendorPaymentBatch',
    entityId: batchId,
    entityName: batchId,
    action: 'create',
    changes: [
      { field: 'executed', displayName: 'Executed Count', oldValue: 0, newValue: duePayments.length },
      { field: 'totalAmount', displayName: 'Total Amount', oldValue: 0, newValue: totalAmount },
    ],
    performedBy,
  });

  return { batchId, executed: duePayments.length, totalAmount };
}

// ─── W03-L2-050: Confirm Vendor Payment ──────────────────

export async function confirmVendorPayment(
  collegeId: string,
  vendorPaymentId: string,
  bankReference: string,
  performedBy: string,
) {
  const payment = await VendorPayment.findOne({ _id: vendorPaymentId, collegeId });
  if (!payment) throw new AppError(404, 'VendorPayment not found');
  if (payment.status !== 'executed') {
    throw new AppError(400, `VendorPayment status must be 'executed', got '${payment.status}'`);
  }

  payment.status = 'bank_confirmed';
  payment.bankReference = bankReference;
  await payment.save();

  await PaymentRequest.updateOne(
    { _id: payment.paymentRequestId, collegeId },
    { $set: { status: 'confirmed' } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(payment._id),
    entityName: String(payment._id),
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'executed', newValue: 'bank_confirmed' },
      { field: 'bankReference', displayName: 'Bank Reference', oldValue: '', newValue: bankReference },
    ],
    performedBy,
  });

  return payment;
}

// ─── Standard CRUD: PaymentRequest ───────────────────────

export async function listPaymentRequests(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter['status'] = status;
  return paginate(PaymentRequest, filter, page, limit);
}

export async function getPaymentRequest(collegeId: string, id: string) {
  const doc = await PaymentRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'PaymentRequest not found');
  return doc;
}

export async function createPaymentRequest(
  collegeId: string,
  data: ReceivePaymentRequestInput,
  performedBy: string,
) {
  return receivePaymentRequest(collegeId, data, performedBy);
}

export async function updatePaymentRequest(
  collegeId: string,
  id: string,
  data: Partial<ReceivePaymentRequestInput>,
  performedBy: string,
) {
  const doc = await PaymentRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'PaymentRequest not found');

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentRequest',
    entityId: String(doc._id),
    entityName: doc.invoiceReference,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deletePaymentRequest(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await PaymentRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'PaymentRequest not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentRequest',
    entityId: id,
    entityName: doc.invoiceReference,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return { deleted: true };
}

// ─── Standard CRUD: VendorPayment ────────────────────────

export async function listVendorPayments(
  collegeId: string,
  page = 1,
  limit = 20,
  status?: string,
) {
  const filter: Record<string, unknown> = { collegeId };
  if (status) filter['status'] = status;
  return paginate(VendorPayment, filter, page, limit);
}

export async function getVendorPayment(collegeId: string, id: string) {
  const doc = await VendorPayment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'VendorPayment not found');
  return doc;
}

export interface CreateVendorPaymentInput {
  paymentRequestId: string;
  vendorId: string;
  amount: number;
  paymentTerms?: string;
  executionDate?: Date;
}

export async function createVendorPaymentDirect(
  collegeId: string,
  data: CreateVendorPaymentInput,
  performedBy: string,
) {
  if (data.amount <= 0) {
    throw new AppError(400, 'Amount must be greater than 0');
  }

  const doc = await VendorPayment.create({ ...data, collegeId, status: 'scheduled' });

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(doc._id),
    entityName: String(doc._id),
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function updateVendorPaymentDirect(
  collegeId: string,
  id: string,
  data: Partial<CreateVendorPaymentInput>,
  performedBy: string,
) {
  const doc = await VendorPayment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'VendorPayment not found');

  Object.assign(doc, data);
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(doc._id),
    entityName: String(doc._id),
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function deleteVendorPayment(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await VendorPayment.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'VendorPayment not found');

  await doc.deleteOne();

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: id,
    entityName: id,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return { deleted: true };
}
