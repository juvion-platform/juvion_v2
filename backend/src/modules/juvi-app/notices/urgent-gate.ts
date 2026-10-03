/**
 * Who may publish Urgent (notifications spec §6.5): the admin roles, or anyone a
 * policy grants `notices:urgent`. Evaluated whatever RBAC_ENFORCE says — like the
 * audience scope in scope.ts it is a publishing rule, not a route gate.
 *
 * Fails closed: the grant must be a row whose action is literally `urgent`. A
 * `notices:*` (or `*:*`) row never grants it, so a college whose snapshot still
 * carries the old `hod|notices|*` row refuses its HODs until
 * scripts/fix-notices-urgent-policies.ts has run (it also adds the principal row).
 */
import { AppError } from '../../../middleware/errorHandler';
import { decide, filterPolicies, loadPolicies, sortPolicies } from '../../../shared/rbac/engine';
import { ancestryFrom, loadPersonas, personaCodesOf } from '../../../shared/rbac/persona-registry';
import { ErpUserRef } from './publisher-scope';

export const URGENT_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin']);
/** The policy action; `Policy.action` is a free string, so `notices:urgent` is an ordinary policy row. */
export const URGENT_ACTION = 'urgent';

export async function canPublishUrgent(collegeId: string, user: ErpUserRef): Promise<boolean> {
  if (URGENT_ROLES.has(user.role)) return true;
  const [policies, personas] = await Promise.all([loadPolicies(collegeId, user.role), loadPersonas(collegeId)]);
  const chains = personaCodesOf(user).map((c) => ancestryFrom(personas, c));
  // The ordinary decision first, so an explicit deny on any persona still wins.
  if (decide(policies, chains, 'notices', URGENT_ACTION)?.effect !== 'allow') return false;
  // Then at least one persona's winning row must name the action itself.
  return chains.some((chain) => {
    const winner = sortPolicies(filterPolicies(policies, 'notices', URGENT_ACTION, chain), chain)[0];
    return winner?.effect === 'allow' && winner.action === URGENT_ACTION;
  });
}

/** ERP error shape `{ error, detail: { code: 'URGENT_NOT_ALLOWED' } }`. */
export const urgentNotAllowed = () =>
  new AppError(403, 'Only an IT admin can publish Urgent notices. Choose Routine or Important, or ask an IT admin.', { code: 'URGENT_NOT_ALLOWED' });

export async function assertUrgentAllowed(collegeId: string, user: ErpUserRef, priority: string): Promise<void> {
  if (priority === 'urgent' && !(await canPublishUrgent(collegeId, user))) throw urgentNotAllowed();
}
