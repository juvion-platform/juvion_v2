/**
 * Controllers for T8/T9/T10 allocation endpoints.
 *
 * Thin: validate → delegate to service → shape response.
 * RBAC enforcement happens in the route layer via `authorize(...)`.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import * as hostel from './hostel-allocation-service';
import * as transport from './transport-allocation-service';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { User } from '../../models/User';
import { Student } from '../../models/people/Student';

// ── Utilities ──

function requireCollegeId(req: AuthRequest): string {
  if (!req.collegeId) throw new AppError(400, 'College ID required');
  return req.collegeId;
}

function requirePerformedBy(req: AuthRequest): string {
  if (!req.user?.id) throw new AppError(401, 'Not authenticated');
  return req.user.id;
}

/**
 * Resolve the caller's Student _id from the JWT.
 *
 * The JWT carries the User._id, but allocations are keyed on Student._id.
 * The chain is User.personId → Person._id → Student.personId (same
 * Person._id) → Student._id, so we hop User → Student via personId.
 *
 * Fails 403 if the caller isn't linked to a Student in this college —
 * which is the correct outcome for non-student roles hitting a student-only
 * endpoint.
 */
async function resolveStudentId(req: AuthRequest): Promise<string> {
  if (!req.user?.id) throw new AppError(401, 'Not authenticated');
  if (!req.collegeId) throw new AppError(400, 'College ID required');
  const user = await User.findById(req.user.id).select('personId').lean();
  if (!user?.personId) throw new AppError(403, 'User not linked to a student');
  const student = await Student.findOne({ personId: user.personId, collegeId: req.collegeId })
    .select('_id').lean();
  if (!student) throw new AppError(403, 'Student record not found for user');
  return String(student._id);
}

function requireId(req: AuthRequest): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0) throw new AppError(400, 'id param required');
  return id;
}

// ─── Hostel admin actions (T8) ─────────────────────────────

export async function proposeHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const alloc = await hostel.proposeHostelAllocation(requireCollegeId(req), req.body, requirePerformedBy(req));
    res.status(201).json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function withdrawHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.withdrawHostelProposal(requireCollegeId(req), id, requirePerformedBy(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function promoteHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.promoteHostelWaitlist(requireCollegeId(req), id, requirePerformedBy(req));
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function approveVacateHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.approveVacateHostel(
      requireCollegeId(req), id, requirePerformedBy(req), req.body.clearanceNotes,
    );
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function rejectVacateHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.rejectVacateHostel(
      requireCollegeId(req), id, requirePerformedBy(req), req.body.reason,
    );
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

// ─── Transport admin actions (T9) ──────────────────────────

export async function proposeTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const alloc = await transport.proposeTransportAllocation(requireCollegeId(req), req.body, requirePerformedBy(req));
    res.status(201).json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function withdrawTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.withdrawTransportProposal(requireCollegeId(req), id, requirePerformedBy(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function promoteTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.promoteTransportWaitlist(requireCollegeId(req), id, requirePerformedBy(req));
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function approveCancelTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.approveCancelTransport(
      requireCollegeId(req), id, requirePerformedBy(req), req.body.clearanceNotes,
    );
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function rejectCancelTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.rejectCancelTransport(
      requireCollegeId(req), id, requirePerformedBy(req), req.body.reason,
    );
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

// ─── Student actions (T10) ─────────────────────────────────

export async function acceptHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.acceptHostelProposal(requireCollegeId(req), id, await resolveStudentId(req));
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function declineHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.declineHostelProposal(requireCollegeId(req), id, await resolveStudentId(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function requestVacateHostel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await hostel.requestVacateHostel(requireCollegeId(req), id, await resolveStudentId(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function acceptTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.acceptTransportProposal(requireCollegeId(req), id, await resolveStudentId(req));
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function declineTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.declineTransportProposal(requireCollegeId(req), id, await resolveStudentId(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

export async function requestCancelTransport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = requireId(req);
    const alloc = await transport.requestCancelTransport(requireCollegeId(req), id, await resolveStudentId(req), req.body.reason);
    res.json({ allocation: alloc });
  } catch (e) { next(e); }
}

// ─── Student "mine" queries ────────────────────────────────

export async function listMyHostelAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const collegeId = requireCollegeId(req);
    const studentId = await resolveStudentId(req);
    const items = await HostelAllocation.find({ collegeId, studentId }).sort({ createdAt: -1 });
    const pendingCount = items.filter((a) => a.status === 'proposed').length;
    const activeCount = items.filter((a) => a.status === 'active').length;
    res.json({ items, pendingCount, activeCount });
  } catch (e) { next(e); }
}

export async function listMyTransportAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const collegeId = requireCollegeId(req);
    const studentId = await resolveStudentId(req);
    const items = await TransportAllocation.find({ collegeId, studentId }).sort({ createdAt: -1 });
    const pendingCount = items.filter((a) => a.status === 'proposed').length;
    const activeCount = items.filter((a) => a.status === 'active').length;
    res.json({ items, pendingCount, activeCount });
  } catch (e) { next(e); }
}
