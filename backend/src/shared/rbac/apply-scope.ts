import { AuthScope } from './types';

export interface ScopeFieldOptions {
  /**
   * Field name to filter on for departmentOnly scope.
   * Default: 'departmentId'
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
}

/**
 * Mutates the given filter object to add scope constraints from AuthScope.
 *
 * This is the single integration point between the RBAC middleware and
 * service-layer queries. Call this in any service list function that uses
 * paginate() or builds a Mongoose filter.
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
  // Department scoping: HOD/faculty sees only their department's data
  if (authScope.departmentOnly && authScope.departmentId) {
    const field = opts?.departmentField ?? 'departmentId';
    filter[field] = authScope.departmentId;
  }

  // Self scoping: student/parent sees only their own records
  if (authScope.selfOnly) {
    const field = opts?.selfField ?? 'createdBy';
    // Use personId if available and a person-linked field is specified
    if (authScope.personId && opts?.selfField) {
      filter[field] = authScope.personId;
    } else {
      filter[field] = authScope.userId;
    }
  }
}
