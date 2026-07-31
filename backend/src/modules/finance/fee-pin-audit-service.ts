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

import { Student, IStudent } from '../../models/people/Student';
import { Person } from '../../models/people/Person';
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
import { resolveMatchingFeeStructureInstance } from './fee-pin-service';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { Invoice } from '../../models/finance/Invoice';
import { resolveStudentYearOfStudy } from './resolve-year-of-study';

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Why a student needs attention. The distinction is the whole point of the
 * report: each reason has a different owner and a different fix.
 */
export type CoverageReason =
  /** Matcher returns nothing for these axes. Finance must publish a structure. */
  | 'no-matching-structure'
  /** A structure exists and would match — nobody has pinned them yet. One click. */
  | 'never-pinned'
  /** Year-of-study cannot be derived (no batch). The Registrar must assign one. */
  | 'year-unresolvable'
  /** Pinned, but unpayable: no fee-responsible guardian, so payment refuses them. */
  | 'no-fee-responsible-guardian';

/**
 * The reasons that mean "has no usable pin". `no-fee-responsible-guardian` is
 * deliberately NOT one of them — those students ARE pinned, they just cannot
 * be charged yet — so anything reporting pin coverage must ask for these
 * explicitly rather than for everything flagged.
 */
export const PIN_MISSING_REASONS: readonly CoverageReason[] = [
  'no-matching-structure', 'never-pinned', 'year-unresolvable',
];

export interface CoverageStudent {
  studentId: string;
  name: string;
  /** Kept alongside the code for the audit snapshot, which stores ids. */
  programmeId: string | null;
  rollNumber?: string;
  programmeCode?: string;
  branchCode?: string;
  quota?: string;
  category?: string;
  /** 0 when it could not be derived. */
  yearOfStudy: number;
  reason: CoverageReason;
}

/**
 * Flagged students collapsed onto their fee axes. This is how Finance acts on
 * the report — "BTECH / CSE / convener / Year 1 — 46 students, no structure
 * published" is one task; the same 46 rows are noise.
 */
export interface CoverageGroup {
  reason: CoverageReason;
  programmeCode?: string;
  branchCode?: string;
  quota?: string;
  category?: string;
  yearOfStudy: number;
  count: number;
}

export interface CoverageReport {
  collegeId: string;
  totalActiveStudents: number;
  studentsWithActivePinForCurrentYear: number;
  coveragePercent: number;
  /** Every reason present, whether or not the current page shows one. */
  counts: Record<CoverageReason, number>;
  /** Rolled up over ALL flagged students, not just the page. */
  groups: CoverageGroup[];
  /** Paginated. `total` is the full flagged count. */
  students: CoverageStudent[];
  page: number;
  limit: number;
  total: number;
}

export interface CoverageOpts {
  page?: number;
  limit?: number;
  reason?: CoverageReason | readonly CoverageReason[];
}

const COVERAGE_MAX_LIMIT = 200;

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
export async function getCoverage(
  collegeId: string,
  opts: CoverageOpts = {},
): Promise<CoverageReport> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(Math.max(1, opts.limit ?? 50), COVERAGE_MAX_LIMIT);
  const collegeOid = new Types.ObjectId(collegeId);

  const students = await Student.find({ collegeId: collegeOid, status: 'active' })
    // collegeId is projected because the lean doc is handed to
    // resolveMatchingFeeStructureInstance, whose base filter reads it —
    // omitting it silently matches nothing.
    .select({
      _id: 1, collegeId: 1, personId: 1, rollNumber: 1, programmeId: 1, branchId: 1,
      quota: 1, category: 1, feePins: 1, feeResponsibleParentId: 1,
    })
    .lean();

  const [programmes, branches] = await Promise.all([
    Programme.find({ collegeId: collegeOid }).select({ _id: 1, code: 1 }).lean(),
    Branch.find({ collegeId: collegeOid }).select({ _id: 1, code: 1 }).lean(),
  ]);
  const codeOf = (
    list: Array<{ _id: unknown; code?: string }>,
    id: unknown,
  ): string | undefined => {
    if (!id) return undefined;
    return list.find((x) => String(x._id) === String(id))?.code;
  };

  // A cohort shares axis tuples, so the matcher is asked the same question
  // hundreds of times. Memoised per report — this is a read-only projection,
  // never a write path.
  const matchMemo = new Map<string, boolean>();
  async function structureExistsFor(
    student: (typeof students)[number],
    yearOfStudy: number,
  ): Promise<boolean> {
    const key = [
      String(student.programmeId ?? ''), String(student.branchId ?? ''),
      student.quota ?? '', student.category ?? '', yearOfStudy,
    ].join('|');
    const memo = matchMemo.get(key);
    if (memo !== undefined) return memo;
    let found = false;
    try {
      const ay = await resolveStudentYearOfStudy(String(student._id));
      found = Boolean(
        await resolveMatchingFeeStructureInstance(
          student as unknown as IStudent,
          yearOfStudy,
          { academicYearId: ay.academicYearId },
        ),
      );
    } catch {
      found = false;
    }
    matchMemo.set(key, found);
    return found;
  }

  let withActivePin = 0;
  const flagged: Array<CoverageStudent & { personId: unknown }> = [];

  for (const s of students) {
    const axes = {
      programmeId: s.programmeId ? String(s.programmeId) : null,
      rollNumber: s.rollNumber,
      programmeCode: codeOf(programmes, s.programmeId),
      branchCode: codeOf(branches, s.branchId),
      quota: s.quota,
      category: s.category,
    };

    // Year-of-study comes from the canonical helper, which needs a Batch.
    // A student without one is not "unpinned" — we cannot even say which
    // year to look at — so it is its own reason, owned by the Registrar.
    let yearOfStudy = 0;
    try {
      yearOfStudy = (await resolveStudentYearOfStudy(String(s._id))).yearOfStudy;
    } catch {
      yearOfStudy = 0;
    }

    if (yearOfStudy === 0) {
      flagged.push({
        studentId: String(s._id), personId: s.personId, name: '',
        ...axes, yearOfStudy, reason: 'year-unresolvable',
      });
      continue;
    }

    const pins = (s.feePins ?? []) as unknown as Array<{
      yearOfStudy: number; archivedAt?: Date | null;
    }>;
    const hasActive = pins.some((p) => p.yearOfStudy === yearOfStudy && !p.archivedAt);

    if (hasActive) {
      withActivePin += 1;
      // Pinned is not the same as payable: `assertStudentFeeGuardianReady`
      // refuses a payment without a fee-responsible guardian, and nothing
      // else surfaces that until someone tries to pay.
      if (!s.feeResponsibleParentId) {
        flagged.push({
          studentId: String(s._id), personId: s.personId, name: '',
          ...axes, yearOfStudy, reason: 'no-fee-responsible-guardian',
        });
      }
      continue;
    }

    flagged.push({
      studentId: String(s._id), personId: s.personId, name: '',
      ...axes, yearOfStudy,
      reason: (await structureExistsFor(s, yearOfStudy))
        ? 'never-pinned'
        : 'no-matching-structure',
    });
  }

  const wanted = opts.reason
    ? new Set(Array.isArray(opts.reason) ? opts.reason : [opts.reason])
    : null;
  const filtered = wanted ? flagged.filter((f) => wanted.has(f.reason)) : flagged;

  const counts: Record<CoverageReason, number> = {
    'no-matching-structure': 0,
    'never-pinned': 0,
    'year-unresolvable': 0,
    'no-fee-responsible-guardian': 0,
  };
  for (const f of flagged) counts[f.reason] += 1;

  const groupMap = new Map<string, CoverageGroup>();
  for (const f of filtered) {
    const key = [
      f.reason, f.programmeCode ?? '', f.branchCode ?? '',
      f.quota ?? '', f.category ?? '', f.yearOfStudy,
    ].join('|');
    const existing = groupMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(key, {
        reason: f.reason,
        programmeCode: f.programmeCode,
        branchCode: f.branchCode,
        quota: f.quota,
        category: f.category,
        yearOfStudy: f.yearOfStudy,
        count: 1,
      });
    }
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);

  // Names are fetched for the page only — the rollup needs axes, not people,
  // and a 10,000-student college would otherwise load every Person to render
  // fifty rows.
  const pageSlice = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);
  const persons = pageSlice.length
    ? await Person.find({
      collegeId: collegeOid,
      _id: { $in: pageSlice.map((f) => f.personId) },
    }).select({ _id: 1, name: 1 }).lean()
    : [];
  const nameById = new Map(persons.map((pn) => [String(pn._id), pn.name]));

  const total = students.length;
  return {
    collegeId,
    totalActiveStudents: total,
    studentsWithActivePinForCurrentYear: withActivePin,
    coveragePercent: total === 0 ? 100 : Math.round((withActivePin / total) * 10000) / 100,
    counts,
    groups,
    students: pageSlice.map(({ personId: _personId, ...rest }) => ({
      ...rest,
      name: nameById.get(String(_personId)) ?? '',
    })),
    page,
    limit,
    total: filtered.length,
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
