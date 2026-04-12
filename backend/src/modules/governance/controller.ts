import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══ Committee ══════════════════════════════════════════════

export async function listCommittees(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, type } = req.query as any;
    res.json(await service.listCommittees(req.collegeId!, Number(page) || 1, Number(limit) || 20, type, req.authScope));
  } catch (err) { next(err); }
}
export async function getCommittee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCommittee(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCommittee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCommittee(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCommittee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCommittee(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCommittee(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCommittee(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Committee Meeting ══════════════════════════════════════

export async function listMeetings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, committeeId, status } = req.query as any;
    res.json(await service.listMeetings(req.collegeId!, Number(page) || 1, Number(limit) || 20, committeeId, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMeeting(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMeeting(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMeeting(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMeeting(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMeeting(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Policy ═════════════════════════════════════════════════

export async function listPolicies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category, status } = req.query as any;
    res.json(await service.listPolicies(req.collegeId!, Number(page) || 1, Number(limit) || 20, category, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPolicy(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPolicy(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePolicy(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePolicy(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePolicy(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Governing Body Member ══════════════════════════════════

export async function listBoardMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, role } = req.query as any;
    res.json(await service.listBoardMembers(req.collegeId!, Number(page) || 1, Number(limit) || 20, role, req.authScope));
  } catch (err) { next(err); }
}
export async function getBoardMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBoardMember(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBoardMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBoardMember(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBoardMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBoardMember(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBoardMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBoardMember(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Strategic Goal ═════════════════════════════════════════

export async function listGoals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, category, status } = req.query as any;
    res.json(await service.listGoals(req.collegeId!, Number(page) || 1, Number(limit) || 20, category, status, req.authScope));
  } catch (err) { next(err); }
}
export async function getGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getGoal(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createGoal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateGoal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteGoal(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteGoal(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
