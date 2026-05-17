/**
 * Task L5 — `llm-usage-weekly` cron worker tests
 * (llm-spend-limits feature, plan §1.9, tasks.md §L5).
 *
 * Scope:
 *   - Iterate active colleges (skips status !== 'active')
 *   - Per-college: aggregate AgentAction by `type` over last completed week
 *     (Mon 00:00 UTC ... Sun 23:59:59.999 UTC) and write a single
 *     `LLMUsageSnapshot` row.
 *   - Capture the limit + threshold AT TIME OF SNAPSHOT (not the current
 *     value — admin re-runs after a limit bump must not rewrite history).
 *   - Per-college try/catch — one college's failure must NOT abort other
 *     colleges in the run.
 *   - Bounded concurrency 10 — verify max 10 colleges in flight at any
 *     one time via a counter inside a stubbed aggregate.
 *   - Empty AgentAction window → snapshot still written with zeros (so
 *     admins see the explicit zero-week, not a missing row).
 *
 * Implementation notes:
 *   - Worker invoked directly with a mocked Job (no BullMQ / Redis).
 *   - `vi.setSystemTime` freezes `Date` so the "last completed week"
 *     window is deterministic across machines / CI / local runs.
 *   - We mock `AgentAction.aggregate` only for the concurrency-counter
 *     test (test #7) — every other test uses the real aggregation against
 *     the in-memory Mongo to exercise the real pipeline shape.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import type { Job } from 'bullmq';

import {
  LLM_USAGE_WEEKLY_JOB_OPTS,
  LLM_USAGE_WEEKLY_CONCURRENCY,
  llmUsageWeeklyCronWorker,
  startOfLastWeek,
  endOfLastWeek,
} from '../llm-usage-weekly.worker';
import { College } from '../../models/College';
import { AgentAction } from '../../models/juvi/AgentAction';
import { LLMUsageSnapshot } from '../../models/juvi/LLMUsageSnapshot';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';
import { QUEUE_NAMES } from '../../shared/queue/QueueManager';

const oid = () => new mongoose.Types.ObjectId();

// 2026-04-29 (Wednesday) 06:00:00 UTC.
//   Last completed week = Mon 2026-04-20 00:00:00 UTC ... Sun 2026-04-26
//   23:59:59.999 UTC.
// Picking mid-week ensures the helpers are unambiguous and that
// "last completed week" excludes the current (in-progress) week.
const FROZEN_NOW = new Date('2026-04-29T06:00:00.000Z');
const EXPECTED_WEEK_START = new Date('2026-04-20T00:00:00.000Z');
const EXPECTED_WEEK_END = new Date('2026-04-26T23:59:59.999Z');

function buildJob(): Job {
  return { id: 'job-1', name: 'weekly', data: {} } as unknown as Job;
}

let codeCounter = 0;
async function seedCollege(opts: {
  status?: string;
  weeklyInr?: number;
  alertThresholdPct?: number;
}) {
  codeCounter += 1;
  return College.create({
    name: `College ${codeCounter}`,
    code: `WK${String(codeCounter).padStart(4, '0')}`,
    address: {
      line1: '1 Main',
      city: 'C',
      state: 'S',
      pincode: '000001',
    },
    contactEmail: `c${codeCounter}@example.com`,
    contactPhone: '9999999999',
    status: opts.status ?? 'active',
    aiSpendLimits: {
      weeklyInr: opts.weeklyInr ?? 0,
      alertThresholdPct: opts.alertThresholdPct ?? 80,
    },
  });
}

interface SeedActionOpts {
  collegeId: mongoose.Types.ObjectId;
  type:
    | 'chat'
    | 'forecast'
    | 'risk'
    | 'situations'
    | 'reminder-draft'
    | 'reminder-approve'
    | 'situation-dismiss';
  costInr: number;
  /** Date inside last-completed-week unless overridden. */
  createdAt?: Date;
}
async function seedAction(opts: SeedActionOpts) {
  // Pick a deterministic mid-window date by default. Tuesday 12:00 UTC.
  const createdAt = opts.createdAt ?? new Date('2026-04-21T12:00:00.000Z');
  const doc = await AgentAction.create({
    collegeId: opts.collegeId,
    userId: oid(),
    type: opts.type,
    maskedPrompt: 'hello',
    maskedResponse: 'world',
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    durationMs: 1000,
    inputTokens: 100,
    outputTokens: 50,
    costInr: opts.costInr,
  });
  // Mongoose `timestamps:true` overrides any `createdAt` we pass on
  // create. Patch via direct collection update so we can place actions
  // inside / outside the test window deterministically.
  await AgentAction.collection.updateOne(
    { _id: doc._id },
    { $set: { createdAt } },
  );
  return doc;
}

describe('llmUsageWeeklyCronWorker', () => {
  beforeAll(async () => {
    await setupMongo();
    await Promise.all([
      College.syncIndexes(),
      AgentAction.syncIndexes(),
      LLMUsageSnapshot.syncIndexes(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await teardownMongo();
  }, 30_000);

  afterEach(async () => {
    await clearCollections();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  // ── Public exports / contract ─────────────────────────────────────────
  describe('exports', () => {
    it('exports LLM_USAGE_WEEKLY_JOB_OPTS with attempts=3 and Mon 06:00 UTC cron pattern', () => {
      expect(LLM_USAGE_WEEKLY_JOB_OPTS.attempts).toBe(3);
      expect(LLM_USAGE_WEEKLY_JOB_OPTS.cronPattern).toBe('0 6 * * 1');
      expect(LLM_USAGE_WEEKLY_JOB_OPTS.backoff.type).toBe('exponential');
    });

    it('registers the LLM_USAGE_WEEKLY queue name under the platform_ namespace', () => {
      expect(QUEUE_NAMES).toHaveProperty('LLM_USAGE_WEEKLY');
      // BullMQ rejects `:` in queue/job names; underscores are the codebase convention
      // (introduced in 15d4182, after the queue manager hit "Queue name cannot contain :").
      expect((QUEUE_NAMES as Record<string, string>).LLM_USAGE_WEEKLY).toBe(
        'platform_llm_usage_weekly',
      );
    });

    it('exports LLM_USAGE_WEEKLY_CONCURRENCY = 10 (bounded fan-out cap)', () => {
      expect(LLM_USAGE_WEEKLY_CONCURRENCY).toBe(10);
    });

    it('startOfLastWeek / endOfLastWeek return Mon 00:00 UTC ... Sun 23:59:59.999 UTC of the completed week', () => {
      // FROZEN_NOW = Wed 2026-04-29 06:00 UTC → completed-week =
      // 2026-04-20 (Mon) 00:00 UTC ... 2026-04-26 (Sun) 23:59:59.999 UTC.
      expect(startOfLastWeek().toISOString()).toBe(
        EXPECTED_WEEK_START.toISOString(),
      );
      expect(endOfLastWeek().toISOString()).toBe(
        EXPECTED_WEEK_END.toISOString(),
      );
    });
  });

  // ── Test 1: iterates active colleges ──────────────────────────────────
  it('iterates active colleges and writes one snapshot per active college', async () => {
    const a = await seedCollege({ weeklyInr: 100 });
    const b = await seedCollege({ weeklyInr: 200 });
    await seedAction({ collegeId: a._id, type: 'chat', costInr: 10 });
    await seedAction({ collegeId: b._id, type: 'forecast', costInr: 20 });

    await llmUsageWeeklyCronWorker(buildJob());

    const snaps = await LLMUsageSnapshot.find().sort({ collegeId: 1 });
    expect(snaps).toHaveLength(2);
    const ids = snaps.map((s) => String(s.collegeId)).sort();
    expect(ids).toEqual([String(a._id), String(b._id)].sort());
  });

  // ── Test 2: snapshot has correct totalCostInr + totalCalls ────────────
  it('writes a snapshot with totalCostInr summed and totalCalls counted from the last-completed-week AgentActions', async () => {
    const college = await seedCollege({ weeklyInr: 1000 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 12.5 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 7.5 });
    await seedAction({
      collegeId: college._id,
      type: 'forecast',
      costInr: 30,
    });
    // Action OUTSIDE the window (in the current in-progress week) — must
    // be excluded from the snapshot.
    await seedAction({
      collegeId: college._id,
      type: 'risk',
      costInr: 999,
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
    });
    // Action BEFORE the window (two weeks ago) — must also be excluded.
    await seedAction({
      collegeId: college._id,
      type: 'situations',
      costInr: 888,
      createdAt: new Date('2026-04-13T12:00:00.000Z'),
    });

    await llmUsageWeeklyCronWorker(buildJob());

    const snap = await LLMUsageSnapshot.findOne({ collegeId: college._id });
    expect(snap).toBeTruthy();
    expect(snap!.totalCostInr).toBe(50); // 12.5 + 7.5 + 30
    expect(snap!.totalCalls).toBe(3);
    expect(snap!.weekStart.toISOString()).toBe(
      EXPECTED_WEEK_START.toISOString(),
    );
    expect(snap!.weekEnd.toISOString()).toBe(EXPECTED_WEEK_END.toISOString());
  });

  // ── Test 3: byType keys correctly populated from AgentAction.type ────
  it('byType correctly aggregates per-type call counts (free-form keys)', async () => {
    const college = await seedCollege({ weeklyInr: 1000 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 1 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 1 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 1 });
    await seedAction({
      collegeId: college._id,
      type: 'forecast',
      costInr: 1,
    });
    await seedAction({
      collegeId: college._id,
      type: 'reminder-draft',
      costInr: 1,
    });

    await llmUsageWeeklyCronWorker(buildJob());

    const snap = await LLMUsageSnapshot.findOne({ collegeId: college._id });
    expect(snap).toBeTruthy();
    const byType = snap!.byType as Record<string, number>;
    expect(byType.chat).toBe(3);
    expect(byType.forecast).toBe(1);
    expect(byType['reminder-draft']).toBe(1);
    expect(snap!.totalCalls).toBe(5);
  });

  // ── Test 4: limit at time of snapshot captured (frozen against later changes) ──
  it('captures limitAtTime + alertThresholdAtTime as they were at cron-run time, not the current College value', async () => {
    const college = await seedCollege({
      weeklyInr: 500,
      alertThresholdPct: 75,
    });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 5 });

    await llmUsageWeeklyCronWorker(buildJob());

    // Bump the limit AFTER the snapshot. The persisted snapshot must
    // still reflect the OLD value.
    await College.updateOne(
      { _id: college._id },
      { $set: { 'aiSpendLimits.weeklyInr': 9999, 'aiSpendLimits.alertThresholdPct': 99 } },
    );

    const snap = await LLMUsageSnapshot.findOne({ collegeId: college._id });
    expect(snap).toBeTruthy();
    expect(snap!.limitAtTime).toBe(500);
    expect(snap!.alertThresholdAtTime).toBe(75);
  });

  // ── Test 5: per-college error tolerance ──────────────────────────────
  it('one college throwing during aggregation does NOT prevent snapshots for other colleges', async () => {
    const a = await seedCollege({ weeklyInr: 100 });
    const b = await seedCollege({ weeklyInr: 200 });
    const c = await seedCollege({ weeklyInr: 300 });

    await seedAction({ collegeId: a._id, type: 'chat', costInr: 1 });
    await seedAction({ collegeId: b._id, type: 'chat', costInr: 2 });
    await seedAction({ collegeId: c._id, type: 'chat', costInr: 3 });

    // Stub aggregate to throw ONLY for college B.
    const realAggregate = AgentAction.aggregate.bind(AgentAction);
    const aggregateSpy = vi
      .spyOn(AgentAction, 'aggregate')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((pipeline: any) => {
        // pipeline[0] is `{ $match: { collegeId, createdAt: ... } }`
        const stage0 = Array.isArray(pipeline) ? pipeline[0] : undefined;
        const matchedId =
          stage0 &&
          typeof stage0 === 'object' &&
          stage0.$match &&
          stage0.$match.collegeId
            ? String(stage0.$match.collegeId)
            : '';
        if (matchedId === String(b._id)) {
          // Mongoose Aggregate is thenable; return a rejected promise-shape
          // that the worker's `await` will throw on.
          return Promise.reject(
            new Error('forced failure for college B'),
          ) as unknown as ReturnType<typeof realAggregate>;
        }
        return realAggregate(pipeline);
      });

    await llmUsageWeeklyCronWorker(buildJob());
    aggregateSpy.mockRestore();

    // A and C must still have snapshots; B must not.
    const snaps = await LLMUsageSnapshot.find();
    const ids = snaps.map((s) => String(s.collegeId));
    expect(ids).toContain(String(a._id));
    expect(ids).toContain(String(c._id));
    expect(ids).not.toContain(String(b._id));
  });

  // ── Test 6: skips inactive colleges ──────────────────────────────────
  it('skips colleges with status != "active"', async () => {
    const active = await seedCollege({ status: 'active', weeklyInr: 100 });
    const inactive = await seedCollege({ status: 'inactive', weeklyInr: 100 });
    const suspended = await seedCollege({
      status: 'suspended',
      weeklyInr: 100,
    });

    await seedAction({ collegeId: active._id, type: 'chat', costInr: 1 });
    await seedAction({ collegeId: inactive._id, type: 'chat', costInr: 1 });
    await seedAction({ collegeId: suspended._id, type: 'chat', costInr: 1 });

    await llmUsageWeeklyCronWorker(buildJob());

    const snaps = await LLMUsageSnapshot.find();
    expect(snaps).toHaveLength(1);
    expect(String(snaps[0]!.collegeId)).toBe(String(active._id));
  });

  // ── Test 7: bounded concurrency = 10 ─────────────────────────────────
  it('processes at most 10 colleges in flight at any one time', async () => {
    // Seed 25 active colleges (well over the cap).
    const colleges = await Promise.all(
      Array.from({ length: 25 }, () => seedCollege({ weeklyInr: 1 })),
    );
    expect(colleges).toHaveLength(25);

    // Replace the aggregate with a stub that resolves on the next
    // microtask, instrumented with an in-flight counter. The worker is
    // expected to keep `inFlight` ≤ 10 at all times.
    let inFlight = 0;
    let peak = 0;
    const aggregateSpy = vi
      .spyOn(AgentAction, 'aggregate')
      .mockImplementation(() => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        return new Promise((resolve) => {
          // Use queueMicrotask + a chain of awaits to force several
          // event-loop turns so concurrent stubs really do overlap.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queueMicrotask(() => {
            inFlight -= 1;
            resolve([] as unknown as never);
          });
        }) as unknown as ReturnType<typeof AgentAction.aggregate>;
      });

    await llmUsageWeeklyCronWorker(buildJob());
    aggregateSpy.mockRestore();

    expect(peak).toBeLessThanOrEqual(10);
    // Sanity: cap is enforced AND we actually fanned out (i.e. it's not
    // accidentally serial).
    expect(peak).toBeGreaterThan(1);
  });

  // ── Test 8: empty-window sanity (zero-week explicit row) ─────────────
  it('writes an explicit zero-week snapshot when no AgentActions exist in the window', async () => {
    const college = await seedCollege({ weeklyInr: 100 });
    // Seed an action OUTSIDE the window — confirms the worker is
    // window-bounded and not just "any action ever".
    await seedAction({
      collegeId: college._id,
      type: 'chat',
      costInr: 999,
      createdAt: new Date('2026-04-13T12:00:00.000Z'),
    });

    await llmUsageWeeklyCronWorker(buildJob());

    const snap = await LLMUsageSnapshot.findOne({ collegeId: college._id });
    expect(snap).toBeTruthy();
    expect(snap!.totalCostInr).toBe(0);
    expect(snap!.totalCalls).toBe(0);
    expect(snap!.byType).toEqual({});
    expect(snap!.limitAtTime).toBe(100);
    expect(snap!.alertThresholdAtTime).toBe(80);
  });

  // ── Test 9: structured log line per college ──────────────────────────
  it('emits a [llm-budget:weekly] structured log line per college', async () => {
    const college = await seedCollege({ weeklyInr: 100 });
    await seedAction({ collegeId: college._id, type: 'chat', costInr: 25 });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await llmUsageWeeklyCronWorker(buildJob());

    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    logSpy.mockRestore();
    const line = calls.find((s) => s.includes('[llm-budget:weekly]'));
    expect(line).toBeDefined();
    expect(line!).toContain(`college=${String(college._id)}`);
    expect(line!).toContain('spent=25');
    expect(line!).toContain('limit=100');
    expect(line!).toContain('pct=25');
  });
});
