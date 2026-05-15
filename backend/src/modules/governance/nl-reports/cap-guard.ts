/**
 * 003-nl-report-queries §10. Per-college daily LLM cap.
 *
 * Thin wrapper over the shared `tryClaimLLMSlot` with `'nl-reports'`
 * namespace. Default cap 30/day (vs lead-scoring's 500, config-suggest's 50).
 */

import { tryClaimLLMSlot, type ClaimResult } from '../../admissions/lead-scoring/cap-guard';

const DEFAULT_CAP = 30;

export function readNlReportCap(): number {
  const raw = process.env.NL_REPORT_DAILY_LLM_CAP;
  if (!raw) return DEFAULT_CAP;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

export async function tryClaimNlReportSlot(
  collegeId: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const cap = readNlReportCap();
  return tryClaimLLMSlot(collegeId, cap, now, 'nl-reports');
}
