/**
 * Lead grade derivation — single source of truth.
 *
 * Previously lived as a 3-grade helper in `workflow.handlers.ts`. Per
 * 001-ai-lead-scoring spec §3 + GATE 3 B-1, we now produce four grades
 * (matching the Inquiry.leadGrade enum already in the schema).
 *
 * Thresholds:
 *   ≥80  → hot
 *   60–79 → warm
 *   40–59 → cold
 *   <40  → dormant
 *
 * Out-of-range inputs are treated defensively: anything above 100 maps
 * to hot, anything below 0 maps to dormant. Undefined input returns
 * undefined (caller decides whether that's an error).
 */

export type LeadGrade = 'hot' | 'warm' | 'cold' | 'dormant';

export function deriveLeadGrade(leadScore?: number): LeadGrade | undefined {
  if (leadScore === undefined || leadScore === null || Number.isNaN(leadScore)) return undefined;
  if (leadScore >= 80) return 'hot';
  if (leadScore >= 60) return 'warm';
  if (leadScore >= 40) return 'cold';
  return 'dormant';
}
