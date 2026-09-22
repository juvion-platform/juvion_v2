import type { PolicyScope, RbacPolicy } from '../../services/rbacPolicies';

/** Natural key the defaults-review API uses. */
export const policyKey = (p: Pick<RbacPolicy, 'role' | 'personaType' | 'module' | 'action'>) =>
  `${p.role}|${p.personaType || ''}|${p.module}|${p.action}`;

/** Short human label for a scope: 'dept · self · exams,results · mentees+sections' or 'unrestricted'. */
export function scopeLabel(scope?: PolicyScope): string {
  if (!scope) return 'unrestricted';
  const parts: string[] = [];
  if (scope.departmentOnly) parts.push('dept');
  if (scope.selfOnly) parts.push('self');
  if (scope.subDomain) parts.push(scope.subDomain);
  if (scope.assignedVia?.length) parts.push(scope.assignedVia.join('+'));
  if (scope.sensitivity) parts.push(scope.sensitivity.length ? `sees ${scope.sensitivity.join(',')}` : 'no sensitive fields');
  return parts.length ? parts.join(' · ') : 'unrestricted';
}
