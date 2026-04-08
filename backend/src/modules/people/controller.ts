import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';
const qp = (req: AuthRequest) => {
  const q = req.query as Record<string, string | undefined>;
  return { page: +(q.page || '1'), limit: +(q.limit || '20'), status: q.status, search: q.search };
};

// ─── Dashboard Stats ─────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getDashboardStats(req.collegeId!)); } catch (e) { next(e); }
}

// ─── Persons ─────────────────────────────────────────
export async function listPersons(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listPersons(req.collegeId!, q.page, q.limit, q.search)); } catch (e) { next(e); }
}
export async function getPerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getPerson(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createPerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createPerson(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updatePerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updatePerson(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deletePerson(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deletePerson(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Students ────────────────────────────────────────
export async function listStudents(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listStudents(req.collegeId!, q.page, q.limit, q.status, q.search)); } catch (e) { next(e); }
}
export async function getStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getStudent(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createStudent(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateStudent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteStudent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteStudent(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Faculty ─────────────────────────────────────────
export async function listFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listFaculty(req.collegeId!, q.page, q.limit, q.status, q.search)); } catch (e) { next(e); }
}
export async function getFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getFaculty(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createFaculty(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateFaculty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteFaculty(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteFaculty(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Staff ───────────────────────────────────────────
export async function listStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listStaff(req.collegeId!, q.page, q.limit, q.status, q.search)); } catch (e) { next(e); }
}
export async function getStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getStaff(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createStaff(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateStaff(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteStaff(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteStaff(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Parents ─────────────────────────────────────────
export async function listParents(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listParents(req.collegeId!, q.page, q.limit, q.search)); } catch (e) { next(e); }
}
export async function getParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getParent(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createParent(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateParent(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteParent(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteParent(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}

// ─── Organizations ───────────────────────────────────
export async function listOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
  try { const q = qp(req); res.json(await svc.listOrganizations(req.collegeId!, q.page, q.limit, q.search)); } catch (e) { next(e); }
}
export async function getOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getOrganization(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function createOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.createOrganization(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
export async function updateOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.updateOrganization(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (e) { next(e); }
}
export async function deleteOrganization(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.deleteOrganization(req.collegeId!, req.params.id as string, who(req))); } catch (e) { next(e); }
}
