/**
 * fee-commitment-sheet-service (Task 7 — Fee Configuration)
 *
 * Renders the per-student, per-year Fee Commitment Sheet (PDF) and
 * attaches it to the student's document set. Entry points:
 *
 *   - `generateSheet(studentId, pinId)` — synchronous-capable (also
 *     called from the BullMQ `FEE_COMMITMENT` worker in
 *     `workers/fee-commitment.worker.ts`).
 *   - `regenerateForPin(studentId, pinId)` — R-9 hook used when a
 *     concession/scholarship changes the payable amount. Marks the
 *     previous document `superseded` before creating the new one.
 *
 * Spec: .captain/specs/fee-configuration/spec.md §AC Commitment Sheet
 * Plan: .captain/specs/fee-configuration/plan.md §1.8 + R-9
 * Tasks: .captain/specs/fee-configuration/tasks.md §Task 7
 *
 * ── Document attachment seam ──
 * The spec nominates M02 People Documents (`createDocument(...)`) as
 * the attachment target. The existing M02 surface provides
 * `generateDocument` (which persists an `ExitDocument`) — no generic
 * `createDocument(personId, documentType, content)` entry point
 * exists. Rather than introduce a new M02 function or mutate a model
 * (forbidden by the Task 7 constraints), this service writes directly
 * to the `ExitDocument` model. See `defaultCreateDocument` below for
 * the shape. When M02 grows a proper `createDocument`, the single
 * seam `__setCreateDocumentForTests` allows swapping the impl
 * without touching callers.
 *
 * The `fee_commitment_sheet` documentType is NOT in the current
 * `ExitDocument.type` enum (which lists only graduation/exit document
 * types). We store the canonical type string in `metadata.documentType`
 * and set the schema `type` field to `'bonafide'` (the closest free-
 * form choice within the existing enum) so persistence succeeds
 * without a schema migration.
 */

import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { PdfRenderer } from '../../shared/pdf/PdfRenderer';
import { Student, IStudent, IFeePin } from '../../models/people/Student';
import { Person } from '../../models/people/Person';
import { College } from '../../models/College';
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { FeeComponent } from '../../models/finance/FeeComponent';
import { FeeAgreement } from '../../models/finance/FeeAgreement';
import { ExitDocument } from '../../models/people/ExitDocument';
import { evaluateFeeComponentRules } from './fee-lifecycle-service';

// ── Types ─────────────────────────────────────────────────────────────

export interface GenerateSheetResult {
  documentId: string;
  pdfBuffer: Buffer;
}

export interface GenerateSheetOpts {
  /**
   * Student opt-ins for conditional components (hostel/transport).
   * Student model does not currently surface these flags (they live on
   * allotment records owned by a separate subsystem), so the caller
   * passes them through. Defaults to both-false when omitted.
   */
  studentOptIns?: {
    hostel?: boolean;
    transport?: boolean;
  };
}

// ── Document-creation seam (test-overridable) ────────────────────────

export interface CreateCommitmentDocumentInput {
  collegeId: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  personId: Types.ObjectId | string;
  pinId: string;
  fileName: string;
  title: string;
  pdfBuffer: Buffer;
}

export interface CreateCommitmentDocumentResult {
  documentId: string;
}

export type CreateCommitmentDocumentFn = (
  input: CreateCommitmentDocumentInput,
) => Promise<CreateCommitmentDocumentResult>;

/**
 * Default persistence: writes an `ExitDocument` row. Base64-encodes the
 * buffer into metadata since the existing schema has no binary-blob
 * field. (An object-store URL would replace the base64 payload when
 * such infra is wired in — the seam keeps that swap local.)
 */
async function defaultCreateDocument(
  input: CreateCommitmentDocumentInput,
): Promise<CreateCommitmentDocumentResult> {
  const doc = await ExitDocument.create({
    collegeId: input.collegeId,
    studentId: input.studentId,
    type: 'bonafide',
    title: input.title,
    status: 'issued',
    generatedAt: new Date(),
    issuedAt: new Date(),
    signatures: [],
    metadata: {
      documentType: 'fee_commitment_sheet',
      fileName: input.fileName,
      pinId: input.pinId,
      personId: String(input.personId),
      pdfBase64: input.pdfBuffer.toString('base64'),
      size: input.pdfBuffer.length,
    },
  });
  return { documentId: String(doc._id) };
}

let _createDocumentImpl: CreateCommitmentDocumentFn = defaultCreateDocument;

/** Test-only: swap the document persistence implementation. */
export function __setCreateDocumentForTests(fn: CreateCommitmentDocumentFn): void {
  _createDocumentImpl = fn;
}

/** Test-only: restore the default document persistence. */
export function __resetCreateDocumentForTests(): void {
  _createDocumentImpl = defaultCreateDocument;
}

// ── Public API ────────────────────────────────────────────────────────

export async function generateSheet(
  studentId: string,
  pinId: string,
  opts: GenerateSheetOpts = {},
): Promise<GenerateSheetResult> {
  // 1. Load student.
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  // 2. Locate the pin.
  const pinIndex = student.feePins.findIndex((p) => String(p._id) === String(pinId));
  if (pinIndex === -1) throw new AppError(404, 'Fee pin not found on student');
  const pin = student.feePins[pinIndex]!;

  // Everything below step 3 is wrapped so we can flag the pin as
  // 'failed' on any error before rethrowing (worker retries).
  try {
    return await renderAndAttach(student, pin, pinIndex, opts, {
      supersedePrior: false,
    });
  } catch (err) {
    await markPinFailed(studentId, pinId);
    throw err;
  }
}

export async function regenerateForPin(
  studentId: string,
  pinId: string,
  opts: GenerateSheetOpts = {},
): Promise<GenerateSheetResult> {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const pinIndex = student.feePins.findIndex((p) => String(p._id) === String(pinId));
  if (pinIndex === -1) throw new AppError(404, 'Fee pin not found on student');
  const pin = student.feePins[pinIndex]!;

  try {
    return await renderAndAttach(student, pin, pinIndex, opts, {
      supersedePrior: true,
    });
  } catch (err) {
    await markPinFailed(studentId, pinId);
    throw err;
  }
}

// ── Core: render + attach ────────────────────────────────────────────

interface RenderAndAttachCtrl {
  supersedePrior: boolean;
}

async function renderAndAttach(
  student: IStudent,
  pin: IFeePin,
  pinIndex: number,
  opts: GenerateSheetOpts,
  ctrl: RenderAndAttachCtrl,
): Promise<GenerateSheetResult> {
  // 3. Load FSI + components.
  const fsi = await FeeStructureInstance.findById(pin.feeStructureInstanceId);
  if (!fsi) {
    throw new AppError(
      500,
      `FeeStructureInstance ${String(pin.feeStructureInstanceId)} referenced by pin ${String(pin._id)} not found`,
    );
  }
  const components = await FeeComponent.find({
    collegeId: student.collegeId,
    feeStructureInstanceId: fsi._id,
  }).lean();

  // 4. Load college (for header).
  const college = await College.findById(student.collegeId).lean();

  // 5. Load programme/branch/batch/person.
  const [programme, branch, batch, person] = await Promise.all([
    student.programmeId ? Programme.findById(student.programmeId).lean() : Promise.resolve(null),
    student.branchId ? Branch.findById(student.branchId).lean() : Promise.resolve(null),
    student.batchId ? Batch.findById(student.batchId).lean() : Promise.resolve(null),
    Person.findById(student.personId).lean(),
  ]);

  // 6. Evaluate FeeComponentRules (hostel/transport/etc). The existing
  //    helper returns the set of applicable component ids; we intersect
  //    it with our components list so conditional rows only render when
  //    the rule says so.
  const applicable = await evaluateFeeComponentRules(String(student.collegeId), {
    programmeId: String(student.programmeId ?? ''),
    quota: student.quota ?? 'convener',
    category: student.category,
    isHosteler: opts.studentOptIns?.hostel ?? false,
    transportRequired: opts.studentOptIns?.transport ?? false,
  });
  const applicableIds = new Set(applicable.map((a) => String(a.feeComponentId)));

  const visibleComponents = components
    .filter((c) => !c.isConditional || applicableIds.has(String(c._id)))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  // 7. FeeAgreement (reference only).
  const agreement = await FeeAgreement.findOne({
    collegeId: student.collegeId,
    studentId: student._id,
    status: 'active',
  }).lean();

  // 8. Build PDF.
  const renderer = new PdfRenderer({ compress: false });

  const collegeName = college?.name ?? 'College';
  const academicYearLabel = `AY ${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`;

  renderer.header({
    title: 'Fee Commitment Sheet',
    subtitle: `${collegeName} — ${academicYearLabel}`,
  });

  renderer.keyValueBlock([
    { label: 'Student Name', value: person?.name ?? 'Unknown' },
    { label: 'Roll No', value: student.rollNumber ?? '—' },
    { label: 'Programme', value: programme?.name ?? '—' },
    { label: 'Branch', value: branch?.name ?? '—' },
    { label: 'Batch', value: batch?.name ?? '—' },
    { label: 'Quota', value: student.quota ?? '—' },
    { label: 'Category', value: student.category ?? '—' },
    { label: 'Year of Study', value: String(pin.yearOfStudy) },
  ]);

  const grossTotal = visibleComponents.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  renderer.table({
    title: 'Fee Components',
    headers: ['Component', 'Category', 'Amount (INR)', 'Refundable?'],
    rows: visibleComponents.map((c) => [
      c.name,
      c.componentType,
      String(c.amount),
      c.isRefundable ? 'Yes' : 'No',
    ]),
  });

  renderer.totals({ label: 'Gross Total', amount: String(grossTotal), style: 'gross' });
  // At generation time we have no concession/scholarship stacking in
  // scope (spec: "Net Payable equals gross when no concessions
  // applied at this point"). Net = gross here.
  renderer.totals({ label: 'Net Payable', amount: String(grossTotal), style: 'net' });

  if (agreement) {
    renderer.keyValueBlock([
      { label: 'FeeAgreement Reference', value: `negotiatedTotal=${agreement.negotiatedTotal}` },
      {
        label: 'Agreement Status',
        value: `${agreement.status} (approved by ${agreement.approvalAuthority})`,
      },
    ]);
  }

  renderer.footer({
    left: `Generated ${new Date().toISOString().slice(0, 10)}`,
    center: `Pin id: ${String(pin._id)}`,
    right: '____ Student ____ Parent ____ Admissions',
  });

  const pdfBuffer = await renderer.build();

  // 9. Supersede prior document if regenerating.
  if (ctrl.supersedePrior && pin.commitmentSheetDocumentId) {
    const prior = await ExitDocument.findById(pin.commitmentSheetDocumentId);
    if (prior && prior.status !== 'revoked') {
      prior.status = 'revoked';
      prior.revokedAt = new Date();
      prior.revokedReason = 'superseded';
      await prior.save();
    }
  }

  // 10. Attach to document set via the M02-ish seam.
  const yearLabel = `${pin.yearOfStudy}`;
  const fileName = `fee-commitment-${yearLabel}-${String(pin._id)}.pdf`;
  const { documentId } = await _createDocumentImpl({
    collegeId: student.collegeId as unknown as Types.ObjectId,
    studentId: student._id as Types.ObjectId,
    personId: student.personId as unknown as Types.ObjectId,
    pinId: String(pin._id),
    fileName,
    title: 'Fee Commitment Sheet',
    pdfBuffer,
  });

  // 11. Update pin on the Student doc. Re-load to avoid stomping any
  //     concurrent writes that happened during rendering (e.g., a
  //     parallel archive).
  const freshStudent = await Student.findById(student._id);
  if (freshStudent) {
    const freshPin = freshStudent.feePins.find((p) => String(p._id) === String(pin._id));
    if (freshPin) {
      freshPin.commitmentSheetDocumentId = new Types.ObjectId(documentId);
      freshPin.commitmentSheetStatus = 'generated';
      await freshStudent.save();
    }
  } else {
    // Fallback: write through the original doc.
    const hit = student.feePins[pinIndex];
    if (hit) {
      hit.commitmentSheetDocumentId = new Types.ObjectId(documentId);
      hit.commitmentSheetStatus = 'generated';
      await student.save();
    }
  }

  // 12. Audit.
  await createAuditLog({
    collegeId: String(student.collegeId),
    entityType: 'Student',
    entityId: String(student._id),
    entityName: `Student#${String(student._id)}`,
    studentId: String(student._id),
    action: 'create',
    changes: [
      {
        field: 'feePins.commitmentSheetDocumentId',
        displayName: 'Commitment Sheet Document',
        oldValue: null,
        newValue: {
          pinId: String(pin._id),
          documentId,
          superseded: ctrl.supersedePrior,
        },
      },
    ],
    performedBy: 'system:commitment-sheet',
  });

  return { documentId, pdfBuffer };
}

async function markPinFailed(studentId: string, pinId: string): Promise<void> {
  try {
    const student = await Student.findById(studentId);
    if (!student) return;
    const pin = student.feePins.find((p) => String(p._id) === String(pinId));
    if (!pin) return;
    pin.commitmentSheetStatus = 'failed';
    await student.save();
  } catch {
    // Best-effort: swallow secondary failures so the original error
    // bubbles to the caller / BullMQ.
  }
}
