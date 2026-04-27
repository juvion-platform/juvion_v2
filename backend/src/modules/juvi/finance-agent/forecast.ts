/**
 * Task A3 — forecast (fee-analytics-ai-native).
 *
 * Holt-Winters additive (level + trend + seasonality) implemented in
 * pure TS — no external deps. Forecasts the month-end collection total
 * with an 80% prediction interval and a confidence indicator.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md (§Journey 2, §AC Forecast narrative)
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.4
 * Tasks: .captain/specs/fee-analytics-ai-native/tasks.md §Task A3
 *
 * Algorithm (transparent):
 *   - Pull daily collection sums for the last `historyDays` (default 180)
 *     from `monthAnchor`, scoped by collegeId.
 *   - Period = 7 (weekly seasonality).
 *   - Smoothing: alpha=0.3 (level), beta=0.1 (trend), gamma=0.1 (seasonal).
 *   - Initial level = mean of first season; initial trend = average per-
 *     step slope from first to second season; initial seasonal = first-
 *     season residuals.
 *   - One-step-ahead residuals → sigma. 80% PI = mean ± 1.282 σ
 *     (one-sided z for the 80th percentile of the standard normal).
 *   - Confidence: 0.8 if ≥ 30 history days; 0.5 if 7-29; 0.5 with linear
 *     fallback if < 7. Returns zero band if 0 days.
 *
 * Forecast horizon = days remaining in month (computed from `today` if
 * the anchor is in the current month, otherwise to the anchor's month-
 * end).
 */

import { Types, PipelineStage } from 'mongoose';

import { Payment } from '../../../models/finance/Payment';

import { MS_PER_DAY_CONST, endOfMonth, mean as avg, stddev } from './time-helpers';

export interface ForecastBand {
  lower: number;
  mean: number;
  upper: number;
  /** 0-1; subjective confidence in the projection. */
  confidence: number;
  /** Number of historical days observed in the input window. */
  daysInWindow: number;
  /** Last day of the calendar month being projected. */
  monthEnd: Date;
}

const DEFAULT_HISTORY_DAYS = 180;
const SEASONALITY_PERIOD = 7;
const ALPHA = 0.3;
const BETA = 0.1;
const GAMMA = 0.1;
/** One-sided z-score for 80% prediction interval ≈ 1.282. */
const Z_80 = 1.282;
const HIGH_CONFIDENCE_MIN_DAYS = 30;
const MIN_DAYS_FOR_HOLT_WINTERS = SEASONALITY_PERIOD; // 7

interface DailyBucket {
  date: Date;
  amount: number;
}

/**
 * Query daily collection totals for the college over the last `days`
 * days from `endAt`. Empty days are filled with zeros so the time
 * series is dense — required for Holt-Winters which doesn't tolerate
 * gaps.
 */
async function getDailySeries(
  collegeId: string,
  endAt: Date,
  days: number,
): Promise<DailyBucket[]> {
  if (!Types.ObjectId.isValid(collegeId) || days <= 0) return [];

  // Truncate `endAt` to start of day (UTC) so payments arriving today
  // bucket into the same key the densifier walks.
  const endStartUtc = new Date(
    Date.UTC(
      endAt.getUTCFullYear(),
      endAt.getUTCMonth(),
      endAt.getUTCDate(),
    ),
  );
  // Inclusive window: walk back `days - 1` more days so a `days=25` ask
  // produces a 25-bucket series ending on `endStartUtc`.
  const startAt = new Date(endStartUtc.getTime() - (days - 1) * MS_PER_DAY_CONST);
  // Inclusive end-of-day for the Mongo match filter.
  const endInclusive = new Date(endStartUtc.getTime() + MS_PER_DAY_CONST - 1);

  const pipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: new Types.ObjectId(collegeId),
        status: 'success',
        paymentDate: { $gte: startAt, $lte: endInclusive },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$paymentDate', unit: 'day' },
        },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const rows = await Payment.aggregate<{ _id: Date; amount: number }>(pipeline);
  const byKey = new Map<string, number>();
  for (const row of rows) {
    byKey.set(toDayKey(row._id), row.amount);
  }

  // Densify: emit `days` buckets ending on `endStartUtc`. Fill zeros
  // for days with no payments so Holt-Winters has a dense series.
  const out: DailyBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endStartUtc.getTime() - i * MS_PER_DAY_CONST);
    const k = toDayKey(d);
    out.push({ date: d, amount: byKey.get(k) ?? 0 });
  }

  // Trim leading zero-only days so a college with 25 days of data
  // returns daysInWindow=25 — not 180. A leading bucket is dropped
  // ONLY if the entire series before that bucket is zero.
  const firstNonZero = out.findIndex((b) => b.amount > 0);
  if (firstNonZero < 0) return [];
  return out.slice(firstNonZero);
}

function toDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/**
 * Linear-trend fallback for short series.
 */
function linearForecast(daily: number[], horizon: number): number {
  const n = daily.length;
  if (n === 0) return 0;
  if (n === 1) {
    const val = daily[0] ?? 0;
    return val * horizon;
  }
  // simple least-squares slope
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = daily.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const y = daily[i] ?? 0;
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) * (x - xMean);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  // Project days [n, n + horizon)
  let total = 0;
  for (let i = 0; i < horizon; i++) {
    const yhat = intercept + slope * (n + i);
    total += Math.max(yhat, 0);
  }
  return total;
}

/**
 * Holt-Winters additive forecast. Returns per-step forecast values and
 * the one-step-ahead residual stddev (sigma).
 */
function holtWintersForecast(
  daily: number[],
  horizon: number,
): { forecasts: number[]; sigma: number } {
  const n = daily.length;
  const m = SEASONALITY_PERIOD;
  if (n < 2 * m) {
    // Not enough seasons for proper seasonal init; degrade to linear.
    return { forecasts: [linearForecast(daily, horizon)], sigma: 0 };
  }

  // Initial level: average of first m values
  let level = avg(daily.slice(0, m));
  // Initial trend: avg per-step slope from first season to second
  let trend = avg(daily.slice(m, 2 * m).map((v, i) => v - (daily[i] ?? 0))) / m;
  // Initial seasonal: first-season residuals (additive)
  const seasonal: number[] = [];
  for (let i = 0; i < m; i++) {
    seasonal.push((daily[i] ?? 0) - level);
  }

  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    const seasonalIdx = i % m;
    const expected = level + trend + (seasonal[seasonalIdx] ?? 0);
    const actual = daily[i] ?? 0;
    residuals.push(actual - expected);
    const newLevel =
      ALPHA * (actual - (seasonal[seasonalIdx] ?? 0)) +
      (1 - ALPHA) * (level + trend);
    const newTrend = BETA * (newLevel - level) + (1 - BETA) * trend;
    const newSeasonal =
      GAMMA * (actual - newLevel) +
      (1 - GAMMA) * (seasonal[seasonalIdx] ?? 0);
    level = newLevel;
    trend = newTrend;
    seasonal[seasonalIdx] = newSeasonal;
  }

  const forecasts: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const seasonalIdx = (n + h - 1) % m;
    const f = level + h * trend + (seasonal[seasonalIdx] ?? 0);
    forecasts.push(Math.max(f, 0));
  }

  // sigma from in-sample residuals (excluding first season for warmup)
  const warm = residuals.slice(m);
  const sigma = warm.length > 1 ? stddev(warm) : 0;
  return { forecasts, sigma };
}

/**
 * Public entry. Returns a `ForecastBand` for month-end collection
 * totals.
 *
 *   - 0 days of data → all zeros, confidence 0
 *   - < 7 days → linear trend, confidence 0.5
 *   - 7-29 days → Holt-Winters when ≥ 14, else linear; confidence 0.5
 *   - ≥ 30 days → Holt-Winters with weekly seasonality; confidence 0.8
 */
export async function forecastMonthEnd(
  collegeId: string,
  monthAnchor: Date,
  historyDays: number = DEFAULT_HISTORY_DAYS,
): Promise<ForecastBand> {
  const monthEnd = endOfMonth(monthAnchor);
  // Days from anchor (inclusive) to month-end.
  const horizon = Math.max(
    Math.ceil((monthEnd.getTime() - monthAnchor.getTime()) / MS_PER_DAY_CONST),
    1,
  );

  const series = await getDailySeries(
    collegeId,
    monthAnchor,
    Math.max(historyDays, 1),
  );
  const daysInWindow = series.length;

  if (daysInWindow === 0) {
    return {
      lower: 0,
      mean: 0,
      upper: 0,
      confidence: 0,
      daysInWindow: 0,
      monthEnd,
    };
  }

  const dailyAmounts = series.map((b) => b.amount);

  // Branch on history length.
  if (daysInWindow < MIN_DAYS_FOR_HOLT_WINTERS) {
    // < 7 days: linear fallback
    const total = linearForecast(dailyAmounts, horizon);
    // Sigma fallback: stddev of the observed series scaled by sqrt(horizon)
    const sigma = stddev(dailyAmounts) * Math.sqrt(horizon);
    return {
      lower: Math.max(total - Z_80 * sigma, 0),
      mean: Math.round(total),
      upper: Math.round(total + Z_80 * sigma),
      confidence: 0.5,
      daysInWindow,
      monthEnd,
    };
  }

  // ≥ 7 days: Holt-Winters (or linear fallback inside if < 2 seasons).
  const { forecasts, sigma } = holtWintersForecast(dailyAmounts, horizon);
  const total = forecasts.reduce((a, b) => a + b, 0);
  const intervalSigma = sigma * Math.sqrt(horizon);
  const confidence = daysInWindow >= HIGH_CONFIDENCE_MIN_DAYS ? 0.8 : 0.5;

  return {
    lower: Math.max(Math.round(total - Z_80 * intervalSigma), 0),
    mean: Math.round(total),
    upper: Math.round(total + Z_80 * intervalSigma),
    confidence,
    daysInWindow,
    monthEnd,
  };
}
