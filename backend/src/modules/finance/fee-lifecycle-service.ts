import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { FeeComponent } from '../../models/finance/FeeComponent';
import { FeeComponentRule } from '../../models/finance/FeeComponentRule';
import { Invoice } from '../../models/finance/Invoice';
import { InvoiceLineItem } from '../../models/finance/InvoiceLineItem';
import { PaymentTransaction } from '../../models/finance/PaymentTransaction';
import { Receipt } from '../../models/finance/Receipt';
import { ReconciliationEntry } from '../../models/finance/ReconciliationEntry';
import { BounceRecord } from '../../models/finance/BounceRecord';
import { OverpaymentRecord } from '../../models/finance/OverpaymentRecord';
import { Refund } from '../../models/finance/Refund';
import { ScholarshipEligibility } from '../../models/finance/ScholarshipEligibility';
import { ScholarshipClaim } from '../../models/finance/ScholarshipClaim';
import { ScholarshipReceivable } from '../../models/finance/ScholarshipReceivable';
import { ScholarshipCredit } from '../../models/finance/ScholarshipCredit';
import { Concession } from '../../models/finance/Concession';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { emitRiskSignal } from '../welfare/risk-emitters';
import { EscalationAction } from '../../models/finance/EscalationAction';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { WelfareReferral } from '../../models/finance/WelfareReferral';
import { PaymentRequest } from '../../models/finance/PaymentRequest';
import { VendorPayment } from '../../models/finance/VendorPayment';
import { StudentFeeAccount } from '../../models/finance/StudentFeeAccount';
import { RevenueReconciliationReport } from '../../models/finance/RevenueReconciliationReport';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { Student } from '../../models/people/Student';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { FinePenalty } from '../../models/finance/FinePenalty';
import * as feePinService from './fee-pin-service';
import { resolveStudentYearOfStudy } from './resolve-year-of-study';
import { Semester } from '../../models/academic-structure/Semester';
import crypto from 'crypto';

// ─── Helpers ──────────────────────────────────────────────
function generateInvoiceNumber(): string {
  return `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function generateReceiptNumber(): string {
  return `REC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Minimal shape of the FeeStructureInstance fields we rely on at the
 * invoice-generation level — avoids leaking Mongoose document types. */
interface IResolvedInstance {
  _id: unknown;
  collegeId: unknown;
  academicYearId: unknown;
  programmeId: unknown;
  branchId?: unknown;
  category?: string;
  quota?: string;
  status: string;
  totalAmount: number;
}

/**
 * Evaluate applicable fee components for a SPECIFIC FeeStructureInstance
 * (pin-driven invoice generation, Task 10). Mirrors the rule-matching
 * logic of `evaluateFeeComponentRules` but scoped to one instance so we
 * can honour pins on `superseded` instances — which the status-filtered
 * programme-wide evaluator would otherwise drop.
 *
 * Do NOT replace `evaluateFeeComponentRules` with this — the programme-wide
 * evaluator is still used by the no-pin fallback path to preserve pre-Task-10
 * behavior exactly.
 */
async function evaluateRulesForInstance(
  collegeId: string,
  feeStructureInstanceId: string,
  studentProfile: {
    quota: string;
    category?: string;
    isHosteler?: boolean;
    transportRequired?: boolean;
  },
): Promise<Array<{ feeComponentId: string; name: string; amount: number }>> {
  const components = await FeeComponent.find({
    collegeId,
    feeStructureInstanceId,
  }).lean();

  const out: Array<{ feeComponentId: string; name: string; amount: number }> = [];
  for (const comp of components) {
    if (!comp.isConditional) {
      out.push({ feeComponentId: String(comp._id), name: comp.name, amount: comp.amount });
      continue;
    }

    const rules = await FeeComponentRule.find({
      collegeId,
      feeComponentId: comp._id,
      status: 'configured',
    }).lean();

    let applicable = true;
    for (const rule of rules) {
      let matches = false;
      switch (rule.conditionType) {
        case 'hostel':
          matches = rule.operator === 'equals'
            ? String(studentProfile.isHosteler ?? false) === rule.conditionValue
            : true;
          break;
        case 'transport':
          matches = rule.operator === 'equals'
            ? String(studentProfile.transportRequired ?? false) === rule.conditionValue
            : true;
          break;
        case 'quota':
          matches = rule.operator === 'equals'
            ? studentProfile.quota === rule.conditionValue
            : rule.operator === 'in'
              ? rule.conditionValue.split(',').includes(studentProfile.quota)
              : true;
          break;
        case 'category':
          matches = rule.operator === 'equals'
            ? studentProfile.category === rule.conditionValue
            : rule.operator === 'in'
              ? rule.conditionValue.split(',').includes(studentProfile.category ?? '')
              : true;
          break;
        default:
          matches = true;
      }
      if (!matches) {
        applicable = false;
        break;
      }
    }

    if (applicable) {
      out.push({ feeComponentId: String(comp._id), name: comp.name, amount: comp.amount });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// Fee Configuration (4)
// ═══════════════════════════════════════════════════════════

/** 1. Clone a prior year fee structure into a new academic year with optional inflation adjustment. */
export async function cloneFeeStructure(
  collegeId: string,
  data: { priorYearId: string; newAcademicYearId: string; inflationRate?: number },
  performedBy: string,
) {
  const priorInstance = await FeeStructureInstance.findOne({
    _id: data.priorYearId,
    collegeId,
  }).lean();
  if (!priorInstance) throw new AppError(404, 'Prior year fee structure instance not found');

  const inflationRate = data.inflationRate ?? 0;
  const multiplier = 1 + inflationRate / 100;

  const newInstance = await FeeStructureInstance.create({
    collegeId,
    academicYearId: data.newAcademicYearId,
    programmeId: priorInstance.programmeId,
    branchId: priorInstance.branchId,
    category: priorInstance.category,
    quota: priorInstance.quota,
    status: 'draft',
    totalAmount: Math.round(priorInstance.totalAmount * multiplier * 100) / 100,
    priorVersionId: priorInstance._id,
  });

  const priorComponents = await FeeComponent.find({
    collegeId,
    feeStructureInstanceId: data.priorYearId,
  }).lean();

  for (const comp of priorComponents) {
    await FeeComponent.create({
      collegeId,
      feeStructureInstanceId: newInstance._id,
      name: comp.name,
      amount: Math.round(comp.amount * multiplier * 100) / 100,
      isRefundable: comp.isRefundable,
      componentType: comp.componentType,
      isConditional: comp.isConditional,
      displayOrder: comp.displayOrder,
    });
  }

  await createAuditLog({
    collegeId,
    entityType: 'FeeStructureInstance',
    entityId: String(newInstance._id),
    entityName: `Cloned from ${String(priorInstance._id)}`,
    action: 'create',
    changes: [{ field: 'inflationRate', displayName: 'Inflation Rate', oldValue: null, newValue: inflationRate }],
    performedBy,
  });

  return newInstance;
}

/** 2. Submit a fee structure instance for approval. */
export async function submitFeeStructure(
  collegeId: string,
  structureId: string,
  performedBy: string,
) {
  const instance = await FeeStructureInstance.findOne({ _id: structureId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'draft') throw new AppError(400, 'Only draft structures can be submitted');

  const oldStatus = instance.status;
  instance.status = 'submitted';
  await instance.save();

  await createAuditLog({
    collegeId,
    entityType: 'FeeStructureInstance',
    entityId: String(instance._id),
    entityName: `Structure ${String(instance._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'submitted' }],
    performedBy,
  });

  return instance;
}

/** 3. Approve a fee structure instance. */
export async function approveFeeStructure(
  collegeId: string,
  structureId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const instance = await FeeStructureInstance.findOne({ _id: structureId, collegeId });
  if (!instance) throw new AppError(404, 'Fee structure instance not found');
  if (instance.status !== 'submitted') throw new AppError(400, 'Only submitted structures can be approved');

  const oldStatus = instance.status;
  instance.status = 'approved';
  instance.approvedBy = data.approvedBy as any;
  instance.approvedAt = new Date();
  await instance.save();

  await createAuditLog({
    collegeId,
    entityType: 'FeeStructureInstance',
    entityId: String(instance._id),
    entityName: `Structure ${String(instance._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' },
      { field: 'approvedBy', displayName: 'Approved By', oldValue: null, newValue: data.approvedBy },
    ],
    performedBy,
  });

  return instance;
}

/** 4. Evaluate fee component rules against a student profile to determine applicable components. */
export async function evaluateFeeComponentRules(
  collegeId: string,
  studentProfile: {
    programmeId: string;
    quota: string;
    category?: string;
    isHosteler?: boolean;
    transportRequired?: boolean;
  },
) {
  // Find all approved/active fee structure instances for this programme
  const instances = await FeeStructureInstance.find({
    collegeId,
    programmeId: studentProfile.programmeId,
    status: { $in: ['approved', 'active'] },
  }).lean();

  if (instances.length === 0) return [];

  const instanceIds = instances.map((i) => i._id);
  const components = await FeeComponent.find({
    collegeId,
    feeStructureInstanceId: { $in: instanceIds },
  }).lean();

  const applicableComponents: Array<{ feeComponentId: string; name: string; amount: number }> = [];

  for (const comp of components) {
    if (!comp.isConditional) {
      applicableComponents.push({
        feeComponentId: String(comp._id),
        name: comp.name,
        amount: comp.amount,
      });
      continue;
    }

    // Check rules for conditional components
    const rules = await FeeComponentRule.find({
      collegeId,
      feeComponentId: comp._id,
      status: 'configured',
    }).lean();

    let applicable = true;
    for (const rule of rules) {
      let matches = false;
      switch (rule.conditionType) {
        case 'hostel':
          matches = rule.operator === 'equals'
            ? String(studentProfile.isHosteler ?? false) === rule.conditionValue
            : true;
          break;
        case 'transport':
          matches = rule.operator === 'equals'
            ? String(studentProfile.transportRequired ?? false) === rule.conditionValue
            : true;
          break;
        case 'quota':
          matches = rule.operator === 'equals'
            ? studentProfile.quota === rule.conditionValue
            : rule.operator === 'in'
              ? rule.conditionValue.split(',').includes(studentProfile.quota)
              : true;
          break;
        case 'category':
          matches = rule.operator === 'equals'
            ? studentProfile.category === rule.conditionValue
            : rule.operator === 'in'
              ? rule.conditionValue.split(',').includes(studentProfile.category ?? '')
              : true;
          break;
        default:
          matches = true;
      }
      if (!matches) {
        applicable = false;
        break;
      }
    }

    if (applicable) {
      applicableComponents.push({
        feeComponentId: String(comp._id),
        name: comp.name,
        amount: comp.amount,
      });
    }
  }

  return applicableComponents;
}

// ═══════════════════════════════════════════════════════════
// Invoice Generation (6)
// ═══════════════════════════════════════════════════════════

/** 5. Generate a semester invoice for a single student.
 *
 * Pin-first resolution (Task 10, plan §1.6, spec §Journey 8):
 *   1. Determine student's year-of-study for the semester.
 *   2. Read `Student.feePins[]` via `feePinService.resolveActivePin` first.
 *   3. If a pin exists → load THAT FeeStructureInstance + its components +
 *      rules, regardless of the instance's current status (honours Journey 7
 *      superseded-but-pinned behavior).
 *   4. If no pin → fall back to the `data.feeStructureInstanceId` argument
 *      (legacy resolve-at-caller path), log a warning, and lazy-pin the
 *      resolved instance so subsequent invoices are pin-driven.
 *   5. Line items are stamped with `sourcePinId` for the nightly invariant
 *      audit (plan §2.3).
 *
 * Preserved behavior (NOT touched by this task):
 *   - Component-rule evaluation (hostel/transport opt-ins, quota, category)
 *   - Concession stacking, scholarship ledger allocation
 *   - FeeAgreement override (still a no-op at this layer; unchanged)
 *   - Invoice/line-item/StudentFeeAccount writes + audit log
 */
export async function generateSemesterInvoice(
  collegeId: string,
  data: { studentId: string; semesterId: string; feeStructureInstanceId: string },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  // ── Pin-first resolution ──────────────────────────────────────────
  // Year-of-study is derived via the canonical helper (T20 / OQ-11):
  // AY context comes from the Semester.academicYearId tied to this
  // invoice run; the helper loads Student → Batch → Programme math.
  //
  // Fallback: if derivation fails (no batch on student, semester
  // missing, or no matching AY) we degrade to `yearOfStudy = 1`. This
  // is a defensive best-effort to keep invoice generation running for
  // pre-T20 data where batches / batches.academicYear are not yet
  // backfilled — the pin-first lookup still behaves correctly for
  // Year-1-pinned admission students (the common case).
  let yearOfStudy = 1;
  try {
    const sem = await Semester.findOne({ _id: data.semesterId, collegeId })
      .select('academicYearId')
      .lean();
    const academicYearId = sem?.academicYearId
      ? String(sem.academicYearId)
      : undefined;
    const resolved = await resolveStudentYearOfStudy(
      String(student._id),
      academicYearId ? { academicYearId } : {},
    );
    yearOfStudy = resolved.yearOfStudy;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[fee-invoice] year-of-study resolution failed for student=${String(
        student._id,
      )} semester=${data.semesterId}; defaulting to 1. reason=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  let pin = await feePinService.resolveActivePin(data.studentId, yearOfStudy);
  let instance: IResolvedInstance | null = null;

  if (pin) {
    // Pin exists — use it as source of truth (works for 'active' AND
    // 'superseded' instances by design; see spec §Journey 7).
    const pinned = await FeeStructureInstance.findOne({
      _id: pin.feeStructureInstanceId,
      collegeId,
    }).lean();
    if (!pinned) {
      throw new AppError(
        500,
        `Pin references missing FeeStructureInstance ${String(pin.feeStructureInstanceId)}`,
      );
    }
    instance = pinned as unknown as IResolvedInstance;
  } else {
    // No pin — fall back to the legacy caller-supplied instance id.
    console.warn(
      `[fee-invoice] no pin for student ${String(student._id)} year ${yearOfStudy}; falling back to live resolution`,
    );

    const live = await FeeStructureInstance.findOne({
      _id: data.feeStructureInstanceId,
      collegeId,
    }).lean();
    if (!live) throw new AppError(404, 'Fee structure instance not found');
    instance = live as unknown as IResolvedInstance;

    // Lazy-pin: commit the resolved instance as a pin so future
    // invoices read it directly. If this fails (e.g., race with a
    // manual pin) we log and proceed with the already-resolved
    // structure — the next run will retry via the same branch.
    try {
      pin = await feePinService.pinYear(data.studentId, yearOfStudy, {
        pinnedBy: 'system:invoice-lazy',
        reason: 'initial',
        academicYearId: instance.academicYearId as unknown as string,
        enqueueCommitmentSheet: true,
      });
    } catch (err) {
      console.warn(
        `[fee-invoice] lazy-pin failed for student ${String(student._id)} year ${yearOfStudy}; proceeding with resolved structure`,
        err,
      );
    }
  }

  // ── Applicable components ─────────────────────────────────────────
  // When a pin drives resolution we evaluate rules ONLY against the
  // pinned instance's components (honours Journey 7 supersede semantics:
  // superseded instances are excluded by the existing evaluator's status
  // filter, so we cannot delegate to it here).
  // When we fell back to live resolution we preserve the pre-Task-10
  // behavior by calling the existing evaluator.
  let applicableComponents: Array<{ feeComponentId: string; name: string; amount: number }>;
  if (pin && pin.snapshotComponents && pin.snapshotComponents.length > 0) {
    // Use frozen snapshot — immune to post-pin FeeComponent edits.
    applicableComponents = pin.snapshotComponents.map((c) => ({
      feeComponentId: String(c.feeComponentId),
      name: c.name,
      amount: c.amount,
    }));
  } else if (pin && instance) {
    // Legacy pin (no snapshot): fall back to live DB fetch.
    applicableComponents = await evaluateRulesForInstance(
      collegeId,
      String(instance._id),
      {
        quota: student.quota ?? 'convener',
        category: student.category,
        isHosteler: undefined,
        transportRequired: undefined,
      },
    );
  } else {
    applicableComponents = await evaluateFeeComponentRules(collegeId, {
      programmeId: String(student.programmeId),
      quota: student.quota ?? 'convener',
      category: student.category,
      isHosteler: undefined,
      transportRequired: undefined,
    });
  }

  // Fetch existing scholarships and concessions for this student
  const concessions = await Concession.find({
    collegeId,
    studentId: data.studentId,
    status: 'approved',
  }).lean();

  const totalConcession = concessions.reduce((sum, c) => sum + (c.flatAmount ?? 0), 0);

  const scholarshipCredits = await ScholarshipCredit.find({
    collegeId,
    studentId: data.studentId,
  }).lean();
  const totalScholarship = scholarshipCredits.reduce((sum, sc) => sum + sc.amount, 0);

  // Create invoice
  const grossTotal = applicableComponents.reduce((sum, c) => sum + c.amount, 0);
  const netPayable = Math.max(0, grossTotal - totalScholarship - totalConcession);

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber: generateInvoiceNumber(),
    studentId: data.studentId,
    type: 'fee',
    items: applicableComponents.map((c) => ({ description: c.name, amount: c.amount })),
    totalAmount: grossTotal,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'generated',
    semesterId: data.semesterId,
    netPayable,
    scholarshipAllocated: totalScholarship,
    concessionApplied: totalConcession,
  });

  // Create line items
  const sourcePinId = pin?._id;
  for (const comp of applicableComponents) {
    await InvoiceLineItem.create({
      collegeId,
      invoiceId: invoice._id,
      feeComponentId: comp.feeComponentId,
      description: comp.name,
      grossAmount: comp.amount,
      scholarshipAllocated: 0,
      concessionApplied: 0,
      netAmount: comp.amount,
      status: 'active',
      sourcePinId,
    });
  }

  // Update student fee account
  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: data.studentId },
    { $inc: { totalDue: netPayable, balance: netPayable } },
    { upsert: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'totalAmount', displayName: 'Total Amount', oldValue: null, newValue: grossTotal }],
    performedBy,
  });

  return invoice;
}

/** 6. Generate invoices for all active students in a semester (batch). */
export async function generateBatchInvoices(
  collegeId: string,
  data: { semesterId: string; academicYearId: string; feeStructureInstanceId: string },
  performedBy: string,
) {
  const enrollments = await Enrollment.find({
    collegeId,
    semesterId: data.semesterId,
    status: 'enrolled',
  }).lean();

  const studentIds = [...new Set(enrollments.map((e) => String(e.studentId)))];

  const results: { generated: number; errors: Array<{ studentId: string; error: string }> } = {
    generated: 0,
    errors: [],
  };

  for (const studentId of studentIds) {
    try {
      await generateSemesterInvoice(
        collegeId,
        { studentId, semesterId: data.semesterId, feeStructureInstanceId: data.feeStructureInstanceId },
        performedBy,
      );
      results.generated++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.errors.push({ studentId, error: message });
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: `batch-${data.semesterId}`,
    entityName: `Batch Invoice Generation`,
    action: 'create',
    changes: [
      { field: 'generated', displayName: 'Generated', oldValue: null, newValue: results.generated },
      { field: 'errors', displayName: 'Errors', oldValue: null, newValue: results.errors.length },
    ],
    performedBy,
  });

  return results;
}

/** 7. Generate an exam fee invoice. */
export async function generateExamFeeInvoice(
  collegeId: string,
  data: { studentId: string; semesterId: string; examType: string },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  // Fixed exam fee component — in production this would come from configuration
  const examFeeAmount = 1500;

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber: generateInvoiceNumber(),
    studentId: data.studentId,
    type: 'fee',
    items: [{ description: `${data.examType} Exam Fee`, amount: examFeeAmount }],
    totalAmount: examFeeAmount,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
    status: 'generated',
    examType: data.examType,
    semesterId: data.semesterId,
    netPayable: examFeeAmount,
  });

  await InvoiceLineItem.create({
    collegeId,
    invoiceId: invoice._id,
    description: `${data.examType} Exam Fee`,
    grossAmount: examFeeAmount,
    scholarshipAllocated: 0,
    concessionApplied: 0,
    netAmount: examFeeAmount,
    status: 'active',
  });

  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: data.studentId },
    { $inc: { totalDue: examFeeAmount, balance: examFeeAmount } },
    { upsert: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'examType', displayName: 'Exam Type', oldValue: null, newValue: data.examType }],
    performedBy,
  });

  return invoice;
}

/** 8. Adjust individual line items on an invoice. */
export async function adjustInvoice(
  collegeId: string,
  invoiceId: string,
  data: { reason: string; adjustments: Array<{ lineItemId: string; newAmount: number }> },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  for (const adj of data.adjustments) {
    const lineItem = await InvoiceLineItem.findOne({ _id: adj.lineItemId, collegeId, invoiceId });
    if (!lineItem) throw new AppError(404, `Line item ${adj.lineItemId} not found`);

    lineItem.netAmount = adj.newAmount;
    lineItem.status = 'adjusted';
    await lineItem.save();
  }

  // Recompute invoice total
  const lineItems = await InvoiceLineItem.find({ collegeId, invoiceId, status: { $ne: 'cancelled' } }).lean();
  const newTotal = lineItems.reduce((sum, li) => sum + li.netAmount, 0);
  const oldTotal = invoice.totalAmount;

  invoice.totalAmount = newTotal;
  invoice.netPayable = Math.max(0, newTotal - (invoice.scholarshipAllocated ?? 0) - (invoice.concessionApplied ?? 0));
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [
      { field: 'totalAmount', displayName: 'Total Amount', oldValue: oldTotal, newValue: newTotal },
      { field: 'reason', displayName: 'Adjustment Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return invoice;
}

/** 9. Dispute an invoice. */
export async function disputeInvoice(
  collegeId: string,
  invoiceId: string,
  data: { reason: string },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const oldStatus = invoice.status;
  invoice.status = 'disputed';
  await invoice.save();

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'disputed' },
      { field: 'reason', displayName: 'Dispute Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return invoice;
}

/** 10. Write off an invoice. */
export async function writeOffInvoice(
  collegeId: string,
  invoiceId: string,
  data: { reason: string; approvedBy: string },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const oldStatus = invoice.status;
  invoice.status = 'written_off';
  await invoice.save();

  // Update student fee account to reduce outstanding
  if (invoice.studentId) {
    const outstanding = invoice.netPayable ?? invoice.totalAmount;
    await StudentFeeAccount.findOneAndUpdate(
      { collegeId, studentId: invoice.studentId },
      { $inc: { totalWaived: outstanding, balance: -outstanding } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoice.invoiceNumber,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'written_off' },
      { field: 'reason', displayName: 'Write-off Reason', oldValue: null, newValue: data.reason },
      { field: 'approvedBy', displayName: 'Approved By', oldValue: null, newValue: data.approvedBy },
    ],
    performedBy,
  });

  return invoice;
}

// ═══════════════════════════════════════════════════════════
// Payment Processing (6)
// ═══════════════════════════════════════════════════════════

/** Helper: apply payment to invoice and update statuses. */
async function applyPaymentToInvoice(
  collegeId: string,
  invoiceId: string,
  amount: number,
  paymentTransactionId: string,
) {
  const invoice = await Invoice.findOne({ _id: invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const netPayable = invoice.netPayable ?? invoice.totalAmount;

  // Sum all existing payments for this invoice
  const existingPayments = await PaymentTransaction.find({
    collegeId,
    invoiceId,
    reconciliationStatus: { $nin: ['reversed', 'refunded'] },
  }).lean();

  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalWithNew = totalPaid + amount;

  if (totalWithNew >= netPayable) {
    invoice.status = 'paid';
  } else if (totalWithNew > 0) {
    invoice.status = 'partially_paid';
  }

  await invoice.save();

  // Check for overpayment
  if (totalWithNew > netPayable) {
    const overpayment = totalWithNew - netPayable;
    await OverpaymentRecord.create({
      collegeId,
      studentId: invoice.studentId,
      paymentTransactionId,
      invoiceId,
      overpaymentAmount: overpayment,
      resolution: 'pending',
    });
  }

  // Update student fee account
  if (invoice.studentId) {
    await StudentFeeAccount.findOneAndUpdate(
      { collegeId, studentId: invoice.studentId },
      {
        $inc: { totalPaid: amount, balance: -amount },
        $set: { lastPaymentDate: new Date() },
      },
      { upsert: true },
    );
  }
}

/** 11. Record an online payment. */
export async function recordOnlinePayment(
  collegeId: string,
  data: {
    invoiceId: string;
    amount: number;
    gatewayTransactionId: string;
    gatewayName: string;
    paymentMode: string;
  },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: data.invoiceId, collegeId }).lean();
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const txn = await PaymentTransaction.create({
    collegeId,
    studentId: invoice.studentId,
    invoiceId: data.invoiceId,
    amount: data.amount,
    channel: 'gateway',
    paymentMode: data.paymentMode,
    transactionRef: data.gatewayTransactionId,
    gatewayOrderId: data.gatewayTransactionId,
    reconciliationStatus: 'received',
    paymentDate: new Date(),
  });

  await applyPaymentToInvoice(collegeId, data.invoiceId, data.amount, String(txn._id));

  // Auto-generate receipt
  const receipt = await generateReceipt(collegeId, String(txn._id), performedBy);
  txn.receiptId = receipt._id as any;
  await txn.save();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(txn._id),
    entityName: `Online payment ${data.gatewayTransactionId}`,
    studentId: invoice.studentId as any,
    action: 'create',
    changes: [{ field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount }],
    performedBy,
  });

  return txn;
}

/** 12. Record a counter (cash/DD/cheque) payment. */
export async function recordCounterPayment(
  collegeId: string,
  data: {
    studentId: string;
    invoiceId: string;
    amount: number;
    mode: 'cash' | 'dd' | 'cheque';
    ddNumber?: string;
    ddBank?: string;
    ddDate?: string;
  },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: data.invoiceId, collegeId }).lean();
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const txn = await PaymentTransaction.create({
    collegeId,
    studentId: data.studentId,
    invoiceId: data.invoiceId,
    amount: data.amount,
    channel: data.mode,
    paymentMode: data.mode,
    reconciliationStatus: 'received',
    ddNumber: data.ddNumber,
    ddBank: data.ddBank,
    ddDate: data.ddDate ? new Date(data.ddDate) : undefined,
    paymentDate: new Date(),
  });

  await applyPaymentToInvoice(collegeId, data.invoiceId, data.amount, String(txn._id));

  const receipt = await generateReceipt(collegeId, String(txn._id), performedBy);
  txn.receiptId = receipt._id as any;
  await txn.save();

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(txn._id),
    entityName: `Counter payment (${data.mode})`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount }],
    performedBy,
  });

  return txn;
}

/** 13. Import bank statement entries and auto-match to invoices. */
export async function importBankStatement(
  collegeId: string,
  data: { entries: Array<{ reference: string; amount: number; date: string; narration: string }> },
  performedBy: string,
) {
  const results: {
    matched: Array<{ reference: string; paymentTransactionId: string; invoiceId: string }>;
    unmatched: Array<{ reference: string; amount: number; narration: string }>;
  } = { matched: [], unmatched: [] };

  for (const entry of data.entries) {
    // Try to auto-match by transactionRef or invoiceNumber
    const existingTxn = await PaymentTransaction.findOne({
      collegeId,
      transactionRef: entry.reference,
    }).lean();

    if (existingTxn) {
      // Already recorded — mark as matched
      await PaymentTransaction.updateOne(
        { _id: existingTxn._id },
        { $set: { reconciliationStatus: 'matched' } },
      );
      results.matched.push({
        reference: entry.reference,
        paymentTransactionId: String(existingTxn._id),
        invoiceId: String(existingTxn.invoiceId),
      });
      continue;
    }

    // Try match by invoice number in narration
    const invoice = await Invoice.findOne({
      collegeId,
      invoiceNumber: { $regex: entry.reference, $options: 'i' },
      status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
    }).lean();

    if (invoice) {
      const txn = await PaymentTransaction.create({
        collegeId,
        studentId: invoice.studentId,
        invoiceId: invoice._id,
        amount: entry.amount,
        channel: 'neft',
        paymentMode: 'bank_transfer',
        transactionRef: entry.reference,
        reconciliationStatus: 'matched',
        paymentDate: new Date(entry.date),
      });

      await applyPaymentToInvoice(collegeId, String(invoice._id), entry.amount, String(txn._id));

      results.matched.push({
        reference: entry.reference,
        paymentTransactionId: String(txn._id),
        invoiceId: String(invoice._id),
      });
    } else {
      results.unmatched.push({
        reference: entry.reference,
        amount: entry.amount,
        narration: entry.narration,
      });
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: `bank-import-${Date.now()}`,
    entityName: 'Bank Statement Import',
    action: 'create',
    changes: [
      { field: 'matched', displayName: 'Matched', oldValue: null, newValue: results.matched.length },
      { field: 'unmatched', displayName: 'Unmatched', oldValue: null, newValue: results.unmatched.length },
    ],
    performedBy,
  });

  return results;
}

/** 14. Manually match an unmatched payment to an invoice. */
export async function matchPaymentToInvoice(
  collegeId: string,
  paymentId: string,
  data: { invoiceId: string },
  performedBy: string,
) {
  const txn = await PaymentTransaction.findOne({ _id: paymentId, collegeId });
  if (!txn) throw new AppError(404, 'Payment transaction not found');

  const invoice = await Invoice.findOne({ _id: data.invoiceId, collegeId });
  if (!invoice) throw new AppError(404, 'Invoice not found');

  txn.invoiceId = data.invoiceId as any;
  txn.reconciliationStatus = 'matched';
  await txn.save();

  await applyPaymentToInvoice(collegeId, data.invoiceId, txn.amount, String(txn._id));

  await createAuditLog({
    collegeId,
    entityType: 'PaymentTransaction',
    entityId: String(txn._id),
    entityName: `Payment matched to ${invoice.invoiceNumber}`,
    action: 'update',
    changes: [
      { field: 'invoiceId', displayName: 'Invoice', oldValue: null, newValue: data.invoiceId },
      { field: 'reconciliationStatus', displayName: 'Reconciliation Status', oldValue: 'received', newValue: 'matched' },
    ],
    performedBy,
  });

  return txn;
}

/** 15. Detect whether a payment is a duplicate. */
export async function detectDuplicatePayment(
  collegeId: string,
  paymentId: string,
) {
  const txn = await PaymentTransaction.findOne({ _id: paymentId, collegeId }).lean();
  if (!txn) throw new AppError(404, 'Payment transaction not found');

  const dayStart = new Date(txn.paymentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(txn.paymentDate);
  dayEnd.setHours(23, 59, 59, 999);

  const duplicates = await PaymentTransaction.find({
    collegeId,
    _id: { $ne: paymentId },
    studentId: txn.studentId,
    amount: txn.amount,
    paymentDate: { $gte: dayStart, $lte: dayEnd },
  }).lean();

  if (duplicates.length > 0) {
    return {
      isDuplicate: true,
      confidence: duplicates.length === 1 ? 0.85 : 0.95,
      matchingPaymentId: String(duplicates[0]!._id),
    };
  }

  return { isDuplicate: false, confidence: 0, matchingPaymentId: null };
}

/** 16. Handle a bounced payment (cheque/DD). */
export async function handleBounce(
  collegeId: string,
  paymentId: string,
  data: { reason: string },
  performedBy: string,
) {
  const txn = await PaymentTransaction.findOne({ _id: paymentId, collegeId });
  if (!txn) throw new AppError(404, 'Payment transaction not found');

  // Reverse the payment
  txn.reconciliationStatus = 'reversed';
  await txn.save();

  // Revert invoice to unpaid
  const invoice = await Invoice.findOne({ _id: txn.invoiceId, collegeId });
  if (invoice) {
    // Recalculate status based on remaining valid payments
    const validPayments = await PaymentTransaction.find({
      collegeId,
      invoiceId: txn.invoiceId,
      _id: { $ne: paymentId },
      reconciliationStatus: { $nin: ['reversed', 'refunded'] },
    }).lean();

    const totalPaid = validPayments.reduce((sum, p) => sum + p.amount, 0);
    const netPayable = invoice.netPayable ?? invoice.totalAmount;

    if (totalPaid >= netPayable) {
      invoice.status = 'paid';
    } else if (totalPaid > 0) {
      invoice.status = 'partially_paid';
    } else {
      invoice.status = invoice.dueDate < new Date() ? 'overdue' : 'generated';
    }
    await invoice.save();
  }

  // Create bounce record
  const bounceRecord = await BounceRecord.create({
    collegeId,
    paymentTransactionId: paymentId,
    invoiceId: txn.invoiceId,
    reason: data.reason,
    penaltyAmount: 500, // Default bounce penalty
    bouncedAt: new Date(),
  });

  // Create bounce penalty fine
  await FinePenalty.create({
    collegeId,
    studentId: txn.studentId,
    type: 'other',
    reason: `Cheque/DD bounce penalty: ${data.reason}`,
    amount: 500,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    paidAmount: 0,
    status: 'pending',
  });

  // Reverse student fee account
  if (txn.studentId) {
    await StudentFeeAccount.findOneAndUpdate(
      { collegeId, studentId: txn.studentId },
      { $inc: { totalPaid: -txn.amount, balance: txn.amount } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'BounceRecord',
    entityId: String(bounceRecord._id),
    entityName: `Bounce for payment ${paymentId}`,
    studentId: txn.studentId as any,
    action: 'create',
    changes: [{ field: 'reason', displayName: 'Bounce Reason', oldValue: null, newValue: data.reason }],
    performedBy,
  });

  return bounceRecord;
}

// ═══════════════════════════════════════════════════════════
// Receipts (3)
// ═══════════════════════════════════════════════════════════

/** 17. Generate a receipt for a payment transaction. */
export async function generateReceipt(
  collegeId: string,
  paymentTransactionId: string,
  performedBy: string,
) {
  const txn = await PaymentTransaction.findOne({ _id: paymentTransactionId, collegeId }).lean();
  if (!txn) throw new AppError(404, 'Payment transaction not found');

  const receipt = await Receipt.create({
    collegeId,
    receiptNumber: generateReceiptNumber(),
    paymentTransactionId,
    studentId: txn.studentId,
    amount: txn.amount,
    issuedDate: new Date(),
    channel: 'email',
    status: 'issued',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: String(receipt._id),
    entityName: receipt.receiptNumber,
    studentId: txn.studentId as any,
    action: 'create',
    changes: [{ field: 'amount', displayName: 'Amount', oldValue: null, newValue: txn.amount }],
    performedBy,
  });

  return receipt;
}

/** 18. Cancel a receipt. */
export async function cancelReceipt(
  collegeId: string,
  receiptId: string,
  data: { reason: string },
  performedBy: string,
) {
  const receipt = await Receipt.findOne({ _id: receiptId, collegeId });
  if (!receipt) throw new AppError(404, 'Receipt not found');
  if (receipt.status === 'cancelled') throw new AppError(400, 'Receipt is already cancelled');

  const oldStatus = receipt.status;
  receipt.status = 'cancelled';
  await receipt.save();

  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: String(receipt._id),
    entityName: receipt.receiptNumber,
    studentId: receipt.studentId as any,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
      { field: 'reason', displayName: 'Cancel Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return receipt;
}

/** 19. Reissue a receipt (creates a new receipt linked to the same payment). */
export async function reissueReceipt(
  collegeId: string,
  receiptId: string,
  performedBy: string,
) {
  const original = await Receipt.findOne({ _id: receiptId, collegeId }).lean();
  if (!original) throw new AppError(404, 'Original receipt not found');

  // Mark original as reissued
  await Receipt.updateOne({ _id: receiptId }, { $set: { status: 'reissued' } });

  const newReceipt = await Receipt.create({
    collegeId,
    receiptNumber: generateReceiptNumber(),
    paymentTransactionId: original.paymentTransactionId,
    studentId: original.studentId,
    amount: original.amount,
    issuedDate: new Date(),
    channel: 'email',
    status: 'issued',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Receipt',
    entityId: String(newReceipt._id),
    entityName: newReceipt.receiptNumber,
    studentId: original.studentId as any,
    action: 'create',
    changes: [{ field: 'reissuedFrom', displayName: 'Reissued From', oldValue: null, newValue: original.receiptNumber }],
    performedBy,
  });

  return newReceipt;
}

// ═══════════════════════════════════════════════════════════
// Reconciliation (2)
// ═══════════════════════════════════════════════════════════

/** 20. Run reconciliation for a period, matching transactions against bank records. */
export async function runReconciliation(
  collegeId: string,
  data: { periodFrom: string; periodTo: string },
  performedBy: string,
) {
  const periodFrom = new Date(data.periodFrom);
  const periodTo = new Date(data.periodTo);

  const transactions = await PaymentTransaction.find({
    collegeId,
    paymentDate: { $gte: periodFrom, $lte: periodTo },
    reconciliationStatus: { $in: ['received', 'initiated'] },
  }).lean();

  const results: { matched: number; discrepancies: number } = { matched: 0, discrepancies: 0 };

  for (const txn of transactions) {
    // Auto-match: if transaction has a reference and the invoice is paid, consider matched
    const invoice = await Invoice.findOne({ _id: txn.invoiceId, collegeId }).lean();

    if (invoice && txn.transactionRef) {
      // Simple matching: if amount matches what we expect
      const netPayable = invoice.netPayable ?? invoice.totalAmount;
      const isMatch = txn.amount <= netPayable;

      await ReconciliationEntry.create({
        collegeId,
        paymentTransactionId: txn._id,
        bankStatementRef: txn.transactionRef,
        matchedAmount: txn.amount,
        status: isMatch ? 'matched' : 'discrepancy_flagged',
        discrepancyType: isMatch ? undefined : 'amount_mismatch',
        discrepancyAmount: isMatch ? undefined : Math.abs(txn.amount - netPayable),
      });

      if (isMatch) {
        await PaymentTransaction.updateOne(
          { _id: txn._id },
          { $set: { reconciliationStatus: 'matched' } },
        );
        results.matched++;
      } else {
        await PaymentTransaction.updateOne(
          { _id: txn._id },
          { $set: { reconciliationStatus: 'discrepancy' } },
        );
        results.discrepancies++;
      }
    } else {
      // No reference — flag as discrepancy
      await ReconciliationEntry.create({
        collegeId,
        paymentTransactionId: txn._id,
        matchedAmount: 0,
        status: 'discrepancy_flagged',
        discrepancyType: 'missing_reference',
        discrepancyAmount: txn.amount,
      });
      results.discrepancies++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: `recon-${Date.now()}`,
    entityName: `Reconciliation ${data.periodFrom} to ${data.periodTo}`,
    action: 'create',
    changes: [
      { field: 'matched', displayName: 'Matched', oldValue: null, newValue: results.matched },
      { field: 'discrepancies', displayName: 'Discrepancies', oldValue: null, newValue: results.discrepancies },
    ],
    performedBy,
  });

  return results;
}

/** 21. Resolve a reconciliation discrepancy. */
export async function resolveDiscrepancy(
  collegeId: string,
  reconciliationEntryId: string,
  data: { resolution: string; resolvedBy: string },
  performedBy: string,
) {
  const entry = await ReconciliationEntry.findOne({ _id: reconciliationEntryId, collegeId });
  if (!entry) throw new AppError(404, 'Reconciliation entry not found');
  if (entry.status === 'resolved') throw new AppError(400, 'Entry is already resolved');

  const oldStatus = entry.status;
  entry.status = 'resolved';
  entry.resolvedBy = data.resolvedBy as any;
  entry.resolvedAt = new Date();
  entry.notes = data.resolution;
  await entry.save();

  // Update the associated payment transaction
  await PaymentTransaction.updateOne(
    { _id: entry.paymentTransactionId },
    { $set: { reconciliationStatus: 'resolved' } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ReconciliationEntry',
    entityId: String(entry._id),
    entityName: `Reconciliation entry ${String(entry._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'resolved' },
      { field: 'resolution', displayName: 'Resolution', oldValue: null, newValue: data.resolution },
    ],
    performedBy,
  });

  return entry;
}

// ═══════════════════════════════════════════════════════════
// Refunds (3)
// ═══════════════════════════════════════════════════════════

/** 22. Request a refund. */
export async function requestRefund(
  collegeId: string,
  data: { invoiceId: string; studentId: string; amount: number; reason: string; sourceType: string },
  performedBy: string,
) {
  const invoice = await Invoice.findOne({ _id: data.invoiceId, collegeId }).lean();
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const refund = await Refund.create({
    collegeId,
    studentId: data.studentId,
    invoiceId: data.invoiceId,
    amount: data.amount,
    reason: data.reason,
    sourceType: data.sourceType,
    refundMode: 'online',
    status: 'requested',
  });

  await createAuditLog({
    collegeId,
    entityType: 'Refund',
    entityId: String(refund._id),
    entityName: `Refund for invoice ${invoice.invoiceNumber}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount },
      { field: 'reason', displayName: 'Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return refund;
}

/** 23. Approve a refund. */
export async function approveRefund(
  collegeId: string,
  refundId: string,
  data: { approvedBy: string },
  performedBy: string,
) {
  const refund = await Refund.findOne({ _id: refundId, collegeId });
  if (!refund) throw new AppError(404, 'Refund not found');
  if (refund.status !== 'requested') throw new AppError(400, 'Only requested refunds can be approved');

  const oldStatus = refund.status;
  refund.status = 'approved';
  refund.approvedBy = data.approvedBy as any;
  await refund.save();

  await createAuditLog({
    collegeId,
    entityType: 'Refund',
    entityId: String(refund._id),
    entityName: `Refund ${String(refund._id)}`,
    studentId: refund.studentId as any,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'approved' },
      { field: 'approvedBy', displayName: 'Approved By', oldValue: null, newValue: data.approvedBy },
    ],
    performedBy,
  });

  return refund;
}

/** 24. Process an approved refund. */
export async function processRefund(
  collegeId: string,
  refundId: string,
  performedBy: string,
) {
  const refund = await Refund.findOne({ _id: refundId, collegeId });
  if (!refund) throw new AppError(404, 'Refund not found');
  if (refund.status !== 'approved') throw new AppError(400, 'Only approved refunds can be processed');

  const oldStatus = refund.status;
  refund.status = 'processed';
  refund.processedDate = new Date();
  refund.refundTransactionRef = `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  await refund.save();

  // Update student fee account
  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: refund.studentId },
    { $inc: { totalRefunded: refund.amount, balance: refund.amount } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Refund',
    entityId: String(refund._id),
    entityName: `Refund ${String(refund._id)}`,
    studentId: refund.studentId as any,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'processed' },
      { field: 'refundTransactionRef', displayName: 'Ref', oldValue: null, newValue: refund.refundTransactionRef },
    ],
    performedBy,
  });

  return refund;
}

// ═══════════════════════════════════════════════════════════
// Scholarships & Concessions (6)
// ═══════════════════════════════════════════════════════════

/** 25. Verify scholarship eligibility for a student. */
export async function verifyScholarshipEligibility(
  collegeId: string,
  data: { studentId: string; schemeCode: string },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const eligibility = await ScholarshipEligibility.create({
    collegeId,
    studentId: data.studentId,
    schemeCode: data.schemeCode,
    academicYearId: student.batchId ?? student.programmeId, // fallback
    status: 'eligible', // Placeholder: auto-verify
    verificationMethod: 'auto',
    verifiedAt: new Date(),
    documentsStatus: 'complete',
  });

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: String(eligibility._id),
    entityName: `${data.schemeCode} eligibility for ${data.studentId}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'eligible' }],
    performedBy,
  });

  return eligibility;
}

/** 26. Submit a batch of scholarship claims. */
export async function submitScholarshipClaimBatch(
  collegeId: string,
  data: { eligibilityIds: string[] },
  performedBy: string,
) {
  const claims: Array<{ claimId: string; eligibilityId: string }> = [];

  for (const eligibilityId of data.eligibilityIds) {
    const eligibility = await ScholarshipEligibility.findOne({ _id: eligibilityId, collegeId }).lean();
    if (!eligibility) continue;
    if (eligibility.status !== 'eligible') continue;

    const claim = await ScholarshipClaim.create({
      collegeId,
      scholarshipEligibilityId: eligibilityId,
      studentId: eligibility.studentId,
      schemeCode: eligibility.schemeCode,
      academicYearId: eligibility.academicYearId,
      claimAmount: 0, // Amount determined by scheme; placeholder
      status: 'submitted',
      submittedAt: new Date(),
    });

    await ScholarshipReceivable.create({
      collegeId,
      scholarshipClaimId: claim._id,
      studentId: eligibility.studentId,
      expectedAmount: 0, // Placeholder
      status: 'pending',
    });

    claims.push({ claimId: String(claim._id), eligibilityId });
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: `batch-${Date.now()}`,
    entityName: 'Scholarship Claim Batch',
    action: 'create',
    changes: [{ field: 'count', displayName: 'Claims Submitted', oldValue: null, newValue: claims.length }],
    performedBy,
  });

  return claims;
}

/** 27. Process a scholarship disbursement. */
export async function processScholarshipDisbursement(
  collegeId: string,
  claimId: string,
  data: { amount: number; bankReference: string },
  performedBy: string,
) {
  const claim = await ScholarshipClaim.findOne({ _id: claimId, collegeId });
  if (!claim) throw new AppError(404, 'Scholarship claim not found');

  claim.status = 'approved';
  claim.claimAmount = data.amount;
  await claim.save();

  // Update receivable
  await ScholarshipReceivable.findOneAndUpdate(
    { collegeId, scholarshipClaimId: claimId },
    {
      $set: {
        status: 'disbursed',
        disbursedAmount: data.amount,
        disbursedAt: new Date(),
      },
    },
  );

  // Apply to outstanding invoices
  const outstandingInvoices = await Invoice.find({
    collegeId,
    studentId: claim.studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
  })
    .sort({ dueDate: 1 })
    .lean();

  let remaining = data.amount;
  for (const inv of outstandingInvoices) {
    if (remaining <= 0) break;

    const netPayable = inv.netPayable ?? inv.totalAmount;
    const applyAmount = Math.min(remaining, netPayable);

    await ScholarshipCredit.create({
      collegeId,
      scholarshipReceivableId: (
        await ScholarshipReceivable.findOne({ collegeId, scholarshipClaimId: claimId }).lean()
      )?._id,
      studentId: claim.studentId,
      invoiceId: inv._id,
      amount: applyAmount,
      appliedAt: new Date(),
    });

    await Invoice.updateOne(
      { _id: inv._id },
      {
        $inc: { scholarshipAllocated: applyAmount },
        $set: { netPayable: Math.max(0, netPayable - applyAmount) },
      },
    );

    remaining -= applyAmount;
  }

  // Update student fee account
  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: claim.studentId },
    { $inc: { totalWaived: data.amount, balance: -data.amount } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipClaim',
    entityId: String(claim._id),
    entityName: `Scholarship ${claim.schemeCode}`,
    studentId: claim.studentId as any,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'submitted', newValue: 'approved' },
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount },
      { field: 'bankReference', displayName: 'Bank Reference', oldValue: null, newValue: data.bankReference },
    ],
    performedBy,
  });

  return claim;
}

/** 28. Apply a hardship-based concession. */
export async function applyHardshipConcession(
  collegeId: string,
  data: { studentId: string; amount: number; reason: string; feeComponentId?: string; approvedBy: string },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const concession = await Concession.create({
    collegeId,
    studentId: data.studentId,
    type: 'financial_hardship',
    flatAmount: data.amount,
    reason: data.reason,
    approvedBy: data.approvedBy,
    academicYearId: student.batchId ?? student.programmeId, // fallback
    status: 'approved',
    source: 'm04',
    feeComponentId: data.feeComponentId,
  });

  // Apply to open invoices
  const openInvoices = await Invoice.find({
    collegeId,
    studentId: data.studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
  })
    .sort({ dueDate: 1 })
    .lean();

  let remaining = data.amount;
  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const netPayable = inv.netPayable ?? inv.totalAmount;
    const applyAmount = Math.min(remaining, netPayable);

    await Invoice.updateOne(
      { _id: inv._id },
      {
        $inc: { concessionApplied: applyAmount },
        $set: { netPayable: Math.max(0, netPayable - applyAmount) },
      },
    );
    remaining -= applyAmount;
  }

  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: data.studentId },
    { $inc: { totalWaived: data.amount, balance: -data.amount } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: String(concession._id),
    entityName: `Hardship concession for ${data.studentId}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount },
      { field: 'reason', displayName: 'Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return concession;
}

/** 29. Apply a merit-based scholarship concession. */
export async function applyMeritScholarship(
  collegeId: string,
  data: { studentId: string; amount: number; academicYearId: string },
  performedBy: string,
) {
  const student = await Student.findOne({ _id: data.studentId, collegeId }).lean();
  if (!student) throw new AppError(404, 'Student not found');

  const concession = await Concession.create({
    collegeId,
    studentId: data.studentId,
    type: 'merit',
    flatAmount: data.amount,
    reason: 'Merit scholarship',
    academicYearId: data.academicYearId,
    status: 'approved',
    source: 'm04',
  });

  // Apply to open invoices
  const openInvoices = await Invoice.find({
    collegeId,
    studentId: data.studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
  })
    .sort({ dueDate: 1 })
    .lean();

  let remaining = data.amount;
  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const netPayable = inv.netPayable ?? inv.totalAmount;
    const applyAmount = Math.min(remaining, netPayable);

    await Invoice.updateOne(
      { _id: inv._id },
      {
        $inc: { concessionApplied: applyAmount },
        $set: { netPayable: Math.max(0, netPayable - applyAmount) },
      },
    );
    remaining -= applyAmount;
  }

  await StudentFeeAccount.findOneAndUpdate(
    { collegeId, studentId: data.studentId },
    { $inc: { totalWaived: data.amount, balance: -data.amount } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Concession',
    entityId: String(concession._id),
    entityName: `Merit scholarship for ${data.studentId}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'amount', displayName: 'Amount', oldValue: null, newValue: data.amount }],
    performedBy,
  });

  return concession;
}

/** 30. Renew scholarship eligibility for a new academic year. */
export async function renewScholarshipEligibility(
  collegeId: string,
  data: { studentId: string; newAcademicYearId: string },
  performedBy: string,
) {
  // Find prior year eligibilities
  const priorEligibilities = await ScholarshipEligibility.find({
    collegeId,
    studentId: data.studentId,
    status: 'eligible',
  }).lean();

  if (priorEligibilities.length === 0) {
    throw new AppError(404, 'No prior scholarship eligibilities found for this student');
  }

  const renewals: Array<{ eligibilityId: string; schemeCode: string }> = [];

  for (const prior of priorEligibilities) {
    const renewal = await ScholarshipEligibility.create({
      collegeId,
      studentId: data.studentId,
      schemeCode: prior.schemeCode,
      academicYearId: data.newAcademicYearId,
      status: 'pending',
      verificationMethod: 'auto',
    });

    renewals.push({ eligibilityId: String(renewal._id), schemeCode: prior.schemeCode });
  }

  await createAuditLog({
    collegeId,
    entityType: 'ScholarshipEligibility',
    entityId: `renewal-${data.studentId}`,
    entityName: `Scholarship renewal for ${data.studentId}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [{ field: 'renewals', displayName: 'Renewals', oldValue: null, newValue: renewals.length }],
    performedBy,
  });

  return renewals;
}

// ═══════════════════════════════════════════════════════════
// Defaulter Management (6)
// ═══════════════════════════════════════════════════════════

/** 31. Identify defaulters based on overdue invoices. */
export async function identifyDefaulters(
  collegeId: string,
  data: { asOfDate?: string },
  performedBy: string,
) {
  const asOfDate = data.asOfDate ? new Date(data.asOfDate) : new Date();

  const overdueInvoices = await Invoice.find({
    collegeId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
    dueDate: { $lt: asOfDate },
  }).lean();

  let newDefaulters = 0;

  for (const inv of overdueInvoices) {
    if (!inv.studentId) continue;

    const outstanding = inv.netPayable ?? inv.totalAmount;
    if (outstanding <= 0) continue;

    // Check if already tracked
    const existing = await DefaulterRecord.findOne({
      collegeId,
      studentId: inv.studentId,
      invoiceId: inv._id,
      escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
    }).lean();

    if (existing) continue;

    const daysOverdue = Math.floor((asOfDate.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    await DefaulterRecord.create({
      collegeId,
      studentId: inv.studentId,
      invoiceId: inv._id,
      overdueAmount: outstanding,
      daysOverdue,
      escalationStage: 'stage_1',
      welfareReferralStatus: 'none',
    });

    // Update invoice status to overdue
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'overdue' } });

    newDefaulters++;
  }

  const total = await DefaulterRecord.countDocuments({
    collegeId,
    escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
  });

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: `identify-${Date.now()}`,
    entityName: 'Defaulter Identification Run',
    action: 'create',
    changes: [
      { field: 'newDefaulters', displayName: 'New Defaulters', oldValue: null, newValue: newDefaulters },
      { field: 'total', displayName: 'Total Active', oldValue: null, newValue: total },
    ],
    performedBy,
  });

  return { newDefaulters, total };
}

/** 32. Escalate a defaulter to the next stage. */
export async function escalateDefaulter(
  collegeId: string,
  defaulterId: string,
  data: { stage: string },
  performedBy: string,
) {
  const record = await DefaulterRecord.findOne({ _id: defaulterId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const oldStage = record.escalationStage;
  record.escalationStage = data.stage as any;
  await record.save();

  // Determine action type based on stage
  const stageActions: Record<string, string> = {
    stage_1: 'sms_reminder',
    stage_2: 'whatsapp_parent',
    stage_3: 'phone_call_flag',
    stage_4: 'legal_notice_flag',
    welfare_referred: 'welfare_referral',
  };

  const actionType = stageActions[data.stage] ?? 'sms_reminder';

  // 008 Phase 1 — report to the CCD engine from stage 2 onward. Stage 1 is a
  // routine SMS nudge and firing on it would flag most of the cohort every
  // billing cycle, which is how a risk board becomes noise. Stage 2 means a
  // parent has been contacted and the dues are still open.
  if (data.stage !== 'stage_1') {
    await emitRiskSignal(collegeId, {
      studentId: String(record.studentId),
      source: 'M04',
      signalType: 'fee_default',
      triggerData: {
        defaulterRecordId: defaulterId,
        escalationStage: data.stage,
        previousStage: oldStage,
      },
    });
  }

  const action = await EscalationAction.create({
    collegeId,
    defaulterRecordId: defaulterId,
    actionType,
    status: 'scheduled',
  });

  await createAuditLog({
    collegeId,
    entityType: 'DefaulterRecord',
    entityId: String(record._id),
    entityName: `Defaulter ${String(record.studentId)}`,
    studentId: record.studentId as any,
    action: 'update',
    changes: [{ field: 'escalationStage', displayName: 'Escalation Stage', oldValue: oldStage, newValue: data.stage }],
    performedBy,
  });

  return { record, action };
}

/** 33. Compute a distress score for a student (placeholder with default weights). */
export async function computeDistressScore(
  _collegeId: string,
  _studentId: string,
) {
  // Placeholder scoring: each signal defaults to 50 with weight 0.2
  const signals = [
    { type: 'attendance', value: 50, weight: 0.2 },
    { type: 'communications', value: 50, weight: 0.2 },
    { type: 'welfare', value: 50, weight: 0.2 },
    { type: 'academic', value: 50, weight: 0.2 },
    { type: 'scholarship', value: 50, weight: 0.2 },
  ];

  const score = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / 100;

  return { score, signals };
}

/** 34. Refer a defaulter to the welfare module. */
export async function referToWelfare(
  collegeId: string,
  defaulterId: string,
  data: { distressScore: number; signals: Array<{ type: string; value: number; weight: number }> },
  performedBy: string,
) {
  const record = await DefaulterRecord.findOne({ _id: defaulterId, collegeId });
  if (!record) throw new AppError(404, 'Defaulter record not found');

  const referral = await WelfareReferral.create({
    collegeId,
    defaulterRecordId: defaulterId,
    studentId: record.studentId,
    distressScore: data.distressScore,
    distressSignals: data.signals,
    referralStatus: 'referred',
    referredBy: performedBy,
  });

  // Update defaulter record
  record.welfareReferralStatus = 'referred';
  record.escalationStage = 'welfare_referred';
  record.distressScore = data.distressScore;
  record.distressSignals = data.signals;
  await record.save();

  await createAuditLog({
    collegeId,
    entityType: 'WelfareReferral',
    entityId: String(referral._id),
    entityName: `Welfare referral for ${String(record.studentId)}`,
    studentId: record.studentId as any,
    action: 'create',
    changes: [
      { field: 'distressScore', displayName: 'Distress Score', oldValue: null, newValue: data.distressScore },
    ],
    performedBy,
  });

  return referral;
}

/** 35. Apply a financial hold on a student. */
export async function applyFinancialHold(
  collegeId: string,
  data: { studentId: string; holdType: string; reason: string; appliedBy: string },
  performedBy: string,
) {
  // Find an active defaulter record for the student (required for FinancialHold)
  const existingDefaulter = await DefaulterRecord.findOne({
    collegeId,
    studentId: data.studentId,
    escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] },
  }).lean();

  let defaulterRecordId: string;

  if (existingDefaulter) {
    defaulterRecordId = String(existingDefaulter._id);
  } else {
    // If no defaulter record exists, we still need one for the hold reference.
    // Create a minimal record from the student's outstanding invoices.
    const overdueInvoice = await Invoice.findOne({
      collegeId,
      studentId: data.studentId,
      status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
    }).lean();

    if (!overdueInvoice) throw new AppError(400, 'No outstanding invoices found for this student');

    const newRecord = await DefaulterRecord.create({
      collegeId,
      studentId: data.studentId,
      invoiceId: overdueInvoice._id,
      overdueAmount: overdueInvoice.netPayable ?? overdueInvoice.totalAmount,
      daysOverdue: 0,
      escalationStage: 'stage_1',
      welfareReferralStatus: 'none',
    });
    defaulterRecordId = String(newRecord._id);
  }

  const hold = await FinancialHold.create({
    collegeId,
    studentId: data.studentId,
    defaulterRecordId: defaulterRecordId,
    holdType: data.holdType,
    holdStatus: 'active',
    effectiveDate: new Date(),
    approvedBy: data.appliedBy,
  });

  // Update student hasFinancialHold flag
  await Student.updateOne(
    { _id: data.studentId, collegeId },
    { $set: { hasFinancialHold: true } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: String(hold._id),
    entityName: `${data.holdType} hold for ${data.studentId}`,
    studentId: data.studentId as any,
    action: 'create',
    changes: [
      { field: 'holdType', displayName: 'Hold Type', oldValue: null, newValue: data.holdType },
      { field: 'reason', displayName: 'Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return hold;
}

/** 36. Release a financial hold. */
export async function releaseFinancialHold(
  collegeId: string,
  holdId: string,
  data: { releasedBy: string; reason: string },
  performedBy: string,
) {
  const hold = await FinancialHold.findOne({ _id: holdId, collegeId });
  if (!hold) throw new AppError(404, 'Financial hold not found');
  if (hold.holdStatus === 'released') throw new AppError(400, 'Hold is already released');

  hold.holdStatus = 'released';
  hold.releaseDate = new Date();
  hold.releasedBy = data.releasedBy as any;
  hold.releaseReason = data.reason;
  await hold.save();

  // Check if student has any remaining active holds
  const activeHolds = await FinancialHold.countDocuments({
    collegeId,
    studentId: hold.studentId,
    holdStatus: 'active',
  });

  if (activeHolds === 0) {
    await Student.updateOne(
      { _id: hold.studentId, collegeId },
      { $set: { hasFinancialHold: false } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'FinancialHold',
    entityId: String(hold._id),
    entityName: `Hold ${String(hold._id)} released`,
    studentId: hold.studentId as any,
    action: 'update',
    changes: [
      { field: 'holdStatus', displayName: 'Hold Status', oldValue: 'active', newValue: 'released' },
      { field: 'releaseReason', displayName: 'Release Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return hold;
}

// ═══════════════════════════════════════════════════════════
// Financial Holds Check (1)
// ═══════════════════════════════════════════════════════════

/** 37. Check financial clearance status for a student. */
export async function checkFinancialClearance(
  collegeId: string,
  studentId: string,
) {
  const holds = await FinancialHold.find({
    collegeId,
    studentId,
    holdStatus: 'active',
  }).lean();

  const outstandingInvoices = await Invoice.find({
    collegeId,
    studentId,
    status: { $in: ['generated', 'sent', 'partially_paid', 'overdue'] },
  }).lean();

  const outstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.netPayable ?? inv.totalAmount),
    0,
  );

  return {
    cleared: holds.length === 0 && outstanding <= 0,
    holds,
    outstanding,
  };
}

// ═══════════════════════════════════════════════════════════
// Vendor Payments (2)
// ═══════════════════════════════════════════════════════════

/** 38. Schedule a vendor payment. */
export async function scheduleVendorPayment(
  collegeId: string,
  data: { paymentRequestId: string; scheduledDate: string; approvedBy: string },
  performedBy: string,
) {
  const paymentRequest = await PaymentRequest.findOne({ _id: data.paymentRequestId, collegeId }).lean();
  if (!paymentRequest) throw new AppError(404, 'Payment request not found');

  const vendorPayment = await VendorPayment.create({
    collegeId,
    paymentRequestId: data.paymentRequestId,
    vendorId: paymentRequest.vendorId,
    amount: paymentRequest.amount,
    executionDate: new Date(data.scheduledDate),
    status: 'scheduled',
  });

  // Update payment request status
  await PaymentRequest.updateOne(
    { _id: data.paymentRequestId },
    { $set: { status: 'scheduled' } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(vendorPayment._id),
    entityName: `Vendor payment for request ${data.paymentRequestId}`,
    action: 'create',
    changes: [
      { field: 'scheduledDate', displayName: 'Scheduled Date', oldValue: null, newValue: data.scheduledDate },
      { field: 'amount', displayName: 'Amount', oldValue: null, newValue: paymentRequest.amount },
    ],
    performedBy,
  });

  return vendorPayment;
}

/** 39. Confirm a vendor payment with bank reference. */
export async function confirmVendorPayment(
  collegeId: string,
  vendorPaymentId: string,
  data: { bankReference: string },
  performedBy: string,
) {
  const vendorPayment = await VendorPayment.findOne({ _id: vendorPaymentId, collegeId });
  if (!vendorPayment) throw new AppError(404, 'Vendor payment not found');

  const oldStatus = vendorPayment.status;
  vendorPayment.status = 'bank_confirmed';
  vendorPayment.bankReference = data.bankReference;
  await vendorPayment.save();

  // Update payment request status
  await PaymentRequest.updateOne(
    { _id: vendorPayment.paymentRequestId },
    { $set: { status: 'confirmed' } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'VendorPayment',
    entityId: String(vendorPayment._id),
    entityName: `Vendor payment ${String(vendorPayment._id)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'bank_confirmed' },
      { field: 'bankReference', displayName: 'Bank Reference', oldValue: null, newValue: data.bankReference },
    ],
    performedBy,
  });

  return vendorPayment;
}

// ═══════════════════════════════════════════════════════════
// Year-End (1)
// ═══════════════════════════════════════════════════════════

/** 40. Generate a revenue reconciliation report for an academic year. */
export async function generateRevenueReport(
  collegeId: string,
  data: { academicYearId: string },
  performedBy: string,
) {
  // Aggregate all invoices for the academic year
  const allInvoices = await Invoice.find({
    collegeId,
    semesterId: { $exists: true },
  }).lean();

  // We approximate by checking all invoices — in production this would filter by academicYear
  const totalInvoiced = allInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const paidInvoices = allInvoices.filter((inv) => inv.status === 'paid');
  const totalCollected = paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const outstandingInvoices = allInvoices.filter((inv) =>
    ['generated', 'sent', 'partially_paid', 'overdue'].includes(inv.status),
  );
  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.netPayable ?? inv.totalAmount),
    0,
  );

  const writtenOffInvoices = allInvoices.filter((inv) => inv.status === 'written_off');
  const totalWrittenOff = writtenOffInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  const totalScholarships = allInvoices.reduce((sum, inv) => sum + (inv.scholarshipAllocated ?? 0), 0);
  const totalConcessions = allInvoices.reduce((sum, inv) => sum + (inv.concessionApplied ?? 0), 0);

  // Aggregate refunds
  const refunds = await Refund.find({ collegeId, status: 'processed' }).lean();
  const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  const report = await RevenueReconciliationReport.findOneAndUpdate(
    { collegeId, academicYearId: data.academicYearId },
    {
      $set: {
        collegeId,
        academicYearId: data.academicYearId,
        totalInvoiced,
        totalCollected,
        scholarshipOffsets: totalScholarships,
        concessionsGranted: totalConcessions,
        writeOffs: totalWrittenOff,
        outstandingReceivables: totalOutstanding,
        status: 'draft',
        periodStart: yearStart,
        periodEnd: yearEnd,
        generatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  await createAuditLog({
    collegeId,
    entityType: 'RevenueReconciliationReport',
    entityId: String(report._id),
    entityName: `Revenue Report AY ${data.academicYearId}`,
    action: 'create',
    changes: [
      { field: 'totalInvoiced', displayName: 'Total Invoiced', oldValue: null, newValue: totalInvoiced },
      { field: 'totalCollected', displayName: 'Total Collected', oldValue: null, newValue: totalCollected },
      { field: 'totalOutstanding', displayName: 'Total Outstanding', oldValue: null, newValue: totalOutstanding },
      { field: 'totalRefunded', displayName: 'Total Refunded', oldValue: null, newValue: totalRefunded },
    ],
    performedBy,
  });

  return report;
}
