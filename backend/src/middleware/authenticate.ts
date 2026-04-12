import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthScope } from '../shared/rbac/types';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
  authScope?: AuthScope;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // Dev bypass: skip JWT when NODE_ENV=development and no token provided
  if (process.env.NODE_ENV === 'development') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      req.user = { id: 'dev-user', name: 'Dev Admin', email: 'admin@juvion.dev', role: 'super_admin', personaType: 'L-PRIN' };
      req.collegeId = (req.headers['x-college-id'] as string) || process.env.DEV_COLLEGE_ID || '000000000000000000000001';
      return next();
    }
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.user = decoded;

    // Only super_admin can use x-college-id header to scope into another college
    const headerCollegeId = req.headers['x-college-id'] as string;
    if (headerCollegeId && decoded.role === 'super_admin') {
      req.collegeId = headerCollegeId;
    } else {
      req.collegeId = decoded.collegeId;
    }

    // Superadmins may access college-agnostic routes (like /colleges) without a collegeId
    if (!req.collegeId && decoded.role !== 'super_admin') {
      return res.status(400).json({ error: 'College ID required' });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
