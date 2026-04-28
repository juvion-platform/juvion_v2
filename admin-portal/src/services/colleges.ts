/**
 * Colleges service helper (L7c — llm-spend-limits).
 *
 * Wraps the small set of College endpoints the admin portal calls outside
 * the existing `CollegeManagement` page (which still uses raw `api.*` calls
 * inline). New entries should land here so cross-page consumers share a
 * typed API instead of stringly-typed paths.
 *
 * Mirrors the axios-then-`.data` pattern used by `finance-agent.ts` and
 * `platform.ts`, sharing the auth-aware axios instance from `./api`.
 */
import api from './api';

// ── AI Spend Limits ──────────────────────────────────────────────────

/**
 * Response shape for `PATCH /api/colleges/:id/ai-spend-limits` (L6).
 *
 * Backend returns the persisted limits *and* a fresh `currentSpend` snapshot
 * (cache invalidated on save) so the admin UI can re-render the usage bar
 * in one round-trip without a follow-up GET.
 */
export interface AISpendLimitsUpdateResponse {
  aiSpendLimits: {
    weeklyInr: number;
    alertThresholdPct: number;
  };
  currentSpend: {
    spent: number;
    limit: number;
    /** 0..100; 0 when limit==0 (bypass mode). */
    pct: number;
  };
}

/**
 * Update a college's AI spend limits. Both fields are optional — pass
 * only the ones you want to change. The backend (Zod) rejects an empty
 * body so callers should send at least one field.
 *
 * Permission: super_admin / admin / principal (matched server-side).
 * Rate-limit: 60/min/user (server-enforced; surfaces as 429).
 */
export async function updateAISpendLimits(
  collegeId: string,
  body: { weeklyInr?: number; alertThresholdPct?: number },
): Promise<AISpendLimitsUpdateResponse> {
  return api
    .patch<AISpendLimitsUpdateResponse>(
      `/colleges/${encodeURIComponent(collegeId)}/ai-spend-limits`,
      body,
    )
    .then((r) => r.data);
}
