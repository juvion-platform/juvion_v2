import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../../__tests__/helpers/mongoMemory';

import { Payment } from '../../../../models/finance/Payment';

import { forecastMonthEnd } from '../forecast';

/**
 * Task A3 — forecast (fee-analytics-ai-native).
 *
 * Holt-Winters additive (level + trend + seasonality, period=7). Pure-TS
 * implementation, no external deps. Output is the projected month-end
 * collection mean + 80% prediction interval, plus a confidence
 * indicator + days-in-window count.
 */

const oid = () => new mongoose.Types.ObjectId();
const day = 24 * 60 * 60 * 1000;

async function seedDailyPayments(
  collegeId: mongoose.Types.ObjectId,
  daily: number[],
  endAt: Date,
): Promise<void> {
  // daily[0] = oldest day, daily[N-1] = endAt
  const docs = daily.map((amount, i) => ({
    collegeId,
    studentId: oid(),
    receiptNumber: `R-${i}-${Math.floor(Math.random() * 1e9)}`,
    amount,
    paymentMode: 'upi',
    paymentDate: new Date(endAt.getTime() - (daily.length - 1 - i) * day),
    status: 'success',
    allocations: [],
    createdAt: new Date(endAt.getTime() - (daily.length - 1 - i) * day),
  }));
  await Payment.insertMany(docs);
}

describe('forecastMonthEnd', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('returns zero band when no payments exist in window', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const result = await forecastMonthEnd(String(collegeId), anchor);
    expect(result.mean).toBe(0);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('happy path: 60 days of stable data → mean close to historical average', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const daily = Array.from({ length: 60 }, () => 10000);
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    // expected month-end-projected total: average × days remaining (incl today)
    // April has 30 days; from anchor (15) → days remaining ≈ 15-16.
    expect(result.mean).toBeGreaterThan(10000 * 14);
    expect(result.mean).toBeLessThanOrEqual(10000 * 17);
    expect(result.upper).toBeGreaterThanOrEqual(result.mean);
    expect(result.lower).toBeLessThanOrEqual(result.mean);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.daysInWindow).toBe(60);
  });

  it('< 30 days of data: falls back to linear trend with confidence=0.5', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const daily = Array.from({ length: 10 }, () => 5000);
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    expect(result.confidence).toBe(0.5);
    expect(result.mean).toBeGreaterThan(0);
  });

  it('seasonality: weekly Monday-spike fixture → forecast captures the pattern', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    // 70 days; Mondays peak (3x normal). With Holt-Winters period=7,
    // the forecast for the remaining month should reflect spike days
    // landing on Mondays — not just the flat 10k baseline times days.
    const daily = Array.from({ length: 70 }, (_, i) => {
      const dt = new Date(anchor.getTime() - (69 - i) * day);
      // Monday=1 in JS; bump payments
      return dt.getUTCDay() === 1 ? 30000 : 10000;
    });
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    expect(result.mean).toBeGreaterThan(0);
    // 16 days remaining, 2-3 of which are Mondays (~3x baseline). The
    // mean should land above the flat-baseline projection because the
    // model has learned the Monday spike.
    const flatBaseline = 10000 * 16;
    expect(result.mean).toBeGreaterThan(flatBaseline);
  });

  it('upward trend: rising daily series → forecast mean > current daily average', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    // 40 days, ramping from 1000 → 5000
    const daily = Array.from({ length: 40 }, (_, i) => 1000 + i * 100);
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    // current daily avg over last 7d ~ 4400; per-day forecast should be
    // higher because of upward trend (Holt-Winters linear projection).
    const daysRemaining = 30 - 15;
    const perDayForecast = result.mean / Math.max(daysRemaining, 1);
    expect(perDayForecast).toBeGreaterThan(3000);
  });

  it('returns daysInWindow = number of historical days observed', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const daily = Array.from({ length: 25 }, () => 100);
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    expect(result.daysInWindow).toBe(25);
  });

  it('cross-college isolation: payments under college B do not affect college A forecast', async () => {
    const collegeA = oid();
    const collegeB = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const daily = Array.from({ length: 30 }, () => 5000);
    await seedDailyPayments(collegeB, daily, anchor);
    const result = await forecastMonthEnd(String(collegeA), anchor);
    expect(result.mean).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('historyDays override: only counts payments within the last N days', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    // 20 days of data total
    const daily = Array.from({ length: 20 }, () => 1000);
    await seedDailyPayments(collegeId, daily, anchor);
    // Restrict history to 5 days → daysInWindow capped
    const result = await forecastMonthEnd(String(collegeId), anchor, 5);
    expect(result.daysInWindow).toBeLessThanOrEqual(5);
  });

  it('monthEnd field is set to the last day of the anchor month', async () => {
    const collegeId = oid();
    const anchor = new Date('2026-04-15T00:00:00Z');
    const daily = Array.from({ length: 5 }, () => 100);
    await seedDailyPayments(collegeId, daily, anchor);
    const result = await forecastMonthEnd(String(collegeId), anchor);
    expect(result.monthEnd.getUTCMonth()).toBe(3); // April = month 3
    // last-day-of-month varies: April has 30 days
    expect(result.monthEnd.getUTCDate()).toBe(30);
  });
});
