import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { evaluateAccess } from '../shared/rbac/engine';
import { AuthScope, RbacOptions } from '../shared/rbac/types';

/**
 * ABAC authorization middleware.
 * Evaluates policies from cache/DB to determine if the user can perform
 * the given action on the given module.
 *
 * When RBAC_ENFORCE env var is 'false', acts as a pass-through (gradual rollout).
 */
export function authorize(module: string, action: string, opts?: RbacOptions) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Feature flag: skip enforcement during rollout
    if (process.env.RBAC_ENFORCE === 'false') {
      req.authScope = {
        departmentOnly: false,
        selfOnly: false,
        userId: req.user.id,
        resolvedPermissions: [],
      };
      return next();
    }

    try {
      const { role, personaType, id: userId } = req.user;
      const collegeId = req.collegeId;

      const policy = await evaluateAccess(collegeId, role, personaType, module, action);

      // No matching policy = deny
      if (!policy || policy.effect === 'deny') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Sub-domain check: if route specifies a subDomain, verify the policy allows it
      if (opts?.subDomain && policy.scope?.subDomain) {
        const allowed = policy.scope.subDomain.split(',').map((s) => s.trim());
        if (!allowed.includes(opts.subDomain)) {
          return res.status(403).json({ error: 'Access denied for this resource' });
        }
      }

      // Attach scope constraints for services to enforce
      const authScope: AuthScope = {
        departmentOnly: policy.scope?.departmentOnly ?? false,
        selfOnly: policy.scope?.selfOnly ?? false,
        userId,
        subDomain: policy.scope?.subDomain ? policy.scope.subDomain.split(',').map((s) => s.trim()) : undefined,
        resolvedPermissions: [],
      };

      req.authScope = authScope;
      next();
    } catch (err) {
      next(err);
    }
  };
}
