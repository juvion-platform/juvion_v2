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
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../../__tests__/helpers/mongoMemory';

import { Payment } from '../../../../models/finance/Payment';
import { DefaulterRecord } from '../../../../models/finance/DefaulterRecord';
import { FeeReminder } from '../../../../models/finance/FeeReminder';
import { FinancialHold } from '../../../../models/finance/FinancialHold';
import { Student } from '../../../../models/people/Student';
import { Person } from '../../../../models/people/Person';
import { Parent } from '../../../../models/people/Parent';

import { AgentConversation } from '../../../../models/juvi/AgentConversation';
import { AgentAction } from '../../../../models/juvi/AgentAction';
import { SituationDismissal } from '../../../../models/juvi/SituationDismissal';

import { AppError } from '../../../../middleware/errorHandler';

/**
 * Task A4 — finance-agent service orchestrator (fee-analytics-ai-native).
 *
 * Tests cover the 8 public methods of `service.ts`:
 *   - handleChat (streaming)
 *   - handleForecastNarrative
 *   - handleRiskScores (with + without narrative)
 *   - handleSituations
 *   - handleReminderDrafts
 *   - handleApproveDrafts
 *   - handleDismissSituation
 *
 * The LLM client is mocked at the module level — no real network calls.
 * Mongo runs in memory via the shared helper.
 */

// ── Mock the LLM client at module level ────────────────────────────────
// Using vi.hoisted so the mock fns exist before vi.mock is evaluated.

const { completeMock, streamMock, addJobMock } = vi.hoisted(() => {
  return {
    completeMock: vi.fn(),
    streamMock: vi.fn(),
    addJobMock: vi.fn().mockResolvedValue({ id: 'mock-sms-job' }),
  };
});

vi.mock('../llm-client', async () => {
  const actual = await vi.importActual<
    typeof import('../llm-client')
  >('../llm-client');
  return {
    ...actual,
    createLLMClient: () => ({
      provider: 'claude',
      complete: completeMock,
      stream: streamMock,
    }),
  };
});

// Mock the BullMQ enqueue helper used by handleApproveDrafts so we don't
// hit Redis. Match the existing pattern in fee-pin-service tests.
vi.mock('../../../../shared/queue/QueueManager', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/queue/QueueManager')
  >('../../../../shared/queue/QueueManager');
  return {
    ...actual,
    addJob: addJobMock,
  };
});

// ── Import the service AFTER the mocks are registered ──────────────────

import {
  handleChat,
  handleForecastNarrative,
  handleRiskScores,
  handleSituations,
  handleReminderDrafts,
  handleApproveDrafts,
  handleDismissSituation,
  type AgentChatChunk,
} from '../service';

// ── Helpers ─────────────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();
const day = 24 * 60 * 60 * 1000;

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function consumeChat(
  iter: AsyncGenerator<AgentChatChunk>,
): Promise<{ chunks: AgentChatChunk[]; text: string }> {
  const chunks: AgentChatChunk[] = [];
  let text = '';
  for await (const ch of iter) {
    chunks.push(ch);
    if (ch.type === 'delta' && ch.text) text += ch.text;
  }
  return { chunks, text };
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
  addJobMock.mockClear();
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.LLM_PROVIDER = 'claude';
});
afterEach(async () => {
  await clearCollections();
});

// ─────────────────────────────────────────────────────────────────────────
// handleChat
// ─────────────────────────────────────────────────────────────────────────

describe('handleChat', () => {
  it('streams delta chunks then a done chunk; persists conversation + AgentAction', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        { delta: 'Hello ', done: false },
        { delta: 'Officer', done: false },
        {
          delta: '',
          done: true,
          final: {
            text: 'Hello Officer',
            inputTokens: 50,
            outputTokens: 12,
            model: 'claude-sonnet-4-5',
            provider: 'claude',
            costInr: 0.01,
            durationMs: 800,
          },
        },
      ]),
    );

    const { chunks, text } = await consumeChat(
      handleChat(collegeId, userId, 'Why is collection slow?'),
    );

    const deltas = chunks.filter((c) => c.type === 'delta');
    expect(deltas.length).toBeGreaterThan(0);
    expect(text).toBe('Hello Officer');

    const dones = chunks.filter((c) => c.type === 'done');
    expect(dones.length).toBe(1);
    expect(dones[0]?.final?.provider).toBe('claude');
    expect(dones[0]?.final?.conversationId).toBeTruthy();
    expect(dones[0]?.final?.auditId).toBeTruthy();

    // AgentConversation + AgentAction persisted
    const convo = await AgentConversation.findOne({ collegeId });
    expect(convo).not.toBeNull();
    expect(convo!.turns).toHaveLength(2);
    expect(convo!.turns[0]?.role).toBe('user');
    expect(convo!.turns[1]?.role).toBe('assistant');
    expect(convo!.turns[1]?.content).toBe('Hello Officer');

    const action = await AgentAction.findOne({ collegeId, type: 'chat' });
    expect(action).not.toBeNull();
    // Spec: AgentAction stores MASKED prompt (it is the user's plain prompt
    // here — no PII was sent — but the field MUST be populated).
    expect(action!.maskedPrompt).toContain('collection');
    expect(action!.maskedResponse).toContain('Hello Officer');
    expect(action!.provider).toBe('claude');
  });

  it('loads prior conversation turns when conversationId is supplied', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    // Seed a conversation with one prior round
    const seed = await AgentConversation.create({
      collegeId,
      userId,
      conversationId: 'conv-123',
      turns: [
        { role: 'user', content: 'first q', timestamp: new Date() },
        { role: 'assistant', content: 'first a', timestamp: new Date() },
      ],
      lastModel: 'claude-sonnet-4-5',
      lastProvider: 'claude',
      totalInputTokens: 30,
      totalOutputTokens: 10,
      totalCostInr: 0.005,
    });

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        {
          delta: 'follow-up answer',
          done: false,
        },
        {
          delta: '',
          done: true,
          final: {
            text: 'follow-up answer',
            inputTokens: 80,
            outputTokens: 10,
            model: 'claude-sonnet-4-5',
            provider: 'claude',
            costInr: 0.02,
            durationMs: 500,
          },
        },
      ]),
    );

    await consumeChat(
      handleChat(
        collegeId,
        userId,
        'follow up',
        seed.conversationId,
      ),
    );

    // Verify prior turns were fed to the LLM
    const callMessages = streamMock.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    const userTurns = callMessages.filter((m) => m.role === 'user');
    expect(userTurns.length).toBeGreaterThanOrEqual(2);
    expect(userTurns.find((m) => m.content === 'first q')).toBeTruthy();
    expect(userTurns.find((m) => m.content.includes('follow up'))).toBeTruthy();

    // Conversation grows to 4 turns
    const refreshed = await AgentConversation.findById(seed._id);
    expect(refreshed!.turns).toHaveLength(4);
  });

  it('starts a fresh conversationId when supplied id does not exist', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        {
          delta: 'fresh',
          done: false,
        },
        {
          delta: '',
          done: true,
          final: {
            text: 'fresh',
            inputTokens: 10,
            outputTokens: 5,
            model: 'claude-sonnet-4-5',
            provider: 'claude',
            costInr: 0.001,
            durationMs: 100,
          },
        },
      ]),
    );

    const { chunks } = await consumeChat(
      handleChat(collegeId, userId, 'q', 'does-not-exist'),
    );
    const done = chunks.find((c) => c.type === 'done');
    // Server emits a new id (UUID) when the supplied one is unknown
    expect(done?.final?.conversationId).not.toBe('does-not-exist');
    expect(done?.final?.conversationId).toBeTruthy();
  });

  it('drops oldest turns when prior history exceeds the 8K input-token budget', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    // Seed 12 long turns (~ 4 chars/token rule → > 8K input tokens worth)
    const big = 'x'.repeat(4000); // ~1000 tokens by char/4 estimate
    const turns = [];
    for (let i = 0; i < 12; i++) {
      turns.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: big,
        timestamp: new Date(),
      });
    }
    const seed = await AgentConversation.create({
      collegeId,
      userId,
      conversationId: 'conv-big',
      turns,
      lastModel: 'claude-sonnet-4-5',
      lastProvider: 'claude',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostInr: 0,
    });

    streamMock.mockReturnValueOnce(
      asAsyncIterable([
        {
          delta: 'short',
          done: false,
        },
        {
          delta: '',
          done: true,
          final: {
            text: 'short',
            inputTokens: 10,
            outputTokens: 5,
            model: 'claude-sonnet-4-5',
            provider: 'claude',
            costInr: 0.001,
            durationMs: 100,
          },
        },
      ]),
    );

    await consumeChat(
      handleChat(collegeId, userId, 'tiny', seed.conversationId),
    );

    const sentMessages = streamMock.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    // After truncation: should contain fewer than 12 prior turns + the new
    // user turn + the system prefix.
    const priorContentTurns = sentMessages.filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && m.content === big,
    );
    expect(priorContentTurns.length).toBeLessThan(12);
  });

  it('on stream error: yields an error chunk + does not throw', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    async function* errorStream() {
      yield { delta: 'partial', done: false };
      throw new Error('upstream went away');
    }
    streamMock.mockReturnValueOnce(errorStream());

    const { chunks } = await consumeChat(
      handleChat(collegeId, userId, 'q'),
    );

    const errChunks = chunks.filter((c) => c.type === 'error');
    expect(errChunks.length).toBe(1);
    expect(errChunks[0]?.error).toMatch(/upstream/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleForecastNarrative
// ─────────────────────────────────────────────────────────────────────────

describe('handleForecastNarrative', () => {
  it('returns projection + LLM narrative; logs AgentAction(forecast)', async () => {
    const collegeId = String(oid());
    // Seed 35 days of payments so Holt-Winters fires
    const today = new Date();
    for (let i = 0; i < 35; i++) {
      await Payment.create({
        collegeId,
        studentId: oid(),
        receiptNumber: `R${i}-${Math.random().toString(36).slice(2)}`,
        amount: 10_000,
        paymentMode: 'upi',
        status: 'success',
        paymentDate: new Date(today.getTime() - i * day),
        allocations: [],
      });
    }

    completeMock.mockResolvedValueOnce({
      text: 'Drivers: UPI down 18%, scholarships delayed.',
      inputTokens: 200,
      outputTokens: 30,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.005,
      durationMs: 600,
    });

    const result = await handleForecastNarrative(collegeId, today);
    expect(result.projection.mean).toBeGreaterThan(0);
    expect(result.projection.confidence).toBeGreaterThan(0);
    expect(result.narrative).toBe(
      'Drivers: UPI down 18%, scholarships delayed.',
    );
    expect(result.generatedAt).toBeInstanceOf(Date);

    const action = await AgentAction.findOne({ collegeId, type: 'forecast' });
    expect(action).not.toBeNull();
    expect(action!.maskedResponse).toContain('UPI');
  });

  it('returns narrative=null but projection populated when LLM fails', async () => {
    const collegeId = String(oid());
    // Seed minimal payments
    await Payment.create({
      collegeId,
      studentId: oid(),
      receiptNumber: 'R-only-1',
      amount: 5000,
      paymentMode: 'upi',
      status: 'success',
      paymentDate: new Date(),
      allocations: [],
    });

    completeMock.mockRejectedValueOnce(new Error('LLM 503'));

    const result = await handleForecastNarrative(collegeId, new Date());
    expect(result.narrative).toBeNull();
    expect(result.projection).toBeDefined();
    expect(result.projection.mean).toBeGreaterThanOrEqual(0);
  });

  it('truncates narratives > 300 chars or > 3 sentences', async () => {
    const collegeId = String(oid());
    await Payment.create({
      collegeId,
      studentId: oid(),
      receiptNumber: 'R-trunc-1',
      amount: 5000,
      paymentMode: 'upi',
      status: 'success',
      paymentDate: new Date(),
      allocations: [],
    });

    const tooLong =
      'Sentence one is ok. Sentence two is also ok. Sentence three over the limit. Sentence four trips the cap.';
    completeMock.mockResolvedValueOnce({
      text: tooLong,
      inputTokens: 50,
      outputTokens: 100,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.002,
      durationMs: 500,
    });

    const result = await handleForecastNarrative(collegeId, new Date());
    expect(result.narrative).not.toBeNull();
    // Truncated to <= 3 sentences
    const sentenceCount = (result.narrative ?? '').split(
      /[.!?]\s+/,
    ).filter((s) => s.trim().length > 0).length;
    expect(sentenceCount).toBeLessThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleRiskScores
// ─────────────────────────────────────────────────────────────────────────

describe('handleRiskScores', () => {
  it('returns scores for a batch without LLM call when narrative not requested', async () => {
    const collegeId = String(oid());
    const studentIds = [oid(), oid(), oid()];

    for (const sid of studentIds) {
      await DefaulterRecord.create({
        collegeId,
        studentId: sid,
        invoiceId: oid(),
        overdueAmount: 10000,
        daysOverdue: 30,
        escalationStage: 'stage_2',
      });
    }

    const results = await handleRiskScores(
      collegeId,
      studentIds.map(String),
    );
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.tier).toMatch(/low|medium|high|critical|insufficient-data/);
      expect(r.narrative).toBeUndefined();
    }
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('attaches per-student narratives when includeNarrative=true (bounded concurrency)', async () => {
    const collegeId = String(oid());
    const studentIds = [oid(), oid()];

    for (const sid of studentIds) {
      await DefaulterRecord.create({
        collegeId,
        studentId: sid,
        invoiceId: oid(),
        overdueAmount: 10000,
        daysOverdue: 45,
        escalationStage: 'stage_3',
      });
    }

    completeMock.mockImplementation(async () => ({
      text: 'High risk because of long overdue.',
      inputTokens: 30,
      outputTokens: 15,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.001,
      durationMs: 100,
    }));

    const results = await handleRiskScores(
      collegeId,
      studentIds.map(String),
      true,
    );
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.narrative).toBe('High risk because of long overdue.');
    }
    expect(completeMock).toHaveBeenCalledTimes(2);

    // One AgentAction logged per BATCH, not per student
    const actions = await AgentAction.find({ collegeId, type: 'risk' });
    expect(actions).toHaveLength(1);
  });

  it('LLM fail per student → that student keeps narrative undefined; batch continues', async () => {
    const collegeId = String(oid());
    const studentIds = [oid(), oid()];
    for (const sid of studentIds) {
      await DefaulterRecord.create({
        collegeId,
        studentId: sid,
        invoiceId: oid(),
        overdueAmount: 10000,
        daysOverdue: 30,
        escalationStage: 'stage_2',
      });
    }

    let call = 0;
    completeMock.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error('LLM down');
      return {
        text: 'Risk explanation.',
        inputTokens: 20,
        outputTokens: 10,
        model: 'claude-sonnet-4-5',
        provider: 'claude',
        costInr: 0.001,
        durationMs: 100,
      };
    });

    const results = await handleRiskScores(
      collegeId,
      studentIds.map(String),
      true,
    );
    expect(results).toHaveLength(2);
    const withNarrative = results.filter((r) => !!r.narrative);
    const without = results.filter((r) => !r.narrative);
    expect(withNarrative).toHaveLength(1);
    expect(without).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleSituations
// ─────────────────────────────────────────────────────────────────────────

describe('handleSituations', () => {
  it('returns the LLM-picked top situations with id + fingerprint attached', async () => {
    const collegeId = String(oid());
    const userId = String(oid());
    // Seed: trigger holds-without-review (one of the 8 heuristics)
    const studentId = oid();
    await FinancialHold.create({
      collegeId,
      studentId,
      defaulterRecordId: oid(),
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: new Date(Date.now() - 60 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
    });

    const llmJson = JSON.stringify([
      {
        kind: 'holds-without-review',
        severity: 'high',
        title: 'Holds awaiting review',
        narrative: 'A hold has been pending for over 48 hours.',
        studentIds: [String(studentId)],
        actions: [
          { label: 'Review hold', type: 'review_policy' },
          { label: 'Dismiss for 7d', type: 'dismiss' },
        ],
      },
    ]);

    completeMock.mockResolvedValueOnce({
      text: llmJson,
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.003,
      durationMs: 700,
    });

    const situations = await handleSituations(collegeId, userId);
    expect(situations.length).toBeGreaterThan(0);
    const s = situations[0]!;
    expect(s.id).toBeTruthy();
    expect(s.fingerprint).toBeTruthy();
    expect(s.kind).toBe('holds-without-review');
    expect(s.studentIds).toContain(String(studentId));
    expect(s.actions.length).toBeGreaterThan(0);

    const action = await AgentAction.findOne({ collegeId, type: 'situations' });
    expect(action).not.toBeNull();
  });

  it('filters out candidates whose fingerprint matches an active SituationDismissal', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    // Trigger holds-without-review heuristic
    const studentId = oid();
    await FinancialHold.create({
      collegeId,
      studentId,
      defaulterRecordId: oid(),
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: new Date(Date.now() - 60 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
    });

    // Compute fingerprint that the candidate generator will produce.
    const { createHash } = await import('crypto');
    const fingerprint = createHash('sha256')
      .update(`holds-without-review:${String(studentId)}`)
      .digest('hex');

    // Seed an ACTIVE dismissal for that fingerprint
    await SituationDismissal.create({
      collegeId,
      userId,
      situationFingerprint: fingerprint,
      snoozedUntil: new Date(Date.now() + 7 * day),
      reason: 'snoozed',
    });

    completeMock.mockResolvedValueOnce({
      text: '[]',
      inputTokens: 50,
      outputTokens: 5,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.001,
      durationMs: 100,
    });

    const situations = await handleSituations(collegeId, userId);
    // The candidate should be excluded BEFORE the LLM is asked
    expect(situations).toHaveLength(0);

    // The dismissed candidate either short-circuits (LLM never called) OR
    // the LLM is called with the dismissed kind absent from the prompt.
    // Either path proves dismissals are applied BEFORE the LLM, not after.
    if (completeMock.mock.calls.length > 0) {
      const callMessages = completeMock.mock.calls[0]?.[0] as Array<{
        role: string;
        content: string;
      }>;
      const userPrompt =
        callMessages.find((m) => m.role === 'user')?.content ?? '';
      expect(userPrompt).not.toContain('holds-without-review');
    }
  });

  it('returns an empty array when the LLM response is invalid JSON (with retry)', async () => {
    const collegeId = String(oid());
    const userId = String(oid());

    // Trigger any heuristic so candidates exist
    await FinancialHold.create({
      collegeId,
      studentId: oid(),
      defaulterRecordId: oid(),
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: new Date(Date.now() - 60 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
    });

    completeMock.mockResolvedValue({
      text: 'this is prose, not JSON',
      inputTokens: 50,
      outputTokens: 30,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.001,
      durationMs: 200,
    });

    const out = await handleSituations(collegeId, userId);
    expect(out).toEqual([]);
    // Retry once → expect exactly 2 LLM calls before giving up
    expect(completeMock).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleReminderDrafts
// ─────────────────────────────────────────────────────────────────────────

describe('handleReminderDrafts', () => {
  it('produces drafts honoring the tone-ladder rule (first overdue → soft)', async () => {
    const collegeId = String(oid());
    const studentId = oid();
    const personId = oid();
    const parentPersonId = oid();
    const parentDocId = oid();

    await Person.create({
      _id: personId,
      collegeId,
      name: 'Kavya Rao',
      phone: '+919999999999',
    });
    await Person.create({
      _id: parentPersonId,
      collegeId,
      name: 'Ravi Rao',
      phone: '+919888888888',
      preferredLanguage: 'te',
    });
    await Parent.create({
      _id: parentDocId,
      collegeId,
      personId: parentPersonId,
      relationship: 'father',
      isFeeResponsible: true,
    });
    await Student.create({
      _id: studentId,
      collegeId,
      personId,
      admissionYear: 2024,
      primaryParentId: parentDocId,
      rollNumber: '24CS001',
      status: 'active',
      onboardingStatus: 'completed',
    });
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 10000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });

    const draftJson = JSON.stringify({
      language: 'te',
      tone: 'soft',
      subject: 'Friendly reminder',
      body: 'Dear parent, this is a gentle reminder.',
      predictedReadRate: 0.78,
    });
    completeMock.mockResolvedValue({
      text: draftJson,
      inputTokens: 80,
      outputTokens: 40,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.002,
      durationMs: 600,
    });

    const drafts = await handleReminderDrafts(collegeId, [String(studentId)]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.tone).toBe('soft');
    expect(drafts[0]?.studentId).toBe(String(studentId));
    expect(drafts[0]?.templateVersion).toBe('agent-draft-v1');
    expect(drafts[0]?.predictedReadRate).toBeGreaterThan(0);
  });

  it('falls back to a deterministic template when LLM JSON is invalid', async () => {
    const collegeId = String(oid());
    const studentId = oid();
    const personId = oid();
    await Person.create({
      _id: personId,
      collegeId,
      name: 'Asha',
      phone: '+919777777777',
    });
    await Student.create({
      _id: studentId,
      collegeId,
      personId,
      admissionYear: 2024,
      rollNumber: '24CS002',
      status: 'active',
      onboardingStatus: 'completed',
    });
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 10000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });

    completeMock.mockResolvedValue({
      text: 'not JSON',
      inputTokens: 80,
      outputTokens: 40,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.002,
      durationMs: 600,
    });

    const drafts = await handleReminderDrafts(collegeId, [String(studentId)]);
    expect(drafts).toHaveLength(1);
    // Deterministic fallback used
    expect(drafts[0]?.templateVersion).toBe('agent-draft-v1');
    expect(drafts[0]?.body.length).toBeGreaterThan(0);
    expect(drafts[0]?.subject.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleApproveDrafts
// ─────────────────────────────────────────────────────────────────────────

describe('handleApproveDrafts', () => {
  it('creates FeeReminder docs + enqueues sms job + logs reminder-approve action', async () => {
    const collegeId = String(oid());
    const userId = String(oid());
    const studentId = oid();
    const personId = oid();
    await Person.create({
      _id: personId,
      collegeId,
      name: 'Asha',
      phone: '+919777777777',
    });
    await Student.create({
      _id: studentId,
      collegeId,
      personId,
      admissionYear: 2024,
      rollNumber: '24CS010',
      status: 'active',
      onboardingStatus: 'completed',
    });
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 12345,
      daysOverdue: 30,
      escalationStage: 'stage_2',
    });

    const result = await handleApproveDrafts(collegeId, userId, [
      {
        studentId: String(studentId),
        subject: 'Pay your fees',
        body: 'Dear parent, please pay…',
      },
    ]);

    expect(result.approvedCount).toBe(1);
    expect(result.reminderIds).toHaveLength(1);

    const fr = await FeeReminder.findById(result.reminderIds[0]);
    expect(fr).not.toBeNull();
    expect(String(fr!.collegeId)).toBe(collegeId);
    expect(String(fr!.studentId)).toBe(String(studentId));
    expect(fr!.metadata?.source).toBe('agent-draft-v1');
    expect(fr!.metadata?.approvedBy).toBe(userId);
    expect(fr!.metadata?.subject).toBe('Pay your fees');

    expect(addJobMock).toHaveBeenCalledTimes(1);

    const action = await AgentAction.findOne({
      collegeId,
      type: 'reminder-approve',
    });
    expect(action).not.toBeNull();
  });

  it('throws AppError(403) when a draft references a student in a different college', async () => {
    const collegeA = String(oid());
    const collegeB = String(oid());
    const userId = String(oid());
    const studentId = oid();
    const personId = oid();
    await Person.create({ _id: personId, collegeId: collegeB, name: 'X', phone: '+91' });
    await Student.create({
      _id: studentId,
      collegeId: collegeB,
      personId,
      admissionYear: 2024,
      rollNumber: 'X-1',
      status: 'active',
      onboardingStatus: 'completed',
    });

    await expect(
      handleApproveDrafts(collegeA, userId, [
        { studentId: String(studentId), subject: 's', body: 'b' },
      ]),
    ).rejects.toBeInstanceOf(AppError);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleDismissSituation
// ─────────────────────────────────────────────────────────────────────────

describe('handleDismissSituation', () => {
  it('upserts SituationDismissal with snoozedUntil and logs situation-dismiss action', async () => {
    const collegeId = String(oid());
    const userId = String(oid());
    const fingerprint = 'fp-' + Math.random().toString(36).slice(2);

    await handleDismissSituation(
      collegeId,
      userId,
      fingerprint,
      7,
      'not actionable today',
    );

    const dismissal = await SituationDismissal.findOne({
      collegeId,
      userId,
      situationFingerprint: fingerprint,
    });
    expect(dismissal).not.toBeNull();
    const expectedDelta = 7 * day;
    const actualDelta = dismissal!.snoozedUntil.getTime() - Date.now();
    // Allow some test execution slack (tens of seconds)
    expect(actualDelta).toBeLessThanOrEqual(expectedDelta);
    expect(actualDelta).toBeGreaterThan(expectedDelta - 60_000);

    // Calling again with the same fingerprint upserts (1 doc total)
    await handleDismissSituation(
      collegeId,
      userId,
      fingerprint,
      30,
      'extending',
    );
    const count = await SituationDismissal.countDocuments({
      collegeId,
      userId,
      situationFingerprint: fingerprint,
    });
    expect(count).toBe(1);

    const action = await AgentAction.findOne({
      collegeId,
      type: 'situation-dismiss',
    });
    expect(action).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PII spot-check across endpoints
// ─────────────────────────────────────────────────────────────────────────

describe('PII masking in audit log', () => {
  it('handleReminderDrafts: AgentAction.maskedPrompt contains tokens, not raw guardian phone', async () => {
    const collegeId = String(oid());
    const studentId = oid();
    const personId = oid();
    const parentPersonId = oid();
    const parentDocId = oid();
    const RAW_GUARDIAN_PHONE = '+91-9123456789';

    await Person.create({
      _id: personId,
      collegeId,
      name: 'Kavya',
      phone: '+91-9000000000',
    });
    await Person.create({
      _id: parentPersonId,
      collegeId,
      name: 'Ravi',
      phone: RAW_GUARDIAN_PHONE,
      preferredLanguage: 'en',
    });
    await Parent.create({
      _id: parentDocId,
      collegeId,
      personId: parentPersonId,
      relationship: 'father',
      isFeeResponsible: true,
    });
    await Student.create({
      _id: studentId,
      collegeId,
      personId,
      admissionYear: 2024,
      primaryParentId: parentDocId,
      rollNumber: 'PII-1',
      status: 'active',
      onboardingStatus: 'completed',
    });
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: oid(),
      overdueAmount: 10000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });

    completeMock.mockResolvedValue({
      text: JSON.stringify({
        language: 'en',
        tone: 'soft',
        subject: 'Reminder',
        body: 'Hello',
        predictedReadRate: 0.5,
      }),
      inputTokens: 30,
      outputTokens: 15,
      model: 'claude-sonnet-4-5',
      provider: 'claude',
      costInr: 0.001,
      durationMs: 100,
    });

    await handleReminderDrafts(collegeId, [String(studentId)]);

    const action = await AgentAction.findOne({
      collegeId,
      type: 'reminder-draft',
    });
    expect(action).not.toBeNull();
    // CRITICAL: raw phone NEVER appears in audit log
    expect(action!.maskedPrompt).not.toContain(RAW_GUARDIAN_PHONE);
    // Tokens use the {category_n} format
    expect(action!.maskedPrompt).toMatch(/\{guardian_phone_\d+\}/);
  });
});
