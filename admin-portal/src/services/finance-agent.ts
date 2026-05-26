/**
 * Finance Agent client (Task A6 — fee-analytics-ai-native).
 *
 * Streaming chat against `POST /api/juvi/finance-agent/query` (SSE) using
 * native `fetch` + `ReadableStreamDefaultReader`. We can't use `EventSource`
 * because we need POST body + Authorization headers.
 *
 * Backend SSE wire format (see backend/src/modules/juvi/finance-agent/controller.ts):
 *
 *   event: delta\n
 *   data: {"text":"..."}\n\n
 *
 *   event: done\n
 *   data: {"provider":"claude","model":"...","inputTokens":...,
 *          "outputTokens":...,"costInr":...,"durationMs":...,
 *          "auditId":"...","conversationId":"..."}\n\n
 *
 *   event: error\n
 *   data: {"message":"..."}\n\n
 *
 * Forecast narrative (A7) is also exported from this file — see the bottom
 * section. Other helpers (risk-scores, situations, drafts) will be added
 * by sibling tasks A8–A10.
 */
import api from './api';
import { useAuthStore } from '../stores/authStore';

// ── Public types ──────────────────────────────────────────────────────

export interface AgentChatContext {
  filters?: {
    from?: string; // ISO date (YYYY-MM-DD); backend coerces to Date
    to?: string;
    programmeIds?: string[];
  };
  visibleDefaulterIds?: string[];
}

/**
 * Per-call budget warning payload (L4/L7 — llm-spend-limits).
 *
 * Backend mirror: `BudgetWarning` in `finance-agent/service.ts`. Surfaces
 * the rolling 7-day spend snapshot when the college has crossed its
 * `alertThresholdPct` but is still under the hard limit. Absent on
 * success-without-warning responses.
 */
export interface BudgetWarning {
  spent: number;
  limit: number;
  /** 0..100 */
  pct: number;
  /** ISO timestamp; next Monday 00:00 UTC. */
  resetsAt: string;
}

export interface AgentChatFinal {
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  durationMs: number;
  auditId: string;
  conversationId: string;
  budgetWarning?: BudgetWarning;
}

export type StreamQueryEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; final: AgentChatFinal }
  | { type: 'error'; status?: number; error: string };

export interface StreamQueryOpts {
  prompt: string;
  conversationId?: string;
  context?: AgentChatContext;
  signal?: AbortSignal;
}

// ── Internals ─────────────────────────────────────────────────────────

const ENDPOINT = '/api/juvi/finance-agent/query';

/**
 * Parse one SSE event block (everything between two blank lines) into a
 * `{ event, data }` pair. Returns `null` for blocks without both lines or
 * with malformed JSON. Tolerates `\r\n` line endings (per RFC 8895).
 */
function parseSseEvent(block: string): { event: string; data: unknown } | null {
  const lines = block.split(/\r?\n/);
  let event = '';
  let dataRaw = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      // SSE allows multiple `data:` lines per event; concatenate with \n
      // per spec. Backend currently emits a single line, but we handle the
      // multi-line case defensively.
      dataRaw += (dataRaw ? '\n' : '') + line.slice('data:'.length).trim();
    }
    // ignore comments (lines starting with ':') and id/retry fields
  }
  if (!event || !dataRaw) return null;
  try {
    return { event, data: JSON.parse(dataRaw) };
  } catch {
    return null;
  }
}

/**
 * Stream a chat query against the finance-agent SSE endpoint. Yields one
 * event at a time. The caller drives the loop and decides when to stop
 * (typically: stop on `done` or `error`, or when the AbortSignal fires).
 *
 * Error handling:
 *  - non-2xx HTTP status → single `{ type: 'error', status, error }` then return
 *  - missing response body → single error event then return
 *  - aborted by signal → `AbortError` propagates; caller should catch
 *  - connection drops mid-stream → reader.read() returns `done:true`; we
 *    yield a synthetic error event so callers can append "(connection lost)"
 */
export async function* streamQuery(
  opts: StreamQueryOpts,
): AsyncGenerator<StreamQueryEvent, void, void> {
  const { token, collegeId } = useAuthStore.getState();

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(collegeId ? { 'x-college-id': collegeId } : {}),
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        conversationId: opts.conversationId,
        context: opts.context,
      }),
      signal: opts.signal,
    });
  } catch (e) {
    // Network error / abort — re-throw aborts; surface other errors as
    // an error event so callers don't have to wrap in try/catch.
    if (e instanceof Error && e.name === 'AbortError') throw e;
    yield { type: 'error', error: e instanceof Error ? e.message : 'Network error' };
    return;
  }

  if (!response.ok) {
    yield {
      type: 'error',
      status: response.status,
      error: `HTTP ${response.status}`,
    };
    return;
  }
  if (!response.body) {
    yield { type: 'error', error: 'Empty response body' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line (\n\n or \r\n\r\n). Split
      // on either; whatever remains after the last delimiter stays in the
      // buffer until more bytes arrive.
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';

      for (const block of parts) {
        if (!block.trim()) continue;
        const parsed = parseSseEvent(block);
        if (!parsed) continue;
        if (parsed.event === 'delta') {
          const text = (parsed.data as { text?: unknown } | null)?.text;
          if (typeof text === 'string') {
            yield { type: 'delta', text };
          }
        } else if (parsed.event === 'done') {
          sawDone = true;
          yield { type: 'done', final: parsed.data as AgentChatFinal };
        } else if (parsed.event === 'error') {
          const message = (parsed.data as { message?: unknown } | null)?.message;
          yield {
            type: 'error',
            error: typeof message === 'string' ? message : 'Stream error',
          };
        }
      }
    }
    // Flush any final event still sitting in the buffer (server didn't
    // emit a trailing blank line).
    const tail = buffer.trim();
    if (tail) {
      const parsed = parseSseEvent(tail);
      if (parsed?.event === 'delta') {
        const text = (parsed.data as { text?: unknown } | null)?.text;
        if (typeof text === 'string') yield { type: 'delta', text };
      } else if (parsed?.event === 'done') {
        sawDone = true;
        yield { type: 'done', final: parsed.data as AgentChatFinal };
      } else if (parsed?.event === 'error') {
        const message = (parsed.data as { message?: unknown } | null)?.message;
        yield {
          type: 'error',
          error: typeof message === 'string' ? message : 'Stream error',
        };
      }
    }
    // Stream closed without a `done` event — connection dropped mid-stream.
    if (!sawDone) {
      yield { type: 'error', error: 'connection lost' };
    }
  } finally {
    // Ensure the underlying socket is released even if the consumer
    // breaks out of the for-await early.
    try {
      reader.releaseLock();
    } catch {
      // releaseLock throws if a read is still pending; safe to ignore.
    }
  }
}

// ── Forecast narrative (A7) ──────────────────────────────────────────

/**
 * Holt-Winters projection band for end-of-month collection. Values are
 * INR rupees (same units as the rest of the dashboard, NOT paise).
 *
 * Wire shape: numbers + ISO date strings — the backend serializes its
 * internal `Date` fields to ISO via `res.json(...)`.
 */
export interface ForecastBand {
  lower: number;
  mean: number;
  upper: number;
  /** 0..1 — model confidence in the band (e.g., 0.8 == 80%). */
  confidence: number;
  daysInWindow: number;
  /** ISO date string for the projected month-end. */
  monthEnd: string;
}

/**
 * Response from POST /juvi/finance-agent/forecast-narrative.
 *
 * `narrative` is `null` when the LLM provider is degraded/disabled — the
 * deterministic projection band is still returned so the UI can render
 * the range without the driver text.
 *
 * `cachedAt` is an ISO timestamp when the response was served from the
 * daily Redis cache; absent on fresh (non-cached) responses.
 */
export interface ForecastWithNarrative {
  projection: ForecastBand;
  narrative: string | null;
  /** ISO timestamp of when the response was assembled on the server. */
  generatedAt: string;
  /**
   * Optional warning payload — present when the college's rolling 7-day
   * LLM spend has crossed its alert threshold but stayed under 100%.
   * The dashboard's <BudgetBanner /> hydrates from this field.
   */
  budgetWarning?: BudgetWarning;
  /** ISO timestamp when this result was first cached; absent on fresh responses. */
  cachedAt?: string;
}

/**
 * Fetch the AI-narrated month-end forecast.
 *
 * `monthAnchor` can be any date inside the target month — the backend
 * snaps to the month-end when projecting (see service.ts).
 *
 * Pass `force=true` to bypass the daily Redis cache and recompute.
 */
export async function getForecastNarrative(
  monthAnchor: Date,
  force = false,
): Promise<ForecastWithNarrative> {
  return api
    .post<ForecastWithNarrative>('/juvi/finance-agent/forecast-narrative', {
      monthAnchor: monthAnchor.toISOString(),
      ...(force ? { force: true } : {}),
    })
    .then((r) => r.data);
}

// ── Risk scores (A8) ─────────────────────────────────────────────────

/**
 * One contributing factor in a student's risk score. `weight` is the
 * signed contribution to the 0-100 score (positive = adds risk, negative
 * = subtracts). `value` is either the underlying numeric input (e.g. days
 * overdue) or the boolean flag that triggered the factor.
 */
export interface RiskScoreFactor {
  name: string;
  weight: number;
  value: number | boolean;
}

/**
 * One row of the `/risk-scores` response.
 *
 * `score === null` (and `tier === 'insufficient-data'`) means we couldn't
 * find enough signal to score the student — frontend should render a
 * neutral chip with `Risk —` and skip the narrative fetch.
 *
 * `narrative` is only populated when the caller passed `includeNarrative=true`;
 * the deterministic batch call leaves it `undefined`.
 */
export interface RiskScoreResult {
  studentId: string;
  score: number | null;
  tier: 'low' | 'medium' | 'high' | 'critical' | 'insufficient-data';
  factors: RiskScoreFactor[];
  narrative?: string;
}

/**
 * Response wrapper from POST /juvi/finance-agent/risk-scores.
 *
 * `cachedAt` is the oldest cached-at timestamp in the batch (i.e., the
 * time the earliest entry was first computed and stored). Absent when all
 * scores were computed fresh in this request.
 */
export interface RiskScoresResponse {
  scores: RiskScoreResult[];
  cachedAt?: string;
}

/**
 * Batch-fetch deterministic risk scores for a list of students. Pass
 * `includeNarrative=true` only for single-student lazy hover loads —
 * batch calls keep this `false` so the LLM is never invoked for the full
 * defaulter list.
 *
 * Backend caps the batch at 100 student ids (Zod-validated).
 * Pass `force=true` to bypass the daily Redis cache.
 */
export async function getRiskScores(
  studentIds: string[],
  includeNarrative = false,
  force = false,
): Promise<RiskScoresResponse> {
  return api
    .post<RiskScoresResponse>('/juvi/finance-agent/risk-scores', {
      studentIds,
      includeNarrative,
      ...(force ? { force: true } : {}),
    })
    .then((r) => r.data);
}

// ── Situations (A9) ──────────────────────────────────────────────────

/**
 * Action types the LLM can attach to a situation card. See spec §AC
 * "Proactive situation cards" — the orchestrator validates that emitted
 * actions are limited to this enum.
 *
 * `dismiss` is always available client-side (the dismiss dialog) regardless
 * of whether the LLM included it in `actions[]`.
 */
export type SituationActionType =
  | 'draft_plan'
  | 'draft_reminder'
  | 'schedule_call'
  | 'review_policy'
  | 'dismiss';

/**
 * One action attached to a Situation card. `payload` is opaque to the
 * frontend — it's reserved for future per-action context (e.g. proposed
 * payment-plan instalments) that the action handler can consume.
 */
export interface SituationAction {
  label: string;
  type: SituationActionType;
  payload?: Record<string, unknown>;
}

/**
 * One LLM-picked situation card. `fingerprint` is a stable hash of the
 * underlying candidate (kind + sorted studentIds) used to match against
 * SituationDismissal so a snoozed card stays hidden across reloads.
 */
export interface Situation {
  id: string;
  fingerprint: string;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  narrative: string;
  studentIds: string[];
  actions: SituationAction[];
}

/**
 * Response wrapper from POST /juvi/finance-agent/situations.
 *
 * `cachedAt` is the ISO timestamp when this result was first computed and
 * cached. Absent on fresh (non-cached) responses.
 */
export interface SituationsResponse {
  situations: Situation[];
  cachedAt?: string;
}

/**
 * Fetch the current set of agent-surfaced situations for the caller's
 * college. The backend assembles up to ~10 deterministic candidates,
 * applies the user's outstanding dismissals, then asks the LLM to pick
 * 3-5. Empty array means "collection is clean".
 *
 * Pass `force=true` to bypass the daily Redis cache and recompute.
 */
export async function getSituations(force = false): Promise<SituationsResponse> {
  return api
    .post<SituationsResponse>('/juvi/finance-agent/situations', {
      ...(force ? { force: true } : {}),
    })
    .then((r) => r.data);
}

/**
 * Snooze a situation by its fingerprint. Server upserts a SituationDismissal
 * with `snoozedUntil = now + snoozeDays` and the optional reason for audit.
 * The caller should invalidate the `['situations']` query so the dismissed
 * card disappears from the UI immediately.
 *
 * `snoozeDays` is a 1/3/7/30 enum on the backend (Zod-validated).
 */
export async function dismissSituation(
  fingerprint: string,
  snoozeDays: 1 | 3 | 7 | 30,
  reason: string,
): Promise<void> {
  await api.post(
    `/juvi/finance-agent/situations/${encodeURIComponent(fingerprint)}/dismiss`,
    { snoozeDays, reason },
  );
}

// ── Reminder drafts (A10) ────────────────────────────────────────────

/**
 * One per-student LLM-drafted reminder. The orchestrator emits these from
 * `POST /juvi/finance-agent/reminder-drafts`. The Finance Officer reviews
 * each in the side panel before approving — at which point the approved
 * subject + body are POSTed to `/reminder-drafts/approve` to materialise
 * a `FeeReminder` doc + queue dispatch.
 *
 * `predictedReadRate` is a 0-1 model self-estimate; the panel uses it to
 * power the "Approve recommended" bulk action (>= 0.7 threshold per spec).
 *
 * `templateVersion` is `'agent-draft-v1'` for this iteration.
 */
export interface ReminderDraft {
  studentId: string;
  language: string; // e.g. 'te' | 'en' | 'hi'
  tone: 'soft' | 'firm' | 'empathetic';
  subject: string;
  body: string;
  predictedReadRate: number;
  templateVersion: string;
}

/**
 * One row of the approval payload. The Finance Officer can edit `subject`
 * and `body` before approving — the backend stores the final content as
 * the FeeReminder body and audits the original draft separately.
 */
export interface ApprovedDraft {
  studentId: string;
  subject: string;
  body: string;
}

/**
 * Result of a successful approval call. `reminderIds` are the ids of the
 * newly created `FeeReminder` docs (one per approved draft) and
 * `approvedCount` is the number of drafts processed (== `drafts.length`).
 */
export interface ApprovalResult {
  reminderIds: string[];
  approvedCount: number;
}

/**
 * Fetch AI-pre-drafted reminders for a list of students. The backend
 * caps the batch at 50 (Zod-validated). Drafts default to read-only on
 * the panel; the user can edit, approve, or skip each row.
 */
export async function getReminderDrafts(
  studentIds: string[],
): Promise<ReminderDraft[]> {
  return api
    .post<ReminderDraft[]>('/juvi/finance-agent/reminder-drafts', { studentIds })
    .then((r) => r.data);
}

/**
 * Approve a batch of (possibly edited) drafts. Each draft becomes a
 * `FeeReminder` document tagged with `metadata.source = 'agent-draft-v1'`
 * and the dispatch is queued via the existing reminder workers. The
 * 5-min recall window is opened by the backend; cancellation is via the
 * Reminders page (out of scope for this panel).
 */
export async function approveReminderDrafts(
  drafts: ApprovedDraft[],
): Promise<ApprovalResult> {
  return api
    .post<ApprovalResult>('/juvi/finance-agent/reminder-drafts/approve', {
      drafts,
    })
    .then((r) => r.data);
}
