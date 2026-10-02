/**
 * Who may publish Urgent (notifications spec §6.5): the admin roles, or anyone a
 * policy grants `notices:urgent`. Evaluated whatever RBAC_ENFORCE says — like the
 * audience scope in scope.ts it is a publishing rule, not a route gate.
 */
import { AppError } from '../../../middleware/errorHandler';
import { evaluateAccess } from '../../../shared/rbac/engine';
import { personaCodesOf } from '../../../shared/rbac/persona-registry';
import { ErpUserRef } from './publisher-scope';

export const URGENT_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin']);
/** The policy action; `Policy.action` is a free string, so `notices:urgent` is an ordinary policy row. */
export const URGENT_ACTION = 'urgent';

export async function canPublishUrgent(collegeId: string, user: ErpUserRef): Promise<boolean> {
  if (URGENT_ROLES.has(user.role)) return true;
  const policy = await evaluateAccess(collegeId, user.role, personaCodesOf(user), 'notices', URGENT_ACTION);
  return policy?.effect === 'allow';
}

/** ERP error shape `{ error, detail: { code: 'URGENT_NOT_ALLOWED' } }`. */
export const urgentNotAllowed = () =>
  new AppError(403, 'Only an IT admin can publish Urgent notices. Choose Routine or Important, or ask an IT admin.', { code: 'URGENT_NOT_ALLOWED' });

export async function assertUrgentAllowed(collegeId: string, user: ErpUserRef, priority: string): Promise<void> {
  if (priority === 'urgent' && !(await canPublishUrgent(collegeId, user))) throw urgentNotAllowed();
}
