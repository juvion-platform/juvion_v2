import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { evaluateAccess } from '../shared/rbac/engine';
import { personaCodesOf } from '../shared/rbac/persona-registry';
import { resolveUserScope } from '../shared/rbac/scope-resolver';
import { AuthScope } from '../shared/rbac/types';
import { RbacModule, RbacAction, SubDomainOf } from '../shared/rbac/sub-domains';
import { scopeNarrows } from '../shared/rbac/apply-scope';
import { resolveAssigned } from '../shared/rbac/assignment-resolvers';
import { hiddenClassesFor, maskFields, findHiddenKey } from '../shared/rbac/sensitivity';
import { getListContext } from '../shared/request-context';

/**
 * ABAC authorization middleware.
 * Evaluates policies from cache/DB to determine if the user can perform
 * the given action on the given module.
 *
 * When RBAC_ENFORCE env var is 'false', acts as a pass-through (gradual rollout).
 */
export function authorize<M extends RbacModule>(module: M, action: RbacAction | '*', opts?: { subDomain?: SubDomainOf<M> }) {
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

      const policy = await evaluateAccess(collegeId, role, personaCodesOf({ personaType, personas: req.user.personas }), module, action);

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

      // Resolve department and person IDs for scope enforcement
      const userScope = await resolveUserScope(userId, collegeId || '', role);

      // Attach scope constraints for services to enforce
      const authScope: AuthScope = {
        departmentOnly: policy.scope?.departmentOnly ?? false,
        departmentId: userScope.departmentId,
        branchIds: userScope.branchIds,
        selfOnly: policy.scope?.selfOnly ?? false,
        userId,
        personId: userScope.personId,
        studentId: userScope.studentId,
        subDomain: policy.scope?.subDomain ? policy.scope.subDomain.split(',').map((s) => s.trim()) : undefined,
        assignedVia: policy.scope?.assignedVia?.length ? policy.scope.assignedVia : undefined,
        sensitivity: policy.scope?.sensitivity,
        resolvedPermissions: [],
      };
      // 010 P3 — one enforcement point for field masks: strip hidden keys from
      // every JSON response on this request, refuse writes that carry one.
      const hidden = hiddenClassesFor(authScope);
      if (hidden.length) {
        if (action !== 'read' && action !== '*') {
          const key = findHiddenKey(req.body, hidden);
          if (key) return res.status(403).json({ error: `Field "${key}" is not permitted for this role` });
        }
        const json = res.json.bind(res);
        // Services often hand Mongoose documents to res.json; serialise first so
        // the walker sees plain objects (express stringifies anyway).
        res.json = ((body: unknown) => json(maskFields(body === undefined ? body : JSON.parse(JSON.stringify(body)), hidden))) as typeof res.json;
      }
      if (authScope.assignedVia) {
        authScope.assigned = await resolveAssigned(collegeId || '', userScope.personId, authScope.assignedVia);
      }

      req.authScope = authScope;
      if (scopeNarrows(authScope)) { const ctx = getListContext(); ctx.scoped = true; ctx.authScope = authScope; }
      next();
    } catch (err) {
      next(err);
    }
  };
}
