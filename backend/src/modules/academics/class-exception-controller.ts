/**
 * class-exception-controller — HTTP layer for class exceptions (spec §5.2).
 * Thin wraps over class-exception-service, in the exam-config-controller style.
 * Writes run the per-actor check (§5.1) instead of authorize('academics',
 * 'update') so teaching faculty can change their own classes; reads keep the
 * standard authorize('academics','read') chain.
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as svc from './class-exception-service';

/** What `validate(schema, 'query')` attaches (Express 5 keeps req.query read-only). */
interface ReqWithValidatedQuery<T> extends AuthRequest {
  validatedQuery?: T;
}

export async function listClassExceptions(
  req: ReqWithValidatedQuery<{ offeringId?: string; from?: string; to?: string }>,
  res: Response, next: NextFunction,
) {
  try {
    const viewer = await svc.listClassExceptionViewer(req.collegeId!, req.user!);
    // Office callers see every exception; teaching callers only their own (§5.5);
    // anything else (no policy, no Faculty row) sees nothing.
    if (!viewer.isOffice && !viewer.facultyId) { res.json([]); return; }
    const scope = viewer.isOffice ? undefined : viewer.facultyId;
    res.json(await svc.listClassExceptions(req.collegeId!, { ...req.validatedQuery, ...(scope ? { viewerFacultyId: scope } : {}) }));
  } catch (e) { next(e); }
}

/**
 * §5.1: the create path decides permission BEFORE any validation writes —
 * assertClassChangePermissionForSlot resolves slotId → slot → offeringId,
 * 404s an unknown slot, then runs the R6 check. createClassException (Task 4)
 * re-fetches the slot for its own validation chain; the double read is
 * deliberate and keeps Task 4's signature frozen.
 */
export async function createClassException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await svc.assertClassChangePermissionForSlot(req.collegeId!, req.user!, String(req.body.timetableSlotId));
    res.status(201).json(await svc.createClassException(req.collegeId!, req.body, String(req.user!.id)));
  } catch (e) { next(e); }
}

export async function revokeClassException(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await svc.getClassException(req.collegeId!, String(req.params.id));
    await svc.assertClassChangePermission(req.collegeId!, req.user!, String(row.courseOfferingId), String(row.timetableSlotId));
    res.json(await svc.revokeClassException(req.collegeId!, String(req.params.id), String(req.user!.id)));
  } catch (e) { next(e); }
}

export async function previewClassException(
  req: ReqWithValidatedQuery<{ slotId: string; date: string; newDate?: string }>,
  res: Response, next: NextFunction,
) {
  try {
    const q = req.validatedQuery!;
    res.json(await svc.previewClassException(req.collegeId!, q.slotId, q.date, new Date(), q.newDate));
  } catch (e) { next(e); }
}
