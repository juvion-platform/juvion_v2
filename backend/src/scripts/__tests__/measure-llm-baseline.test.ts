/**
 * Tests for `measure-llm-baseline.ts` — Task C0 of the
 * finance-agent-summary-cache feature.
 *
 * Verifies the aggregation correctness, window filtering, college-id
 * filter, formatTable + formatCsv output shape. CLI is exercised via
 * the exported pure functions; we don't fork a child process.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

import { College } from '../../models/College';
import { AgentAction } from '../../models/juvi/AgentAction';

import {
  measureLLMBaseline,
  formatTable,
  formatCsv,
} from '../measure-llm-baseline';

// ── Fixture ────────────────────────────────────────────────────────────

const COLLEGE_A = new mongoose.Types.ObjectId('000000000000000000000a01');
const COLLEGE_B = new mongoose.Types.ObjectId('000000000000000000000a02');
const USER = new mongoose.Types.ObjectId('000000000000000000000099');

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

beforeEach(async () => {
  await clearCollections();
  await College.create({
    _id: COLLEGE_A,
    name: 'Alpha College',
    code: 'ALP',
    status: 'active',
    contactEmail: 'a@x.dev',
    contactPhone: '+91-9000000001',
    address: { line1: '1 A Rd', city: 'A City', state: 'A State', pincode: '100001' },
  });
  await College.create({
    _id: COLLEGE_B,
    name: 'Beta College',
    code: 'BTA',
    status: 'active',
    contactEmail: 'b@x.dev',
    contactPhone: '+91-9000000002',
    address: { line1: '1 B Rd', city: 'B City', state: 'B State', pincode: '200002' },
  });
});

/** Convenience: insert N AgentAction rows into a college with the given type + cost. */
async function seedActions(opts: {
  collegeId: mongoose.Types.ObjectId;
  type: 'chat' | 'forecast' | 'risk' | 'situations' | 'reminder-draft' | 'reminder-approve' | 'situation-dismiss';
  count: number;
  costInr: number;
  daysAgo?: number;        // default 1; controls createdAt offset
  inputTokens?: number;    // per row; default 100
  outputTokens?: number;   // per row; default 50
}): Promise<void> {
  const ms = (opts.daysAgo ?? 1) * 24 * 60 * 60 * 1000;
  const ts = new Date(Date.now() - ms);
  for (let i = 0; i < opts.count; i++) {
    const doc = new AgentAction({
      collegeId: opts.collegeId,
      userId: USER,
      type: opts.type,
      maskedPrompt: `mask-prompt-${i}`,
      maskedResponse: `mask-response-${i}`,
      provider: 'claude',
      model: 'claude-sonnet-4-5',
      durationMs: 800,
      inputTokens: opts.inputTokens ?? 100,
      outputTokens: opts.outputTokens ?? 50,
      costInr: opts.costInr,
    });
    // Force createdAt; Mongoose timestamps would override unless we set it explicitly
    doc.set('createdAt', ts);
    await doc.save();
  }
}

// ── Aggregation correctness ───────────────────────────────────────────

describe('measureLLMBaseline — aggregation', () => {
  it('returns empty summary when no AgentAction rows exist', async () => {
    const result = await measureLLMBaseline({ days: 7 });
    expect(result.byCollege).toEqual([]);
    expect(result.totalCalls).toBe(0);
    expect(result.totalCostInr).toBe(0);
    expect(result.byType).toEqual({});
    expect(result.windowDays).toBe(7);
  });

  it('aggregates a single college, single type', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 5, costInr: 0.1, daysAgo: 1 });

    const result = await measureLLMBaseline({ days: 7 });
    expect(result.byCollege).toHaveLength(1);
    expect(result.byCollege[0]).toMatchObject({
      collegeId: COLLEGE_A.toHexString(),
      collegeName: 'Alpha College',
      type: 'forecast',
      callCount: 5,
      totalCostInr: 0.5,
    });
    expect(result.totalCalls).toBe(5);
    expect(result.totalCostInr).toBe(0.5);
    expect(result.byType.forecast).toMatchObject({ callCount: 5, totalCostInr: 0.5 });
  });

  it('aggregates across multiple colleges and types', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 3, costInr: 0.10 });
    await seedActions({ collegeId: COLLEGE_A, type: 'chat',     count: 2, costInr: 0.20 });
    await seedActions({ collegeId: COLLEGE_B, type: 'forecast', count: 1, costInr: 0.10 });

    const result = await measureLLMBaseline({ days: 7 });

    expect(result.byCollege).toHaveLength(3);
    expect(result.totalCalls).toBe(6);
    // 3*0.10 + 2*0.20 + 1*0.10 = 0.80
    expect(result.totalCostInr).toBeCloseTo(0.80, 4);

    // Per-type roll-up
    expect(result.byType.forecast).toMatchObject({ callCount: 4, totalCostInr: 0.40 });
    expect(result.byType.chat).toMatchObject({ callCount: 2, totalCostInr: 0.40 });
  });

  it('sums input/output tokens across calls', async () => {
    await seedActions({
      collegeId: COLLEGE_A, type: 'forecast', count: 4, costInr: 0.10,
      inputTokens: 200, outputTokens: 75,
    });
    const result = await measureLLMBaseline({ days: 7 });
    expect(result.totalInputTokens).toBe(800);
    expect(result.totalOutputTokens).toBe(300);
  });
});

describe('measureLLMBaseline — window filtering', () => {
  it('excludes rows older than the window', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 2, costInr: 0.10, daysAgo: 1 });
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 5, costInr: 0.10, daysAgo: 30 });

    const result = await measureLLMBaseline({ days: 7 });
    // Only the 2 from yesterday are inside the 7-day window
    expect(result.totalCalls).toBe(2);
    expect(result.totalCostInr).toBeCloseTo(0.20, 4);
  });

  it('honors a wider --days window', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 2, costInr: 0.10, daysAgo: 1 });
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 3, costInr: 0.10, daysAgo: 14 });

    const result = await measureLLMBaseline({ days: 30 });
    // All 5 fall inside 30-day window
    expect(result.totalCalls).toBe(5);
  });

  it('rejects non-positive --days', async () => {
    await expect(measureLLMBaseline({ days: 0 })).rejects.toThrow(/days/);
    await expect(measureLLMBaseline({ days: -1 })).rejects.toThrow(/days/);
  });
});

describe('measureLLMBaseline — collegeId filter', () => {
  it('limits result to the requested college only', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 4, costInr: 0.10 });
    await seedActions({ collegeId: COLLEGE_B, type: 'forecast', count: 2, costInr: 0.10 });

    const result = await measureLLMBaseline({ days: 7, collegeId: COLLEGE_A.toHexString() });
    expect(result.byCollege).toHaveLength(1);
    expect(result.byCollege[0]!.collegeId).toBe(COLLEGE_A.toHexString());
    expect(result.totalCalls).toBe(4);
  });

  it('returns empty when collegeId has no rows in window', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 4, costInr: 0.10 });
    const result = await measureLLMBaseline({ days: 7, collegeId: COLLEGE_B.toHexString() });
    expect(result.byCollege).toEqual([]);
    expect(result.totalCalls).toBe(0);
  });
});

describe('measureLLMBaseline — college name resolution', () => {
  it('uses College.name in output rows', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 1, costInr: 0.10 });
    const result = await measureLLMBaseline({ days: 7 });
    expect(result.byCollege[0]!.collegeName).toBe('Alpha College');
  });

  it('falls back to "<unknown college>" when college doc is missing', async () => {
    const orphanCollegeId = new mongoose.Types.ObjectId();
    await seedActions({ collegeId: orphanCollegeId, type: 'forecast', count: 1, costInr: 0.10 });
    const result = await measureLLMBaseline({ days: 7 });
    expect(result.byCollege[0]!.collegeName).toBe('<unknown college>');
  });
});

// ── Formatters ─────────────────────────────────────────────────────────

describe('formatTable', () => {
  it('renders an empty-window message when no rows', () => {
    const out = formatTable({
      windowDays: 7,
      windowStart: new Date('2026-04-21T00:00:00Z'),
      windowEnd: new Date('2026-04-28T00:00:00Z'),
      totalCalls: 0,
      totalCostInr: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byCollege: [],
      byType: {},
    });
    expect(out).toContain('LLM cost baseline');
    expect(out).toContain('7-day window');
    expect(out).toContain('No AgentAction rows in window');
  });

  it('renders the per-college table + per-type rollup + grand total', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 3, costInr: 0.10 });
    await seedActions({ collegeId: COLLEGE_A, type: 'chat',     count: 2, costInr: 0.20 });
    const summary = await measureLLMBaseline({ days: 7 });
    const out = formatTable(summary);

    expect(out).toContain('LLM cost baseline');
    expect(out).toContain('Alpha College');
    expect(out).toContain('forecast');
    expect(out).toContain('chat');
    expect(out).toContain('Per-type totals');
    expect(out).toContain('Grand total: 5 calls');
  });
});

describe('formatCsv', () => {
  it('emits header + one row per (college, type)', async () => {
    await seedActions({ collegeId: COLLEGE_A, type: 'forecast', count: 1, costInr: 0.10 });
    await seedActions({ collegeId: COLLEGE_B, type: 'chat',     count: 2, costInr: 0.20 });
    const summary = await measureLLMBaseline({ days: 7 });

    const out = formatCsv(summary);
    const lines = out.split('\n');
    expect(lines[0]).toBe(
      'collegeId,collegeName,type,callCount,totalCostInr,inputTokens,outputTokens,windowStart,windowEnd',
    );
    expect(lines).toHaveLength(3);                  // header + 2 rows
    // Order is callCount desc; Beta has 2 calls, Alpha has 1 — assertion
    // is order-agnostic so the test stays stable if the sort ever changes.
    expect(out).toContain('Alpha College');
    expect(out).toContain('Beta College');
  });

  it('escapes commas and quotes in college names', async () => {
    const trickyCollegeId = new mongoose.Types.ObjectId();
    await College.create({
      _id: trickyCollegeId,
      name: 'O\'Brien, "Best" College',
      code: 'TRY',
      status: 'active',
      contactEmail: 't@x.dev',
      contactPhone: '+91-9000000003',
      address: { line1: '1 T Rd', city: 'T City', state: 'T State', pincode: '300003' },
    });
    await seedActions({ collegeId: trickyCollegeId, type: 'forecast', count: 1, costInr: 0.10 });

    const summary = await measureLLMBaseline({ days: 7 });
    const out = formatCsv(summary);
    const dataLine = out.split('\n')[1];
    // CSV-escaped: outer quotes + doubled inner quotes
    expect(dataLine).toContain('"O\'Brien, ""Best"" College"');
  });

  it('emits header-only when no rows', () => {
    const out = formatCsv({
      windowDays: 7,
      windowStart: new Date('2026-04-21T00:00:00Z'),
      windowEnd: new Date('2026-04-28T00:00:00Z'),
      totalCalls: 0,
      totalCostInr: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byCollege: [],
      byType: {},
    });
    expect(out.split('\n')).toHaveLength(1);        // header only
  });
});
