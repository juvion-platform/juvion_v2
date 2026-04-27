/**
 * Task A5 — HTTP controllers for the finance-agent module.
 *
 * Seven thin handlers — one per endpoint declared in plan §1.9. Each
 * controller:
 *   1. Parses `req.body` (already pre-validated by `validate(schema)`
 *      middleware — we re-parse here only when we need typed locals).
 *   2. Resolves `userId` and `collegeId` from the authenticated request.
 *   3. For endpoints that take student ids: enforces cross-college
 *      isolation by verifying every id belongs to the caller's college
 *      BEFORE calling the orchestrator (per A4 spec gap #11).
 *   4. Delegates to the A4 orchestrator (`./service`).
 *   5. Returns JSON, except `/query` which streams SSE.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.7, §1.9
 */

import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';

import { AuthRequest } from '../../../middleware/authenticate';
import { AppError } from '../../../middleware/errorHandler';
import { Student } from '../../../models/people/Student';

import * as service from './service';

/** Resolve the authenticated user id (a JWT-signed Mongo ObjectId string). */
function getUserId(req: AuthRequest): string {
  const id = req.user?.id;
  if (!id) {
    // `authenticate` middleware should have rejected this already.
    throw new AppError(401, 'Not authenticated');
  }
  return String(id);
}

/**
 * Verify every studentId in the input list belongs to the caller's
 * college. Throws AppError(403) when ANY id is from a different college
 * (or doesn't exist at all — same posture, since leaking existence is
 * itself a cross-college signal). Per A4 spec gap #11 and §1.9 AC.
 */
async function assertStudentsInCollege(
  collegeId: string,
  studentIds: string[],
): Promise<void> {
  if (studentIds.length === 0) return;

  // Filter out anything that isn't a valid ObjectId BEFORE running the
  // query — passing a non-ObjectId to `$in` raises a CastError. We treat
  // any non-ObjectId as a 403 too (caller can't reference a student that
  // doesn't exist, regardless of validity).
  const validIds: Types.ObjectId[] = [];
  for (const sid of studentIds) {
    if (!Types.ObjectId.isValid(sid)) {
      throw new AppError(403, 'Cross-college student IDs detected');
    }
    validIds.push(new Types.ObjectId(sid));
  }

  const found = await Student.find({
    _id: { $in: validIds },
    collegeId,
  })
    .select({ _id: 1 })
    .lean();

  if (found.length !== studentIds.length) {
    throw new AppError(403, 'Cross-college student IDs detected');
  }
}

// ── POST /query  (Server-Sent Events) ─────────────────────────────────

export async function chatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as {
      prompt: string;
      conversationId?: string;
      context?: service.AgentChatContext;
    };
    const collegeId = req.collegeId!;
    const userId = getUserId(req);

    // SSE headers — set BEFORE first write. `X-Accel-Buffering: no` keeps
    // nginx from buffering the stream in production deployments.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Wire up client disconnect → upstream LLM abort.
    const ac = new AbortController();
    const onClose = (): void => {
      if (!ac.signal.aborted) ac.abort();
    };
    req.on('close', onClose);

    try {
      for await (const chunk of service.handleChat(
        collegeId,
        userId,
        body.prompt,
        body.conversationId,
        body.context,
        ac.signal,
      )) {
        if (chunk.type === 'delta') {
          res.write(
            `event: delta\ndata: ${JSON.stringify({ text: chunk.text ?? '' })}\n\n`,
          );
        } else if (chunk.type === 'done') {
          res.write(
            `event: done\ndata: ${JSON.stringify(chunk.final ?? {})}\n\n`,
          );
        } else if (chunk.type === 'error') {
          res.write(
            `event: error\ndata: ${JSON.stringify({ message: chunk.error ?? 'unknown' })}\n\n`,
          );
        }
      }
    } finally {
      req.off('close', onClose);
    }

    res.end();
  } catch (e) {
    next(e);
  }
}

// ── POST /forecast-narrative ──────────────────────────────────────────

export async function forecastNarrativeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { monthAnchor } = req.body as { monthAnchor: Date };
    const result = await service.handleForecastNarrative(
      req.collegeId!,
      monthAnchor,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// ── POST /risk-scores ─────────────────────────────────────────────────

export async function riskScoresHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { studentIds, includeNarrative } = req.body as {
      studentIds: string[];
      includeNarrative?: boolean;
    };
    const collegeId = req.collegeId!;

    await assertStudentsInCollege(collegeId, studentIds);

    const result = await service.handleRiskScores(
      collegeId,
      studentIds,
      includeNarrative,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// ── POST /situations ──────────────────────────────────────────────────

export async function situationsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req);
    const result = await service.handleSituations(req.collegeId!, userId);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// ── POST /reminder-drafts ─────────────────────────────────────────────

export async function reminderDraftsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { studentIds } = req.body as { studentIds: string[] };
    const collegeId = req.collegeId!;

    await assertStudentsInCollege(collegeId, studentIds);

    const result = await service.handleReminderDrafts(collegeId, studentIds);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// ── POST /reminder-drafts/approve ─────────────────────────────────────

export async function approveDraftsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { drafts } = req.body as { drafts: service.ApprovedDraft[] };
    const collegeId = req.collegeId!;
    const userId = getUserId(req);

    // Belt-and-suspenders: the service also asserts cross-college, but
    // doing it here gives a fast 403 BEFORE any FeeReminder doc is
    // created (defence-in-depth).
    await assertStudentsInCollege(
      collegeId,
      drafts.map((d) => d.studentId),
    );

    const result = await service.handleApproveDrafts(collegeId, userId, drafts);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// ── POST /situations/:fingerprint/dismiss ─────────────────────────────

export async function dismissSituationHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Express 5 types `req.params[key]` as `string | string[]` (a single
    // route param can in theory match multiple segments). For our
    // single-segment `:fingerprint`, normalise to a string.
    const rawFp = req.params.fingerprint;
    const fingerprint = Array.isArray(rawFp) ? rawFp[0] : rawFp;
    if (!fingerprint) {
      throw new AppError(400, 'Missing fingerprint param');
    }
    const { snoozeDays, reason } = req.body as {
      snoozeDays: 1 | 3 | 7 | 30;
      reason: string;
    };
    const userId = getUserId(req);

    await service.handleDismissSituation(
      req.collegeId!,
      userId,
      fingerprint,
      snoozeDays,
      reason,
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
