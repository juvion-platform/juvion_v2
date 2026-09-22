import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthScope } from '../shared/rbac/types';
import { getTokenVersion } from '../shared/rbac/token-version';

export interface AuthRequest extends Request {
  collegeId?: string;
  user?: { id: string; name: string; email: string; role: string; personaType: string; personas?: string[]; tv?: number };
  authScope?: AuthScope;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // Dev bypass: skip JWT when NODE_ENV=development and no token provided
  if (process.env.NODE_ENV === 'development') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      // Use a valid 24-char hex so models that type `userId: ObjectId`
      // (e.g. SituationDismissal, AgentAction) can cast it without
      // throwing in dev. Sentinel value '...099' makes dev users easy
      // to spot in audit logs.
      req.user = { id: '000000000000000000000099', name: 'Dev Admin', email: 'admin@juvion.dev', role: 'super_admin', personaType: 'L-PRIN', personas: ['L-PRIN'] };
      req.collegeId = (req.headers['x-college-id'] as string) || process.env.DEV_COLLEGE_ID || '000000000000000000000001';
      return next();
    }
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.user = decoded;
    if (!decoded.personas) decoded.personas = [decoded.personaType];

    // 010 — a token minted before the user's last persona/role change is stale.
    if (typeof decoded.tv === 'number') {
      const current = await getTokenVersion(decoded.id);
      if (decoded.tv < current) return res.status(401).json({ error: 'Session expired, please sign in again' });
    }

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
