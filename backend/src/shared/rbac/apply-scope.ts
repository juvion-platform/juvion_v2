import { Model, FilterQuery, Types } from 'mongoose';
import { AuthScope } from './types';

export interface ScopeFieldOptions {
  /**
   * Field name to filter on for departmentOnly scope.
   * Default: 'departmentId'. Pass 'branchId' for student-shaped records: the
   * filter then uses the branches under the caller's department, and the
   * assigned scope (if any) matches the record's own `_id` against the
   * caller's students unless `assignedField` says otherwise.
   */
  departmentField?: string;

  /**
   * Field name to filter on for selfOnly scope.
   * Default: 'createdBy' (falls back to userId)
   *
   * Common values:
   * - 'studentId' for student-linked records (fees, enrollments)
   * - 'personId' for person-linked records (faculty profiles)
   * - 'employeeId' for employee-linked records (HR)
   * - 'createdBy' for generic ownership
   */
  selfField?: string;

  /**
   * 010 P2 — which record fields the assigned id sets match. Example for a
   * course-offering list: `{ courseOfferingIds: '_id', sectionIds: 'sectionId' }`.
   * Omitted: student-shaped records (`departmentField: 'branchId'`) default
   * to `{ studentIds: '_id' }`; anything else ignores the assigned scope
   * (and therefore, when assigned is the only narrowing, yields zero rows).
   */
  assignedField?: { studentIds?: string; sectionIds?: string; courseOfferingIds?: string };
}

/** Non-enumerable marker so `paginate()` can tell a scoped filter from a forgotten one. */
const SCOPE_APPLIED = Symbol('rbac.scopeApplied');

/** A filter that can never match. Fail closed, never open. */
const NOTHING = { $in: [] as string[] };

/**
 * Ids arrive as strings. `find()` casts them, but `aggregate([{ $match }])`
 * does not — a string never equals an ObjectId there, so a scoped aggregate
 * silently returned nothing. Cast anything that is a valid ObjectId.
 */
function oid(v: string): string | Types.ObjectId {
  return /^[0-9a-fA-F]{24}$/.test(v) ? new Types.ObjectId(v) : v;
}

export function scopeNarrows(authScope: AuthScope | undefined): boolean {
  return !!authScope && (authScope.departmentOnly || authScope.selfOnly || !!authScope.assignedVia?.length);
}

export function isScopeApplied(filter: object): boolean {
  return (filter as any)[SCOPE_APPLIED] === true;
}

function mark(filter: object): void {
  Object.defineProperty(filter, SCOPE_APPLIED, { value: true, enumerable: false });
}

/**
 * Mutates the given filter object to add scope constraints from AuthScope.
 *
 * This is the single integration point between the RBAC middleware and
 * service-layer queries. Call this in any service list function that uses
 * paginate() or builds a Mongoose filter.
 *
 * 010 — fails closed: a department-only scope with no resolvable department,
 * or a self-only scope on a person-linked field with no linked person, yields
 * zero rows instead of the whole college.
 *
 * Example:
 *   const filter: any = { collegeId };
 *   if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
 *   return paginate(FeeLineItem, filter, page, limit);
 */
export function applyAuthScope(
  filter: Record<string, unknown>,
  authScope: AuthScope,
  opts?: ScopeFieldOptions,
): void {
  mark(filter);
  const clauses: Record<string, unknown>[] = [];

  // Department scoping: HOD/faculty sees only their department's data
  if (authScope.departmentOnly) {
    const field = opts?.departmentField ?? 'departmentId';
    if (!authScope.departmentId) clauses.push({ _id: NOTHING });
    else if (field === 'branchId') clauses.push({ [field]: { $in: (authScope.branchIds ?? []).map(oid) } });
    else clauses.push({ [field]: oid(authScope.departmentId) });
  }

  // Self scoping: student/parent sees only their own records
  if (authScope.selfOnly) {
    const field = opts?.selfField ?? 'createdBy';
    if (opts?.selfField) clauses.push(authScope.personId ? { [field]: oid(authScope.personId) } : { _id: NOTHING });
    else clauses.push({ [field]: authScope.userId });
  }

  // Assigned scoping: "my" students / sections / course offerings
  if (authScope.assignedVia?.length) {
    const map = opts?.assignedField ?? (opts?.departmentField === 'branchId' ? { studentIds: '_id' as const } : {});
    const ids = authScope.assigned ?? { studentIds: [], sectionIds: [], courseOfferingIds: [] };
    const or: Record<string, unknown>[] = [];
    if (map.studentIds) or.push({ [map.studentIds]: { $in: ids.studentIds.map(oid) } });
    if (map.sectionIds) or.push({ [map.sectionIds]: { $in: ids.sectionIds.map(oid) } });
    if (map.courseOfferingIds) or.push({ [map.courseOfferingIds]: { $in: ids.courseOfferingIds.map(oid) } });
    clauses.push(or.length === 0 ? { _id: NOTHING } : or.length === 1 ? or[0]! : { $or: or });
  }

  const single = clauses[0];
  if (clauses.length === 1 && single && !Object.keys(single).some((k) => k in filter)) Object.assign(filter, single);
  else if (clauses.length >= 1) {
    // Either several alternatives, or the clause would clobber a key the
    // caller already set (e.g. `_id: id` in findOneScoped): intersect via $and.
    // Narrowings are alternatives (HOD reach OR mentees), never a conjunction.
    // $and keeps any $or the caller already built intact.
    filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: clauses }];
  }
}

/**
 * 010 S4 — scoped single-record lookup. Every by-id read/update/delete on a
 * row-scoped entity goes through this so an HOD cannot open another
 * department's student by URL. Returns the query so callers can populate.
 */
export function findOneScoped<T>(
  model: Model<T>,
  id: string,
  collegeId: string,
  authScope: AuthScope | undefined,
  opts?: ScopeFieldOptions,
) {
  const filter: Record<string, unknown> = { _id: id, collegeId };
  if (authScope) applyAuthScope(filter, authScope, opts);
  return model.findOne(filter as FilterQuery<T>);
}

/**
 * Marks a filter as deliberately un-narrowed: the entity has no department
 * or person axis (exam rooms, grade templates, …), so college-wide is the
 * right answer for every persona. Explicit, so the paginate guard passes and
 * a reviewer can grep for the decision.
 */
export function scopeNotApplicable(filter: Record<string, unknown>): void {
  mark(filter);
}

/**
 * Narrows a collection linked to people through `field` (studentId,
 * employeeId, facultyId …) to the members the caller may see: the members
 * in the caller's department for department scope, the caller's own record
 * for self scope. Resolves the member ids once and applies `$in`.
 * `memberDeptField` names the department axis on the member model
 * (`branchId` for students, `departmentId` for faculty/employees).
 */
export async function scopeViaMembers(
  filter: Record<string, unknown>,
  authScope: AuthScope | undefined,
  collegeId: string,
  memberModel: Model<any>,
  field: string,
  memberDeptField: 'branchId' | 'departmentId',
): Promise<void> {
  mark(filter);
  if (!scopeNarrows(authScope)) return;
  const memberFilter: Record<string, unknown> = { collegeId };
  applyAuthScope(memberFilter, authScope!, { selfField: 'personId', departmentField: memberDeptField });
  const ids = await memberModel.find(memberFilter).select('_id').lean();
  filter[field] = { $in: ids.map((m: any) => m._id) };
}

/** Student-linked collections (attendance, marks, requests …). */
export function scopeViaStudents(
  filter: Record<string, unknown>,
  authScope: AuthScope | undefined,
  collegeId: string,
  studentModel: Model<any>,
  field = 'studentId',
): Promise<void> {
  return scopeViaMembers(filter, authScope, collegeId, studentModel, field, 'branchId');
}
