/**
 * Declarative role-gate middleware.
 *
 * Sits AFTER `authorize(...)` in the route chain when the route needs a
 * "minimum role" gate that the policy-based RBAC doesn't express today.
 * Returns 401 if the request isn't authenticated and 403 if the user's
 * role isn't in the allow-list.
 *
 * Originally introduced for 003-nl-report-queries §10.1 (admin /
 * super_admin only on NL endpoints) — reusable for any future
 * admin-only or super-admin-only endpoint.
 *
 * Example:
 *   router.post(
 *     '/reports/nl-query',
 *     authorize('governance', 'read'),
 *     requireRole(['admin', 'super_admin']),
 *     validate(nlQuerySchema),
 *     ctrl.nlQueryHandler,
 *   );
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

export function requireRole(roles: ReadonlyArray<string>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Required role missing' });
    }
    next();
  };
}
