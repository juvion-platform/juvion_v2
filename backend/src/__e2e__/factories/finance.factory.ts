import { FeeStructure, FeeLineItem, Payment } from '../../models';

let paymentCounter = 0;

export async function createTestFeeStructure(collegeId: string, opts: {
  academicYearId: string;
  programmeId: string;
  branchId?: string;
  year?: number;
  components?: { name: string; amount: number; isRefundable: boolean }[];
}) {
  const components = opts.components ?? [
    { name: 'Tuition', amount: 50000, isRefundable: false },
    { name: 'Lab Fee', amount: 10000, isRefundable: false },
  ];
  const totalAmount = components.reduce((sum, c) => sum + c.amount, 0);

  return FeeStructure.create({
    collegeId,
    academicYearId: opts.academicYearId,
    programmeId: opts.programmeId,
    branchId: opts.branchId,
    year: opts.year ?? 1,
    components,
    totalAmount,
  });
}

export async function createTestFeeLineItem(collegeId: string, opts: {
  studentId: string;
  academicYearId: string;
  component: string;
  amount: number;
  feeStructureId?: string;
  dueDate?: string;
}) {
  return FeeLineItem.create({
    collegeId,
    studentId: opts.studentId,
    feeStructureId: opts.feeStructureId,
    component: opts.component,
    academicYearId: opts.academicYearId,
    amount: opts.amount,
    paidAmount: 0,
    waivedAmount: 0,
    dueDate: opts.dueDate ? new Date(opts.dueDate) : undefined,
    status: 'pending',
  });
}

export async function createTestPayment(collegeId: string, opts: {
  studentId: string;
  amount: number;
  lineItemIds?: string[];
  paymentMode?: string;
}) {
  paymentCounter++;
  const allocations = (opts.lineItemIds ?? []).map((id) => ({
    lineItemId: id,
    amount: opts.amount,
  }));

  return Payment.create({
    collegeId,
    studentId: opts.studentId,
    receiptNumber: `RCP-TEST-${String(paymentCounter).padStart(6, '0')}`,
    amount: opts.amount,
    paymentMode: opts.paymentMode ?? 'cash',
    paymentDate: new Date(),
    allocations,
    status: 'success',
  });
}
