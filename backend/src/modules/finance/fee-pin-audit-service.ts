/**
 * fee-pin-audit-service (Task 12 — Fee Configuration)
 *
 * Thin read-model aggregation for the two audit endpoints exposed by
 * Task 12:
 *   - `GET /api/finance/pin-audit/coverage` — % of active students with
 *      an active pin for their current year-of-study.
 *   - `GET /api/finance/pin-audit/invariants` — invoice/pinned-structure
 *      total mismatches (invariant breach detector).
 *
 * These endpoints expose live metrics for the Finance dashboard until
 * the nightly `fee-pin-audit` BullMQ job (Task 17) writes historical
 * snapshots to a dedicated collection.
 *
 * Year-of-study derivation uses the canonical `resolveStudentYearOfStudy`
 * helper (T20, OQ-11). If a student's year-of-study can't be resolved
 * (missing Batch, missing active AcademicYear, etc.) they are classified
 * as "missing pin" so Finance can investigate the upstream data issue.
 *
 * Spec: .captain/specs/fee-configuration/spec.md
 * Plan: .captain/specs/fee-configuration/plan.md §1.9, §5
 * Tasks: .captain/specs/fee-configuration/tasks.md §Task 12, §Task 20
 */

import { Types } from 'mongoose';

import { Student } from '../../models/people/Student';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { Invoice } from '../../models/finance/Invoice';
import { resolveStudentYearOfStudy } from './resolve-year-of-study';

// ── Types ─────────────────────────────────────────────────────────────

export interface CoverageMissingStudent {
  studentId: string;
  rollNumber?: string;
  programmeId: string | null;
  currentYearOfStudy: number;
}

export interface CoverageReport {
  collegeId: string;
  totalActiveStudents: number;
  studentsWithActivePinForCurrentYear: number;
  coveragePercent: number;
  studentsMissingPin: CoverageMissingStudent[];
}

export interface InvariantMismatch {
  invoiceId: string;
  studentId: string;
  pinId: string;
  pinnedTotal: number;
  invoiceTotal: number;
  delta: number;
}

export interface InvariantReport {
  collegeId: string;
  totalInvoicesChecked: number;
  mismatches: InvariantMismatch[];
}

// ── Coverage ──────────────────────────────────────────────────────────

/**
 * Compute pin-coverage for a college.
 *
 * Active students (status='active') only. For each, derive current
 * year-of-study (placeholder: 1 — see T20) and check whether
 * `Student.feePins[]` has a non-archived pin for that year.
 *
 * The `studentsMissingPin` list is capped at 500 entries to keep the
 * payload bounded; the dashboard only needs a sample to drive
 * triage, not an exhaustive dump.
 */
export async function getCoverage(collegeId: string): Promise<CoverageReport> {
  const collegeFilter = { collegeId: new Types.ObjectId(collegeId), status: 'active' };

  const students = await Student.find(collegeFilter)
    .select({ _id: 1, rollNumber: 1, programmeId: 1, feePins: 1 })
    .lean();

  let withActivePin = 0;
  const missing: CoverageMissingStudent[] = [];

  for (const s of students) {
    // Year-of-study resolved via the canonical T20 helper (OQ-11).
    // If resolution fails (missing batch, missing active AY, etc.) the
    // student is treated as "yearOfStudy unknown" and classified as
    // missing-pin so Finance can investigate.
    let currentYearOfStudy = 0;
    try {
      const resolved = await resolveStudentYearOfStudy(String(s._id));
      currentYearOfStudy = resolved.yearOfStudy;
    } catch {
      // Leave as 0 — falls into the "missing" branch below.
    }

    const pins = (s.feePins ?? []) as unknown as Array<{
      yearOfStudy: number;
      archivedAt?: Date | null;
    }>;
    const hasActive = currentYearOfStudy > 0 && pins.some(
      (p) => p.yearOfStudy === currentYearOfStudy && !p.archivedAt,
    );
    if (hasActive) {
      withActivePin += 1;
    } else if (missing.length < 500) {
      missing.push({
        studentId: String(s._id),
        rollNumber: s.rollNumber,
        programmeId: s.programmeId ? String(s.programmeId) : null,
        currentYearOfStudy,
      });
    }
  }

  const total = students.length;
  const coveragePercent =
    total === 0 ? 100 : Math.round((withActivePin / total) * 10000) / 100;

  return {
    collegeId,
    totalActiveStudents: total,
    studentsWithActivePinForCurrentYear: withActivePin,
    coveragePercent,
    studentsMissingPin: missing,
  };
}

// ── Invariants ────────────────────────────────────────────────────────

/**
 * Compare invoice totals against their source pin's FeeStructureInstance
 * total. V1 scope: the latest 500 invoices per college to keep the
 * endpoint cheap — the nightly audit job (T17) handles exhaustive
 * aggregation.
 *
 * An invoice counts as a mismatch when `Invoice.totalAmount !==
 * FeeStructureInstance.totalAmount` for the pin the invoice lines were
 * sourced from. Invoices with a FeeAgreement override are excluded
 * because their totals are intentionally negotiated away from the pin.
 */
export async function getInvariants(collegeId: string): Promise<InvariantReport> {
  const invoices = await Invoice.find({
    collegeId: new Types.ObjectId(collegeId),
    feeAgreementId: { $in: [null, undefined] },
  })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const mismatches: InvariantMismatch[] = [];

  if (invoices.length === 0) {
    return { collegeId, totalInvoicesChecked: 0, mismatches };
  }

  // Preload all students referenced — reduces N+1 roundtrips.
  const studentIds = Array.from(
    new Set(invoices.map((i) => String(i.studentId)).filter(Boolean)),
  ).map((id) => new Types.ObjectId(id));

  const students = studentIds.length
    ? await Student.find({ _id: { $in: studentIds } })
        .select({ _id: 1, feePins: 1 })
        .lean()
    : [];
  const studentById = new Map<string, (typeof students)[number]>();
  for (const s of students) studentById.set(String(s._id), s);

  // Preload structures that could back any of the invoices' active pins.
  const fsiIds = new Set<string>();
  for (const s of students) {
    const pins = (s.feePins ?? []) as unknown as Array<{
      feeStructureInstanceId?: Types.ObjectId;
    }>;
    for (const p of pins) {
      if (p.feeStructureInstanceId) fsiIds.add(String(p.feeStructureInstanceId));
    }
  }
  const fsis = fsiIds.size
    ? await FeeStructureInstance.find({
        _id: { $in: Array.from(fsiIds).map((id) => new Types.ObjectId(id)) },
      })
        .select({ _id: 1, totalAmount: 1 })
        .lean()
    : [];
  const fsiById = new Map<string, (typeof fsis)[number]>();
  for (const f of fsis) fsiById.set(String(f._id), f);

  for (const inv of invoices) {
    if (!inv.studentId) continue;
    const student = studentById.get(String(inv.studentId));
    if (!student) continue;
    const pins = (student.feePins ?? []) as unknown as Array<{
      _id: Types.ObjectId;
      archivedAt?: Date | null;
      feeStructureInstanceId: Types.ObjectId;
    }>;
    const activePin = pins.find((p) => !p.archivedAt);
    if (!activePin) continue;
    const fsi = fsiById.get(String(activePin.feeStructureInstanceId));
    if (!fsi) continue;

    const pinnedTotal = Number(fsi.totalAmount ?? 0);
    const invoiceTotal = Number(inv.totalAmount ?? 0);
    if (pinnedTotal !== invoiceTotal) {
      mismatches.push({
        invoiceId: String(inv._id),
        studentId: String(inv.studentId),
        pinId: String(activePin._id),
        pinnedTotal,
        invoiceTotal,
        delta: invoiceTotal - pinnedTotal,
      });
    }
  }

  return {
    collegeId,
    totalInvoicesChecked: invoices.length,
    mismatches,
  };
}
