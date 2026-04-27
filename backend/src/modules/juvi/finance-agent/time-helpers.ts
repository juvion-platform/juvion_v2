/**
 * Tiny shared time helpers for the finance-agent deterministic helpers
 * (risk-scorer, forecast, situation-candidates). Pure-TS, no deps.
 *
 * All helpers operate on the system clock (`new Date()`) by default but
 * accept an explicit `now` for deterministic testing.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Return midnight of the given date (local timezone). */
export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Return midnight of today. */
export function startOfToday(): Date {
  return startOfDay(new Date());
}

/** Return a Date `n` days before `from`. */
export function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * MS_PER_DAY);
}

/**
 * Last day of the calendar month containing `d`, set to 23:59:59.999
 * (UTC). Useful as the projection horizon.
 */
export function endOfMonth(d: Date = new Date()): Date {
  // last-day-of-month: day 0 of next month
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

/**
 * Number of days remaining in the calendar month containing `d`,
 * including `d` itself. Floor at 1 to avoid divide-by-zero / negative.
 */
export function daysRemainingInMonth(d: Date = new Date()): number {
  const end = endOfMonth(d);
  const remaining = Math.ceil(
    (end.getTime() - d.getTime()) / MS_PER_DAY,
  );
  return Math.max(remaining, 1);
}

/** Standard millisecond constant for callers that want it. */
export const MS_PER_DAY_CONST = MS_PER_DAY;

// ── Shared numeric utilities ────────────────────────────────────────
//
// Both risk-scorer (cadence variance) and forecast (residual sigma)
// need stddev/avg. Centralise here so the contract stays consistent.

/** Arithmetic mean of `xs`. Returns 0 for empty input. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population stddev of `xs`. Returns 0 when fewer than 2 samples. */
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return Math.sqrt(variance);
}
