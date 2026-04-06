import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string };
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

    // Superadmin scopes into a college via x-college-id header; they don't have collegeId in JWT
    const headerCollegeId = req.headers['x-college-id'] as string;
    req.collegeId = headerCollegeId || decoded.collegeId;

    // Superadmins may access college-agnostic routes (like /colleges) without a collegeId
    if (!req.collegeId && decoded.role !== 'super_admin') {
      return res.status(400).json({ error: 'College ID required' });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
