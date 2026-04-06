import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

// Permission format: "module:action" e.g. "finance:create", "academics:read"
export function authorize(..._requiredPermissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    // Leadership (L-PRIN, L-TRUST) has full access
    if (['L-PRIN', 'L-TRUST'].includes(req.user.personaType)) return next();

    // TODO: Check role-permission matrix from RBAC config against _requiredPermissions
    // For now, allow all authenticated users
    next();
  };
}
