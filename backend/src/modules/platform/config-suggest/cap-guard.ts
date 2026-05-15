/**
 * Per-college daily LLM cap for config-suggest (spec §10.7).
 *
 * Thin wrapper around the shared `tryClaimLLMSlot` in lead-scoring,
 * passing the `'config-suggest'` namespace so the Redis counter is
 * isolated from lead-scoring's own counter. Default cap 50/day.
 */

import { tryClaimLLMSlot, type ClaimResult } from '../../admissions/lead-scoring/cap-guard';

const DEFAULT_CAP = 50;

export function readConfigSuggestCap(): number {
  const raw = process.env.CONFIG_SUGGEST_DAILY_LLM_CAP;
  if (!raw) return DEFAULT_CAP;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

export async function tryClaimConfigSuggestSlot(
  collegeId: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const cap = readConfigSuggestCap();
  return tryClaimLLMSlot(collegeId, cap, now, 'config-suggest');
}
