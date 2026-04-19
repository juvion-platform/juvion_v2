/**
 * Global people search service.
 *
 * Cross-role query: returns matching Students, Faculty, Staff, Parents,
 * and Alumni in one call. Multi-tenant-scoped via `collegeId`; RBAC-aware
 * via the existing `applyAuthScope` helper so department-scoped HODs see
 * only their dept's people, etc.
 *
 * See:
 *   - .captain/specs/global-people-search/spec.md
 *   - .captain/specs/global-people-search/plan.md §1.4
 *
 * Design notes:
 *   - Runs 5 parallel role-scoped queries (Promise.all) rather than one
 *     super-aggregation, for index-optimization + readability.
 *   - Each query Phase 1 resolves matching Person._ids via a single Person
 *     regex query; Phase 2 joins via personId + role-specific direct-match
 *     fields (rollNumber / employeeCode).
 *   - Regex meta-characters in the query are escaped so users can't craft
 *     regex bombs or accidentally match every record with `.`.
 *   - Phone matching normalizes both sides to digits-only before comparing.
 *   - Response NEVER includes phone/email/dob/aadhaar/address — only the
 *     minimum identifying fields defined in SearchResult.
 */

import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { Parent } from '../../models/people/Parent';
import { Alumni } from '../../models/people/Alumni';
import { Branch } from '../../models/academic-structure/Branch';
import { Programme } from '../../models/academic-structure/Programme';
import { applyAuthScope } from '../../shared/rbac/apply-scope';
import { AuthScope } from '../../shared/rbac/types';

export type PersonRole = 'student' | 'faculty' | 'staff' | 'parent' | 'alumni';

export interface SearchResult {
  _id: string;
  role: PersonRole;
  personId: string;
  name: string;
  photo?: string;
  identifier?: string;
  identifierLabel: string;
  department?: string;
  status?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  counts: Record<PersonRole, number>;
  totalMatched: number;
  hasMore: boolean;
}

export interface SearchOptions {
  limit?: number;             // default 10, max 25
  includeInactive?: boolean;  // default false
  authScope?: AuthScope;
}

// Regex meta-chars that need escaping before building a case-insensitive substring RegExp.
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(REGEX_META, '\\$&');
}

/** Strip all non-digits — used for phone normalization on both query + stored values. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Main entry point. Runs the 5 parallel role-scoped queries, merges +
 * ranks the results, returns the `SearchResponse` contract.
 */
export async function searchPeople(
  collegeId: string,
  rawQuery: string,
  opts: SearchOptions = {},
): Promise<SearchResponse> {
  const { authScope, includeInactive = false } = opts;
  const limit = Math.min(Math.max(1, opts.limit ?? 10), 25);

  // Defensive truncate + trim; upstream Zod should have done this but
  // service-layer shouldn't trust caller.
  const query = String(rawQuery ?? '').trim().slice(0, 100);
  if (query.length < 2) {
    return emptyResponse();
  }

  const escaped = escapeRegex(query);
  const digitQuery = digitsOnly(query);

  // Phase 1: find matching Person._ids.
  //
  // Two-step strategy:
  //   1. DB-side: broad fetch of candidates where name OR email OR phone
  //      has ANY plausible match. Phone regex uses a permissive digits-with-
  //      non-digits-between pattern (e.g. 9\D*9\D*9 for query 999).
  //   2. JS-side: exact symmetric-digits filter for phone matches — handles
  //      country-code variants ("+91 9998..." vs stored "9998...").
  const personOr: Record<string, unknown>[] = [
    { name:  { $regex: escaped, $options: 'i' } },
    { email: { $regex: escaped, $options: 'i' } },
  ];
  const hasPhoneQuery = digitQuery.length >= 4;
  if (hasPhoneQuery) {
    // Permissive regex — anchored to digit sequence with any-non-digit gaps.
    // Build patterns for several digit-subsequences so e.g. "+91 9998 887777"
    // (12 digits) still matches a stored "9998887777" (10 digits, no
    // country code). The JS-side symmetric filter below enforces the
    // actual match semantics; this stage only needs to prefetch a
    // superset of candidates.
    const patterns = new Set<string>();
    patterns.add(digitQuery.split('').join('\\D*'));
    if (digitQuery.length > 10) {
      patterns.add(digitQuery.slice(-10).split('').join('\\D*')); // strip country code
    }
    if (digitQuery.length > 4) {
      patterns.add(digitQuery.slice(0, 10).split('').join('\\D*')); // strip trailing digits
    }
    for (const p of patterns) {
      personOr.push({ phone:          { $regex: p } });
      personOr.push({ alternatePhone: { $regex: p } });
    }
  }

  const nameOrEmailRe = new RegExp(escaped, 'i');
  const candidatePersons = await Person.find(
    { collegeId, $or: personOr },
    { _id: 1, name: 1, email: 1, phone: 1, alternatePhone: 1 },
  ).limit(200).lean();

  // Post-filter: reconfirm match on normalized digits (phone) or the
  // plain regex (name/email) so we don't accept a loose phone-only
  // prefetch that shouldn't have matched.
  const personIds = candidatePersons
    .filter((p) => {
      if (p.name && nameOrEmailRe.test(p.name)) return true;
      if (p.email && nameOrEmailRe.test(p.email)) return true;
      if (!hasPhoneQuery) return false;
      const phoneDigits = digitsOnly(String(p.phone ?? ''));
      const altDigits   = digitsOnly(String(p.alternatePhone ?? ''));
      // Symmetric containment — query-contains-phone OR phone-contains-query,
      // so "+91 9998 887777" (12d) matches stored "9998887777" (10d).
      const contains = (a: string, b: string) => a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
      return contains(phoneDigits, digitQuery) || contains(altDigits, digitQuery);
    })
    .map((p) => p._id);

  // Phase 2: 5 parallel role queries
  const [students, facultyList, staffList, parents, alumni] = await Promise.all([
    searchStudents({ collegeId, escaped, personIds, includeInactive, authScope, limit }),
    searchFaculty({ collegeId, escaped, personIds, includeInactive, authScope, limit }),
    searchStaff({ collegeId, escaped, personIds, includeInactive, authScope, limit }),
    searchParents({ collegeId, personIds, authScope, limit }),
    searchAlumni({ collegeId, personIds, authScope, limit }),
  ]);

  const counts: Record<PersonRole, number> = {
    student: students.matchedCount,
    faculty: facultyList.matchedCount,
    staff: staffList.matchedCount,
    parent: parents.matchedCount,
    alumni: alumni.matchedCount,
  };
  const totalMatched =
    counts.student + counts.faculty + counts.staff + counts.parent + counts.alumni;

  // Merge; keep per-role slice up to `limit` total (spec grouping handled
  // on client — backend returns up to `limit` across all roles, biased
  // toward earlier roles in the order above; client can also group).
  const merged: SearchResult[] = [
    ...students.results,
    ...facultyList.results,
    ...staffList.results,
    ...parents.results,
    ...alumni.results,
  ].slice(0, limit);

  const hasMore =
    students.matchedCount > students.results.length ||
    facultyList.matchedCount > facultyList.results.length ||
    staffList.matchedCount > staffList.results.length ||
    parents.matchedCount > parents.results.length ||
    alumni.matchedCount > alumni.results.length ||
    merged.length < totalMatched;

  return { results: merged, counts, totalMatched, hasMore };
}

function emptyResponse(): SearchResponse {
  return {
    results: [],
    counts: { student: 0, faculty: 0, staff: 0, parent: 0, alumni: 0 },
    totalMatched: 0,
    hasMore: false,
  };
}

// ─────────────────────────────────────────────────────────────
// Per-role search functions
// ─────────────────────────────────────────────────────────────

// Role queries split into two shapes:
//   - PerRoleArgsText: roles that also match on their own string field
//     (rollNumber / employeeCode) — need `escaped` and `includeInactive`.
//   - PerRoleArgs: roles that only match via Person-linked personIds.
interface PerRoleArgsText {
  collegeId: string;
  escaped: string;
  personIds: unknown[];
  includeInactive: boolean;
  authScope?: AuthScope;
  limit: number;
}

interface PerRoleArgs {
  collegeId: string;
  personIds: unknown[];
  authScope?: AuthScope;
  limit: number;
}

interface PerRoleResult {
  results: SearchResult[];
  matchedCount: number;
}

async function searchStudents(args: PerRoleArgsText): Promise<PerRoleResult> {
  const { collegeId, escaped, personIds, includeInactive, authScope, limit } = args;

  const filter: Record<string, unknown> = {
    collegeId,
    $or: [
      { rollNumber: { $regex: escaped, $options: 'i' } },
      { personId:   { $in: personIds } },
    ],
  };
  if (!includeInactive) filter.status = 'active';
  // Student has no direct `departmentId` — resolve via Branch → Department
  // when HOD scope is active.
  if (authScope?.departmentOnly && authScope.departmentId) {
    const branches = await Branch.find(
      { collegeId, departmentId: authScope.departmentId },
      { _id: 1 },
    ).lean();
    filter.branchId = { $in: branches.map((b) => b._id) };
  }

  const [docs, matchedCount] = await Promise.all([
    Student.find(filter)
      .populate('personId', 'name photo')
      .populate({ path: 'branchId', select: 'name departmentId', populate: { path: 'departmentId', select: 'name' } })
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  const results: SearchResult[] = docs.map((d) => {
    const person = d.personId as unknown as { _id: unknown; name?: string; photo?: string } | null;
    const branch = d.branchId as unknown as { _id?: unknown; name?: string; departmentId?: { name?: string } } | null;
    return {
      _id: String(d._id),
      role: 'student' as const,
      personId: String(person?._id ?? ''),
      name: person?.name ?? '(no name)',
      photo: person?.photo,
      identifier: d.rollNumber,
      identifierLabel: 'Roll No',
      department: branch?.departmentId?.name ?? branch?.name,
      status: d.status,
    };
  });
  return { results, matchedCount };
}

async function searchFaculty(args: PerRoleArgsText): Promise<PerRoleResult> {
  const { collegeId, escaped, personIds, includeInactive, authScope, limit } = args;
  const filter: Record<string, unknown> = {
    collegeId,
    $or: [
      { employeeCode: { $regex: escaped, $options: 'i' } },
      { personId:     { $in: personIds } },
    ],
  };
  if (!includeInactive) filter.status = 'active';
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });

  const [docs, matchedCount] = await Promise.all([
    Faculty.find(filter)
      .populate('personId', 'name photo')
      .populate('departmentId', 'name')
      .limit(limit)
      .lean(),
    Faculty.countDocuments(filter),
  ]);

  const results: SearchResult[] = docs.map((d) => {
    const person = d.personId as unknown as { _id: unknown; name?: string; photo?: string } | null;
    const dept = d.departmentId as unknown as { name?: string } | null;
    return {
      _id: String(d._id),
      role: 'faculty' as const,
      personId: String(person?._id ?? ''),
      name: person?.name ?? '(no name)',
      photo: person?.photo,
      identifier: d.employeeCode,
      identifierLabel: 'Employee Code',
      department: dept?.name,
      status: d.status,
    };
  });
  return { results, matchedCount };
}

async function searchStaff(args: PerRoleArgsText): Promise<PerRoleResult> {
  const { collegeId, escaped, personIds, includeInactive, authScope, limit } = args;
  const filter: Record<string, unknown> = {
    collegeId,
    $or: [
      { employeeCode: { $regex: escaped, $options: 'i' } },
      { personId:     { $in: personIds } },
    ],
  };
  if (!includeInactive) filter.status = 'active';
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });

  const [docs, matchedCount] = await Promise.all([
    Staff.find(filter)
      .populate('personId', 'name photo')
      .populate('departmentId', 'name')
      .limit(limit)
      .lean(),
    Staff.countDocuments(filter),
  ]);

  const results: SearchResult[] = docs.map((d) => {
    const person = d.personId as unknown as { _id: unknown; name?: string; photo?: string } | null;
    const dept = d.departmentId as unknown as { name?: string } | null;
    return {
      _id: String(d._id),
      role: 'staff' as const,
      personId: String(person?._id ?? ''),
      name: person?.name ?? '(no name)',
      photo: person?.photo,
      identifier: d.employeeCode,
      identifierLabel: 'Employee Code',
      department: dept?.name,
      status: d.status,
    };
  });
  return { results, matchedCount };
}

async function searchParents(args: PerRoleArgs): Promise<PerRoleResult> {
  const { collegeId, personIds, authScope, limit } = args;
  // Parent has no local string-field to match directly; we only get here
  // via Person.name match.
  const filter: Record<string, unknown> = {
    collegeId,
    personId: { $in: personIds },
  };
  // Parents have no departmentId — HOD dept scope doesn't apply to them.
  // If the caller is strictly dept-scoped, we return empty (conservative).
  if (authScope?.departmentOnly) {
    return { results: [], matchedCount: 0 };
  }
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });

  const [docs, matchedCount] = await Promise.all([
    Parent.find(filter)
      .populate('personId', 'name photo')
      .populate('linkedStudents', 'rollNumber')
      .limit(limit)
      .lean(),
    Parent.countDocuments(filter),
  ]);

  const results: SearchResult[] = docs.map((d) => {
    const person = d.personId as unknown as { _id: unknown; name?: string; photo?: string } | null;
    const linked = (d.linkedStudents ?? []) as unknown as Array<{ rollNumber?: string }>;
    const rolls = linked.map((s) => s.rollNumber).filter(Boolean);
    return {
      _id: String(d._id),
      role: 'parent' as const,
      personId: String(person?._id ?? ''),
      name: person?.name ?? '(no name)',
      photo: person?.photo,
      identifier: rolls.length > 0 ? rolls.join(', ') : '(no linked students)',
      identifierLabel: 'Parent of',
    };
  });
  return { results, matchedCount };
}

async function searchAlumni(args: PerRoleArgs): Promise<PerRoleResult> {
  const { collegeId, personIds, authScope, limit } = args;
  const filter: Record<string, unknown> = {
    collegeId,
    personId: { $in: personIds },
  };
  // Alumni dept-scope: resolve via programmeId → departmentId. For HOD
  // scope we fetch the dept's programmes first.
  if (authScope?.departmentOnly && authScope.departmentId) {
    const programmes = await Programme.find(
      { collegeId, departmentId: authScope.departmentId },
      { _id: 1 },
    ).lean();
    filter.programmeId = { $in: programmes.map((p) => p._id) };
  } else if (authScope) {
    applyAuthScope(filter, authScope, { selfField: 'personId' });
  }

  const [docs, matchedCount] = await Promise.all([
    Alumni.find(filter)
      .populate('personId', 'name photo')
      .populate('programmeId', 'name')
      // branchId → departmentId is the reliable path to department name
      // (Programme in this codebase has no departmentId field).
      .populate({
        path: 'branchId',
        select: 'name departmentId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .limit(limit)
      .lean(),
    Alumni.countDocuments(filter),
  ]);

  const results: SearchResult[] = docs.map((d) => {
    const person = d.personId as unknown as { _id: unknown; name?: string; photo?: string } | null;
    const prog = d.programmeId as unknown as { name?: string } | null;
    const branch = d.branchId as unknown as { name?: string; departmentId?: { name?: string } } | null;
    // Prefer department name (resolved via branch → department); fall back
    // to programme name; fall back to branch name.
    const deptName = branch?.departmentId?.name ?? prog?.name ?? branch?.name;
    const gradYear = d.graduationDate ? new Date(d.graduationDate).getFullYear() : undefined;
    return {
      _id: String(d._id),
      role: 'alumni' as const,
      personId: String(person?._id ?? ''),
      name: person?.name ?? '(no name)',
      photo: person?.photo,
      identifier: gradYear ? `Class of ${gradYear}` : undefined,
      identifierLabel: 'Batch',
      department: deptName,
    };
  });
  return { results, matchedCount };
}
