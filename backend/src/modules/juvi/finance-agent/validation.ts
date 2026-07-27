/**
 * Task A5 — Zod schemas for the finance-agent HTTP module.
 *
 * Mounted at `/api/juvi/finance-agent` (see `./routes.ts`). One schema
 * per endpoint, validated via the standard `validate(schema)` middleware.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.9
 */

import { z } from 'zod';

/**
 * POST /query (SSE) — chat prompt + optional conversation continuation.
 *
 * - `prompt`: 1..2000 chars (user-facing free text)
 * - `conversationId`: client-side uuid; absent for a brand-new conversation
 * - `context.filters`: optional dashboard filters scoping the LLM context
 * - `context.visibleDefaulterIds`: optional 0..50 student ids the user is
 *   currently looking at; bounded to keep prompt size sane
 */
export const chatQuerySchema = z.object({
  prompt: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  context: z
    .object({
      filters: z
        .object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          programmeIds: z.array(z.string()).optional(),
        })
        .optional(),
      visibleDefaulterIds: z.array(z.string()).max(50).optional(),
    })
    .optional(),
});

/**
 * POST /forecast-narrative — LLM driver text on top of the Holt-Winters
 * month-end projection. `monthAnchor` is any date in the target month.
 * `force` bypasses the daily Redis cache and recomputes from scratch.
 */
export const forecastNarrativeSchema = z.object({
  monthAnchor: z.coerce.date(),
  force: z.boolean().optional(),
});

/**
 * POST /risk-scores — batch deterministic risk score lookup; optional
 * per-student narrative (LLM, opt-in).
 *
 * Cap of 100 students per request matches plan §1.8.
 * `force` bypasses the daily Redis cache for non-narrative batch calls.
 */
export const riskScoresSchema = z.object({
  studentIds: z.array(z.string()).min(1).max(100),
  includeNarrative: z.boolean().optional(),
  force: z.boolean().optional(),
});

/**
 * POST /situations — only `force` (optional) is accepted; the server
 * resolves the college from `req.collegeId` only. `force` bypasses the
 * daily Redis cache and recomputes from scratch.
 *
 * `.strict()` is deliberate: the endpoint takes its tenant from the
 * authenticated request, so a body carrying `collegeId` is either a client
 * bug or an attempt to cross tenants, and should be rejected loudly rather
 * than silently stripped. It was lost when `force` was added.
 */
export const situationsSchema = z.object({
  force: z.boolean().optional(),
}).strict();

/**
 * POST /reminder-drafts — agent-drafted fee reminders for a batch of
 * students. Cap of 50 per request matches plan §1.8.
 */
export const reminderDraftsSchema = z.object({
  studentIds: z.array(z.string()).min(1).max(50),
});

/**
 * POST /reminder-drafts/approve — turn drafts into FeeReminder docs +
 * enqueue dispatch. Officer-edited subject/body is taken at face value;
 * server logs the originalDraft alongside.
 */
export const approveDraftsSchema = z.object({
  drafts: z
    .array(
      z.object({
        studentId: z.string(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * POST /situations/:fingerprint/dismiss — snooze a situation card. The
 * snoozeDays union is the canonical set of officer-friendly buckets
 * (per plan §1.8 + spec). `reason` is freeform but capped at 500 chars.
 */
export const dismissSituationSchema = z.object({
  snoozeDays: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(7),
    z.literal(30),
  ]),
  reason: z.string().max(500),
});
