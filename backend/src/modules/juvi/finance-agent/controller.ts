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
import {
  batchGetAICache,
  batchSetAICache,
  deleteAICache,
  forecastCacheKey,
  getAICache,
  riskScoreCacheKey,
  setAICache,
  situationsCacheKey,
} from '../../../shared/cache/ai-feature-cache';

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
    const { monthAnchor, force } = req.body as {
      monthAnchor: Date;
      force?: boolean;
    };
    const collegeId = req.collegeId!;
    const monthYYYYMM = monthAnchor.toISOString().slice(0, 7);
    const cacheKey = forecastCacheKey(collegeId, monthYYYYMM);

    if (!force) {
      const cached = await getAICache<Record<string, unknown>>(cacheKey);
      if (cached) {
        res.json({ ...cached.data, cachedAt: cached.cachedAt });
        return;
      }
    }

    const result = await service.handleForecastNarrative(collegeId, monthAnchor);
    const cachedAt = await setAICache(cacheKey, result);
    res.json({ ...(result as unknown as Record<string, unknown>), cachedAt });
  } catch (e) {
    next(e);
  }
}

// ── POST /risk-scores ─────────────────────────────────────────────────

type RiskScoreEntry = Awaited<ReturnType<typeof service.handleRiskScores>>[number];

export async function riskScoresHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { studentIds, includeNarrative, force } = req.body as {
      studentIds: string[];
      includeNarrative?: boolean;
      force?: boolean;
    };
    const collegeId = req.collegeId!;

    await assertStudentsInCollege(collegeId, studentIds);

    // Narrative calls are single-student hover loads — skip per-student
    // caching to keep the popover always fresh and avoid a separate key
    // namespace for narrative text.
    if (includeNarrative) {
      const scores = await service.handleRiskScores(collegeId, studentIds, true);
      res.json({ scores, cachedAt: undefined });
      return;
    }

    // Per-student cache lookup via parallel Redis GETs.
    const pairs = studentIds.map((sid) => ({
      studentId: sid,
      key: riskScoreCacheKey(collegeId, sid),
    }));
    const cachedMap = force
      ? new Map<string, { data: RiskScoreEntry; cachedAt: string }>()
      : await batchGetAICache<RiskScoreEntry>(pairs);

    const uncachedIds = studentIds.filter((sid) => !cachedMap.has(sid));

    const freshMap = new Map<string, RiskScoreEntry>();
    let freshCachedAt: string | undefined;

    if (uncachedIds.length > 0) {
      const freshScores = await service.handleRiskScores(
        collegeId,
        uncachedIds,
        false,
      );
      for (const score of freshScores) {
        freshMap.set(score.studentId, score);
      }
      freshCachedAt = await batchSetAICache(
        uncachedIds
          .map((sid) => ({
            key: riskScoreCacheKey(collegeId, sid),
            data: freshMap.get(sid),
          }))
          .filter(
            (e): e is { key: string; data: RiskScoreEntry } =>
              e.data !== undefined,
          ),
      );
    }

    // Reconstruct in original request order.
    const scores = studentIds
      .map((sid) => cachedMap.get(sid)?.data ?? freshMap.get(sid))
      .filter((s): s is RiskScoreEntry => s !== undefined);

    // Report the oldest cached-at timestamp so the UI knows the staleness.
    const allTimes = [
      ...Array.from(cachedMap.values()).map((e) => e.cachedAt),
      ...(freshCachedAt !== undefined ? [freshCachedAt] : []),
    ];
    const cachedAt =
      allTimes.length > 0 ? allTimes.reduce((a, b) => (a < b ? a : b)) : undefined;

    res.json({ scores, cachedAt });
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
    const { force } = (req.body ?? {}) as { force?: boolean };
    const userId = getUserId(req);
    const collegeId = req.collegeId!;
    const cacheKey = situationsCacheKey(collegeId);

    type SituationArr = Awaited<ReturnType<typeof service.handleSituations>>;

    if (!force) {
      const cached = await getAICache<SituationArr>(cacheKey);
      if (cached) {
        res.json({ situations: cached.data, cachedAt: cached.cachedAt });
        return;
      }
    }

    const result = await service.handleSituations(collegeId, userId);
    const cachedAt = await setAICache(cacheKey, result);
    res.json({ situations: result, cachedAt });
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

    // Invalidate the daily situations cache so the next fetch re-runs the
    // LLM pick and excludes the newly dismissed card.
    await deleteAICache(situationsCacheKey(req.collegeId!));

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
