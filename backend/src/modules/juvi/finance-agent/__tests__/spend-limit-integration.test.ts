/**
 * Task L4 — Pre-call gate integration (llm-spend-limits feature).
 *
 * Verifies that `assertWithinSpendLimit` is wired into each finance-agent
 * service entry point, that the 429 throw propagates cleanly with a
 * structured detail payload, and that the warning state is surfaced on
 * the API response shapes that natively support it (forecast + chat
 * `final` event). Array-shape endpoints (risk-scores, situations,
 * reminder-drafts) are gated for blocking but defer warning surface to
 * L7's UI design.
 *
 * The LLM client is mocked at the module level — same vi.hoisted pattern
 * as service.test.ts. MongoDB runs via mongodb-memory-server.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import mongoose, { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../../__tests__/helpers/mongoMemory';

import { College } from '../../../../models/College';
import { Student } from '../../../../models/people/Student';
import { Person } from '../../../../models/people/Person';
import { AgentAction } from '../../../../models/juvi/AgentAction';

import { AppError } from '../../../../middleware/errorHandler';
import { _resetCachesForTest } from '../../../platform/spend-limits/cache';

// ── Mock LLM client (same pattern as service.test.ts) ──────────────────

const { completeMock, streamMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  streamMock: vi.fn(),
}));

vi.mock('../llm-client', async () => {
  const actual = await vi.importActual<typeof import('../llm-client')>('../llm-client');
  return {
    ...actual,
    createLLMClient: () => ({
      provider: 'claude',
      complete: completeMock,
      stream: streamMock,
    }),
  };
});

vi.mock('../../../../shared/queue/QueueManager', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/queue/QueueManager')>(
    '../../../../shared/queue/QueueManager',
  );
  return {
    ...actual,
    addJob: vi.fn().mockResolvedValue({ id: 'mock' }),
  };
});

import {
  handleChat,
  handleForecastNarrative,
  handleRiskScores,
  handleSituations,
  handleReminderDrafts,
  handleApproveDrafts,
  type AgentChatChunk,
} from '../service';

// ── Helpers ─────────────────────────────────────────────────────────────

const oid = (): Types.ObjectId => new mongoose.Types.ObjectId();

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function consumeChat(
  iter: AsyncGenerator<AgentChatChunk>,
): Promise<AgentChatChunk[]> {
  const chunks: AgentChatChunk[] = [];
  for await (const ch of iter) chunks.push(ch);
  return chunks;
}

async function makeCollege(opts: {
  weeklyInr: number;
  alertThresholdPct?: number;
} = { weeklyInr: 0 }): Promise<Types.ObjectId> {
  const c = await College.create({
    name: 'Test College',
    code: `TC${Math.floor(Math.random() * 10_000_000)}`,
    address: { line1: '1 Test', city: 'X', state: 'Y', pincode: '500001' },
    contactEmail: 't@t.edu',
    contactPhone: '+91-9999999999',
    aiSpendLimits: {
      weeklyInr: opts.weeklyInr,
      alertThresholdPct: opts.alertThresholdPct ?? 80,
    },
  });
  return c._id;
}

async function seedSpend(collegeId: Types.ObjectId, costInr: number): Promise<void> {
  await AgentAction.collection.insertOne({
    collegeId,
    userId: oid(),
    type: 'forecast',
    maskedPrompt: 'm',
    maskedResponse: 'm',
    provider: 'claude',
    model: 'claude-sonnet-4.5',
    durationMs: 100,
    inputTokens: 10,
    outputTokens: 10,
    costInr,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function makeStudent(collegeId: Types.ObjectId): Promise<Types.ObjectId> {
  const person = await Person.create({
    collegeId,
    name: 'Test Student',
    phone: `+91-${Math.floor(Math.random() * 10_000_000_000)}`,
    email: `s${Math.floor(Math.random() * 10_000_000)}@t.edu`,
  });
  const student = await Student.create({
    collegeId,
    personId: person._id,
    rollNumber: `RN${Math.floor(Math.random() * 10_000_000)}`,
    admissionYear: 2024,
    status: 'active',
  });
  return student._id;
}

beforeAll(async () => {
  await setupMongo();
});

afterAll(async () => {
  await teardownMongo();
});

beforeEach(() => {
  completeMock.mockReset();
  streamMock.mockReset();
  _resetCachesForTest();
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.LLM_PROVIDER = 'claude';
});

afterEach(async () => {
  await clearCollections();
});

// ─── handleForecastNarrative ──────────────────────────────────────────────────

describe('handleForecastNarrative + spend-limit gate', () => {
  it('weeklyInr=0 → bypass: gate fires but no warning, no block, narrative returned', async () => {
    const collegeId = await makeCollege({ weeklyInr: 0 });
    completeMock.mockResolvedValueOnce({
      text: 'narrative',
      provider: 'claude',
      model: 'claude-sonnet-4.5',
      inputTokens: 10,
      outputTokens: 10,
      costInr: 0.1,
      durationMs: 100,
    });

    const result = await handleForecastNarrative(String(collegeId), new Date('2026-04-30'));

    expect(result.narrative).toBe('narrative');
    expect(result.budgetWarning).toBeUndefined();
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('gate at 79% → no warning, narrative returned (call proceeds)', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await seedSpend(collegeId, 79); // 79% utilisation
    completeMock.mockResolvedValueOnce({
      text: 'narrative',
      provider: 'claude',
      model: 'claude-sonnet-4.5',
      inputTokens: 10,
      outputTokens: 10,
      costInr: 0.1,
      durationMs: 100,
    });

    const result = await handleForecastNarrative(String(collegeId), new Date('2026-04-30'));

    expect(result.narrative).toBe('narrative');
    expect(result.budgetWarning).toBeUndefined();
  });

  it('gate at 81% → warning attached to response, narrative still returned', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await seedSpend(collegeId, 81);
    completeMock.mockResolvedValueOnce({
      text: 'narrative',
      provider: 'claude',
      model: 'claude-sonnet-4.5',
      inputTokens: 10,
      outputTokens: 10,
      costInr: 0.1,
      durationMs: 100,
    });

    const result = await handleForecastNarrative(String(collegeId), new Date('2026-04-30'));

    expect(result.narrative).toBe('narrative');
    expect(result.budgetWarning).toBeDefined();
    expect(result.budgetWarning?.spent).toBe(81);
    expect(result.budgetWarning?.limit).toBe(100);
    expect(result.budgetWarning?.pct).toBeCloseTo(81, 5);
    expect(typeof result.budgetWarning?.resetsAt).toBe('string');
  });

  it('gate at 100% → throws AppError(429) with structured detail; LLM not called', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 120);

    await expect(
      handleForecastNarrative(String(collegeId), new Date('2026-04-30')),
    ).rejects.toMatchObject({
      statusCode: 429,
      message: 'Weekly LLM budget exceeded',
      detail: { limit: 100 },
    });
    // The crucial behavior: no LLM call when budget is exceeded
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('detail payload carries { spent, limit, pct, resetsAt } as ISO string', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200);

    let caught: AppError | null = null;
    try {
      await handleForecastNarrative(String(collegeId), new Date('2026-04-30'));
    } catch (e) {
      caught = e as AppError;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught?.statusCode).toBe(429);
    const detail = caught?.detail as { spent: number; limit: number; pct: number; resetsAt: string };
    expect(detail.spent).toBe(200);
    expect(detail.limit).toBe(100);
    expect(detail.pct).toBeCloseTo(200, 5);
    expect(typeof detail.resetsAt).toBe('string');
    // ISO date is parseable
    expect(Number.isNaN(Date.parse(detail.resetsAt))).toBe(false);
  });

  it('default-allow on DB error (gate failure does NOT 429)', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    // Force the limits load to fail. Service should swallow + proceed.
    vi.spyOn(College, 'findById').mockImplementationOnce(() => {
      throw new Error('synthetic outage');
    });
    completeMock.mockResolvedValueOnce({
      text: 'narrative',
      provider: 'claude',
      model: 'claude-sonnet-4.5',
      inputTokens: 10,
      outputTokens: 10,
      costInr: 0.1,
      durationMs: 100,
    });

    const result = await handleForecastNarrative(String(collegeId), new Date('2026-04-30'));

    expect(result.narrative).toBe('narrative'); // call proceeded
    expect(result.budgetWarning).toBeUndefined();
  });
});

// ─── handleChat (streaming) ───────────────────────────────────────────────────

describe('handleChat + spend-limit gate', () => {
  it('gate at 100% → yields a single error chunk; LLM stream NEVER opened', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 150);

    const userId = String(oid());
    const chunks = await consumeChat(
      handleChat(String(collegeId), userId, 'hello'),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.type).toBe('error');
    expect(chunks[0]?.error).toContain('Weekly LLM budget exceeded');
    expect(streamMock).not.toHaveBeenCalled();
  });

  it('gate fires ONCE at request entry; mid-stream not gated', async () => {
    const collegeId = await makeCollege({ weeklyInr: 1000 });
    await seedSpend(collegeId, 50); // 5% — well under threshold

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        { delta: 'A', done: false },
        { delta: 'B', done: false },
        {
          delta: '',
          done: true,
          final: {
            text: 'AB',
            inputTokens: 5,
            outputTokens: 2,
            model: 'claude-sonnet-4.5',
            provider: 'claude' as const,
            costInr: 0.05,
            durationMs: 50,
          },
        },
      ]),
    );

    const userId = String(oid());
    const chunks = await consumeChat(
      handleChat(String(collegeId), userId, 'hi'),
    );

    // 2 deltas + 1 done — no gate-error chunk
    const errors = chunks.filter((c) => c.type === 'error');
    expect(errors).toHaveLength(0);
    const done = chunks.find((c) => c.type === 'done');
    expect(done).toBeDefined();
    // Streaming was opened exactly once (mid-stream not re-gated).
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('gate at 81% → warning surfaced on done event final.budgetWarning', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100, alertThresholdPct: 80 });
    await seedSpend(collegeId, 81);

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        { delta: 'hi', done: false },
        {
          delta: '',
          done: true,
          final: {
            text: 'hi',
            inputTokens: 5,
            outputTokens: 2,
            model: 'claude-sonnet-4.5',
            provider: 'claude' as const,
            costInr: 0.05,
            durationMs: 50,
          },
        },
      ]),
    );

    const userId = String(oid());
    const chunks = await consumeChat(
      handleChat(String(collegeId), userId, 'hi'),
    );

    const done = chunks.find((c) => c.type === 'done');
    expect(done?.final?.budgetWarning).toBeDefined();
    expect(done?.final?.budgetWarning?.limit).toBe(100);
    expect(done?.final?.budgetWarning?.spent).toBe(81);
  });
});

// ─── handleRiskScores ──────────────────────────────────────────────────────────

describe('handleRiskScores + spend-limit gate', () => {
  it('includeNarrative=false → gate does NOT fire (no LLM call site)', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200); // would block IF gate fired
    const studentId = await makeStudent(collegeId);

    // Should NOT throw — no LLM call, so no gate
    const result = await handleRiskScores(String(collegeId), [String(studentId)], false);

    expect(result).toHaveLength(1);
    expect(result[0]?.studentId).toBe(String(studentId));
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('includeNarrative=true at 100% → throws 429; LLM not called', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200);
    const studentId = await makeStudent(collegeId);

    await expect(
      handleRiskScores(String(collegeId), [String(studentId)], true),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

// ─── handleSituations ─────────────────────────────────────────────────────────

describe('handleSituations + spend-limit gate', () => {
  it('gate at 100% → throws 429 BEFORE LLM call', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200);
    const userId = String(oid());

    // Seed a candidate so the LLM path would normally fire
    await makeStudent(collegeId);

    await expect(
      handleSituations(String(collegeId), userId),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

// ─── handleReminderDrafts ─────────────────────────────────────────────────────

describe('handleReminderDrafts + spend-limit gate', () => {
  it('gate at 100% → throws 429 BEFORE bounded-concurrency LLM batch', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200);
    const studentId = await makeStudent(collegeId);

    await expect(
      handleReminderDrafts(String(collegeId), [String(studentId)]),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(completeMock).not.toHaveBeenCalled();
  });
});

// ─── Non-LLM endpoints — gate must NOT fire ───────────────────────────────────

describe('non-LLM endpoints do NOT invoke the gate', () => {
  it('handleApproveDrafts: no gate (no LLM call)', async () => {
    const collegeId = await makeCollege({ weeklyInr: 100 });
    await seedSpend(collegeId, 200); // would block IF gate fired
    const studentId = await makeStudent(collegeId);
    const userId = String(oid());

    const result = await handleApproveDrafts(String(collegeId), userId, [
      { studentId: String(studentId), subject: 'S', body: 'B' },
    ]);

    expect(result.approvedCount).toBe(1);
  });
});

// ─── AppError detail surfacing through errorHandler ───────────────────────────

describe('errorHandler — AppError.detail surfacing', () => {
  // We test the errorHandler in isolation here so the detail-shaping
  // contract is locked at the middleware layer (independent of L4 service
  // wiring).
  it('AppError without detail → body is { error }', async () => {
    const { errorHandler } = await import('../../../../middleware/errorHandler');
    const err = new AppError(404, 'Not found');
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    errorHandler(err, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('AppError WITH detail → body is { error, detail }', async () => {
    const { errorHandler } = await import('../../../../middleware/errorHandler');
    const err = new AppError(429, 'Weekly LLM budget exceeded', {
      spent: 200,
      limit: 100,
      pct: 200,
      resetsAt: '2026-05-05T00:00:00.000Z',
    });
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    errorHandler(err, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Weekly LLM budget exceeded',
      detail: {
        spent: 200,
        limit: 100,
        pct: 200,
        resetsAt: '2026-05-05T00:00:00.000Z',
      },
    });
  });
});
