/**
 * 003-nl-report-queries §10.8 + §10.9.
 *
 * Runtime semantic checks on a matched LLM response:
 *   - allow-list (also enforced by the parser's Zod enum; kept here as
 *     defense in depth)
 *   - per-report param shape (only the keys each runner actually reads)
 *   - date bounds (today−5y to today+1y, from <= to)
 *
 * Returns the normalised params (date strings preserved, missing defaults
 * filled) so the service can pass them straight to `report-service.runReport`.
 */

import { ALLOWED_REPORTS, type AllowedReportCode } from './prompt';

const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ROSTER_STATUS_VALUES = new Set(['active', 'all']);

export interface MatchedInput {
  reportCode: string;
  params: Record<string, unknown>;
}

export type ValidatorResult =
  | { ok: true; normalized: { reportCode: AllowedReportCode; params: Record<string, unknown> } }
  | { ok: false; reason: string };

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

function validateDateRange(
  params: Record<string, unknown>,
  now: Date,
): { ok: true; from: string; to: string } | { ok: false; reason: string } {
  const fromDate = parseIsoDate(params.from);
  const toDate = parseIsoDate(params.to);
  if (!fromDate) return { ok: false, reason: 'from is required and must be an ISO date' };
  if (!toDate) return { ok: false, reason: 'to is required and must be an ISO date' };
  if (fromDate.getTime() > toDate.getTime()) {
    return { ok: false, reason: 'from must be on or before to (invalid range)' };
  }
  const minTime = now.getTime() - FIVE_YEARS_MS;
  if (fromDate.getTime() < minTime) {
    return { ok: false, reason: 'from cannot be more than 5 years in the past' };
  }
  const maxTime = now.getTime() + ONE_YEAR_MS;
  if (toDate.getTime() > maxTime) {
    return { ok: false, reason: 'to cannot be more than 1 year in the future' };
  }
  return { ok: true, from: String(params.from), to: String(params.to) };
}

const DATE_RANGE_REPORTS = new Set<AllowedReportCode>(['admissions-funnel', 'lead-source-performance']);
const DATE_RANGE_KEYS = new Set(['from', 'to']);

export function validateMatchedOutput(input: MatchedInput, now: Date = new Date()): ValidatorResult {
  // Defense in depth — Zod enum already covers this, but the validator
  // is the second checkpoint between LLM output and report-service.
  if (!ALLOWED_REPORTS.includes(input.reportCode as AllowedReportCode)) {
    return { ok: false, reason: `Report not in v1 allow-list: ${input.reportCode}` };
  }
  const code = input.reportCode as AllowedReportCode;

  if (DATE_RANGE_REPORTS.has(code)) {
    // Reject any keys outside { from, to }.
    for (const k of Object.keys(input.params)) {
      if (!DATE_RANGE_KEYS.has(k)) {
        return { ok: false, reason: `Unexpected param key for ${code}: ${k}` };
      }
    }
    const r = validateDateRange(input.params, now);
    if (!r.ok) return r;
    return { ok: true, normalized: { reportCode: code, params: { from: r.from, to: r.to } } };
  }

  // student-roster-snapshot
  for (const k of Object.keys(input.params)) {
    if (k !== 'status') {
      return { ok: false, reason: `Unexpected param key for ${code}: ${k}` };
    }
  }
  const status = (input.params.status ?? 'active') as string;
  if (!ROSTER_STATUS_VALUES.has(status)) {
    return { ok: false, reason: `status must be "active" or "all"` };
  }
  return { ok: true, normalized: { reportCode: code, params: { status } } };
}
