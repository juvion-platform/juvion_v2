/**
 * Task A5 — e2e HTTP tests for the finance-agent module
 * (`/api/juvi/finance-agent/*`).
 *
 * Covers the seven endpoints declared in plan §1.9:
 *   - POST /api/juvi/finance-agent/query                 (streaming SSE)
 *   - POST /api/juvi/finance-agent/forecast-narrative
 *   - POST /api/juvi/finance-agent/risk-scores
 *   - POST /api/juvi/finance-agent/situations
 *   - POST /api/juvi/finance-agent/reminder-drafts
 *   - POST /api/juvi/finance-agent/reminder-drafts/approve
 *   - POST /api/juvi/finance-agent/situations/:fingerprint/dismiss
 *
 * The LLM client + BullMQ enqueue are mocked at module level so no
 * external network or Redis is required. Mongo runs in-memory via the
 * shared `__e2e__` harness.
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md §AC Chat / Risk /
 *       Situations / Reminder drafts
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.9
 * Task: .captain/specs/fee-analytics-ai-native/tasks.md §Task A5
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
import { Types } from 'mongoose';

// ── Hoisted mock fns shared between vi.mock factories + tests ─────────

const { completeMock, streamMock, addJobMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  streamMock: vi.fn(),
  addJobMock: vi.fn().mockResolvedValue({ id: 'mock-sms-job' }),
}));

// Mock the LLM client BEFORE importing the app (so the orchestrator
// resolves to a stub provider whether the env keys exist or not).
vi.mock('../../modules/juvi/finance-agent/llm-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../modules/juvi/finance-agent/llm-client')
  >('../../modules/juvi/finance-agent/llm-client');
  return {
    ...actual,
    createLLMClient: () => ({
      provider: 'claude' as const,
      complete: completeMock,
      stream: streamMock,
    }),
  };
});

// Mock the BullMQ enqueue helper used by handleApproveDrafts so we don't
// hit Redis during e2e.
vi.mock('../../shared/queue/QueueManager', async () => {
  const actual = await vi.importActual<
    typeof import('../../shared/queue/QueueManager')
  >('../../shared/queue/QueueManager');
  return {
    ...actual,
    addJob: addJobMock,
  };
});

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';

import { Student } from '../../models/people/Student';
import { Person } from '../../models/people/Person';
import { Parent } from '../../models/people/Parent';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { Payment } from '../../models/finance/Payment';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { FeeReminder } from '../../models/finance/FeeReminder';

import { AgentAction } from '../../models/juvi/AgentAction';
import { AgentConversation } from '../../models/juvi/AgentConversation';
import { SituationDismissal } from '../../models/juvi/SituationDismissal';

let api: TestApi;
let fx: BaseFixtures;

// ── Helpers ───────────────────────────────────────────────────────────

async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

/** A canonical successful one-shot LLM response. */
function llmDone(text: string) {
  return {
    text,
    inputTokens: 80,
    outputTokens: 30,
    model: 'claude-sonnet-4-5',
    provider: 'claude' as const,
    costInr: 0.001,
    durationMs: 100,
  };
}

/**
 * Build a stream that emits a small set of deltas + a final done chunk.
 * Mirrors the shape the orchestrator's `handleChat` consumes.
 */
function streamScript(deltas: string[], finalText?: string): AsyncIterable<{
  delta: string;
  done: boolean;
  final?: ReturnType<typeof llmDone>;
}> {
  const final = finalText ?? deltas.join('');
  const items = [
    ...deltas.map((d) => ({ delta: d, done: false })),
    { delta: '', done: true, final: llmDone(final) },
  ];
  return asAsyncIterable(items);
}

/**
 * Issue a POST request and consume the SSE response body via supertest's
 * default buffered behavior. Supertest collects the response body string
 * for non-JSON content-types — perfect for asserting the SSE wire format.
 */
async function postSse(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  // supertest doesn't expose the raw stream nicely, but it does buffer
  // the response body when we ask it to via `.buffer(true)` + a parser
  // that simply concatenates all chunks.
  return new Promise((resolve, reject) => {
    const req = api
      .as(token)
      .post(path)
      .set('Accept', 'text/event-stream')
      .send(body)
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => cb(null, data));
        res.on('error', cb);
      });
    req.end((err, res) => {
      if (err && !res) return reject(err);
      const headers: Record<string, string> = {};
      const rawHeaders = (res?.headers ?? {}) as Record<
        string,
        string | string[] | undefined
      >;
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (typeof v === 'string') headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(',');
      }
      resolve({
        status: res?.status ?? 0,
        body: typeof res?.body === 'string' ? res.body : (res?.text ?? ''),
        headers,
      });
    });
  });
}

/** Parse the SSE body string into a list of { event, data } pairs. */
function parseSse(text: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = text.split('\n\n').filter((b) => b.trim().length > 0);
  for (const blk of blocks) {
    const lines = blk.split('\n');
    let evt = 'message';
    let dataRaw = '';
    for (const ln of lines) {
      if (ln.startsWith('event:')) evt = ln.slice('event:'.length).trim();
      else if (ln.startsWith('data:')) dataRaw = ln.slice('data:'.length).trim();
    }
    let data: unknown = dataRaw;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      /* keep raw */
    }
    events.push({ event: evt, data });
  }
  return events;
}

async function seedDefaulter(
  collegeId: string,
  daysOverdue = 30,
): Promise<{ studentId: string }> {
  const s = await createTestStudent(collegeId, {
    programmeId: String(fx.btech._id),
    branchId: String(fx.cseBranch._id),
    batchId: String(fx.batch._id),
  });
  await DefaulterRecord.create({
    collegeId,
    studentId: s.student._id,
    invoiceId: new Types.ObjectId(),
    overdueAmount: 12345,
    daysOverdue,
    escalationStage: 'stage_2',
  });
  return { studentId: String(s.student._id) };
}

async function seedDefaulterInOtherCollege(): Promise<{
  collegeId: string;
  studentId: string;
}> {
  const collegeId = new Types.ObjectId().toString();
  const personId = new Types.ObjectId();
  await Person.create({
    _id: personId,
    collegeId,
    name: 'Other College Student',
    phone: '+91-9000000000',
  });
  const student = await Student.create({
    collegeId,
    personId,
    admissionYear: 2024,
    rollNumber: `OTHER-${Date.now()}`,
    status: 'active',
    onboardingStatus: 'completed',
  });
  await DefaulterRecord.create({
    collegeId,
    studentId: student._id,
    invoiceId: new Types.ObjectId(),
    overdueAmount: 7777,
    daysOverdue: 20,
    escalationStage: 'stage_1',
  });
  return { collegeId, studentId: String(student._id) };
}

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.LLM_PROVIDER = 'claude';
  const app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
}, 60_000);

afterAll(async () => {
  await cleanupTestApp();
});

beforeEach(() => {
  completeMock.mockReset();
  streamMock.mockReset();
  addJobMock.mockClear();
});

afterEach(async () => {
  // Per-test cleanup of agent-side collections so counters are deterministic
  // (we leave the base seeded users + programmes alive).
  await Promise.all([
    AgentAction.deleteMany({}),
    AgentConversation.deleteMany({}),
    SituationDismissal.deleteMany({}),
    FeeReminder.deleteMany({}),
  ]);
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/query  (streaming SSE)
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/query (SSE)', () => {
  it('200 streams delta events followed by a done event with usage', async () => {
    streamMock.mockReturnValueOnce(
      streamScript(['Hello ', 'Officer', '.']),
    );

    const res = await postSse(
      '/api/juvi/finance-agent/query',
      { prompt: 'Why is collection slow?' },
      fx.admin.token,
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['x-accel-buffering']).toBe('no');

    const events = parseSse(res.body);
    const deltas = events.filter((e) => e.event === 'delta');
    const dones = events.filter((e) => e.event === 'done');

    expect(deltas.length).toBeGreaterThanOrEqual(2);
    expect(dones).toHaveLength(1);

    const final = dones[0]?.data as {
      provider: string;
      model: string;
      conversationId: string;
      auditId: string;
      inputTokens: number;
      outputTokens: number;
    };
    expect(final.provider).toBe('claude');
    expect(final.model).toBeTruthy();
    expect(final.conversationId).toBeTruthy();
    expect(final.auditId).toBeTruthy();
    expect(typeof final.inputTokens).toBe('number');
    expect(typeof final.outputTokens).toBe('number');
  });

  it('200 propagates conversationId in the done payload (new id when none supplied)', async () => {
    streamMock.mockReturnValueOnce(streamScript(['hi']));

    const res = await postSse(
      '/api/juvi/finance-agent/query',
      { prompt: 'hello' },
      fx.admin.token,
    );

    const events = parseSse(res.body);
    const done = events.find((e) => e.event === 'done')?.data as {
      conversationId: string;
    };
    expect(done.conversationId).toBeTruthy();
    expect(done.conversationId.length).toBeGreaterThan(8);
  });

  it('400 when prompt missing', async () => {
    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/query')
      .send({})
      .expect(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('400 when prompt is too long', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/query')
      .send({ prompt: 'x'.repeat(2001) })
      .expect(400);
  });

  it('400 when conversationId is not a uuid', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/query')
      .send({ prompt: 'hi', conversationId: 'not-a-uuid' })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/query')
      .send({ prompt: 'hi' })
      .expect(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/forecast-narrative
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/forecast-narrative', () => {
  it('200 returns projection + AI narrative', async () => {
    // Seed a minimum payment series so the forecast doesn't error
    await Payment.create({
      collegeId: fx.collegeId,
      studentId: new Types.ObjectId(),
      receiptNumber: `R-fcn-${Date.now()}`,
      amount: 5000,
      paymentMode: 'upi',
      status: 'success',
      paymentDate: new Date(),
      allocations: [],
    });
    completeMock.mockResolvedValueOnce(
      llmDone('Drivers: UPI down 18%, scholarships delayed.'),
    );

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/forecast-narrative')
      .send({ monthAnchor: new Date().toISOString() })
      .expect(200);

    expect(res.body.projection).toBeDefined();
    expect(res.body.projection.lower).toBeGreaterThanOrEqual(0);
    expect(res.body.projection.mean).toBeGreaterThanOrEqual(0);
    expect(res.body.projection.upper).toBeGreaterThanOrEqual(
      res.body.projection.mean,
    );
    expect(res.body.narrative).toContain('Drivers');
  });

  it('200 with narrative=null when LLM fails (degraded path)', async () => {
    await Payment.create({
      collegeId: fx.collegeId,
      studentId: new Types.ObjectId(),
      receiptNumber: `R-fcn-fail-${Date.now()}`,
      amount: 5000,
      paymentMode: 'upi',
      status: 'success',
      paymentDate: new Date(),
      allocations: [],
    });
    completeMock.mockRejectedValueOnce(new Error('LLM 503'));

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/forecast-narrative')
      .send({ monthAnchor: new Date().toISOString() })
      .expect(200);

    expect(res.body.projection).toBeDefined();
    expect(res.body.narrative).toBeNull();
  });

  it('400 when monthAnchor is invalid', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/forecast-narrative')
      .send({ monthAnchor: 'not-a-date' })
      .expect(400);
  });

  it('400 when monthAnchor missing', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/forecast-narrative')
      .send({})
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/forecast-narrative')
      .send({ monthAnchor: new Date().toISOString() })
      .expect(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/risk-scores
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/risk-scores', () => {
  it('200 returns deterministic scores without narrative by default', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { studentId } = await seedDefaulter(fx.collegeId, 30);
      ids.push(studentId);
    }

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: ids })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    for (const r of res.body) {
      expect(r.studentId).toBeTruthy();
      expect(r.tier).toMatch(/low|medium|high|critical|insufficient-data/);
      expect(Array.isArray(r.factors)).toBe(true);
      expect(r.narrative).toBeUndefined();
    }
    // No LLM call for the default (no-narrative) path
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('200 attaches narratives when includeNarrative=true', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { studentId } = await seedDefaulter(fx.collegeId, 45);
      ids.push(studentId);
    }
    completeMock.mockResolvedValue(
      llmDone('High risk because of long overdue.'),
    );

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: ids, includeNarrative: true })
      .expect(200);

    expect(res.body).toHaveLength(2);
    for (const r of res.body) {
      expect(r.narrative).toBe('High risk because of long overdue.');
    }
  });

  it('400 when studentIds is empty', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: [] })
      .expect(400);
  });

  it('400 when studentIds exceeds the 100-student cap', async () => {
    const tooMany = Array.from({ length: 101 }, () =>
      new Types.ObjectId().toString(),
    );
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: tooMany })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: [new Types.ObjectId().toString()] })
      .expect(401);
  });

  it('403 when a studentId belongs to a different college', async () => {
    const mineId = (await seedDefaulter(fx.collegeId, 30)).studentId;
    const other = await seedDefaulterInOtherCollege();

    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/risk-scores')
      .send({ studentIds: [mineId, other.studentId] })
      .expect(403);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/situations
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/situations', () => {
  async function seedHoldsCandidate(): Promise<{ studentId: Types.ObjectId }> {
    const studentId = new Types.ObjectId();
    await FinancialHold.create({
      collegeId: fx.collegeId,
      studentId,
      defaulterRecordId: new Types.ObjectId(),
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: new Date(Date.now() - 60 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
    });
    return { studentId };
  }

  it('200 returns LLM-picked situations with id + fingerprint', async () => {
    const { studentId } = await seedHoldsCandidate();
    const llmJson = JSON.stringify([
      {
        kind: 'holds-without-review',
        severity: 'high',
        title: 'Holds awaiting review',
        narrative: 'A hold has been pending for over 48 hours.',
        studentIds: [String(studentId)],
        actions: [
          { label: 'Review', type: 'review_policy' },
          { label: 'Dismiss for 7d', type: 'dismiss' },
        ],
      },
    ]);
    completeMock.mockResolvedValueOnce(llmDone(llmJson));

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/situations')
      .send({})
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const s = res.body[0];
    expect(s.id).toBeTruthy();
    expect(s.fingerprint).toBeTruthy();
    expect(s.kind).toBe('holds-without-review');
    expect(Array.isArray(s.actions)).toBe(true);
  });

  it('400 when extra body fields are sent (strict schema)', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/situations')
      .send({ collegeId: 'should-not-be-here' })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/situations')
      .send({})
      .expect(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/reminder-drafts
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/reminder-drafts', () => {
  async function seedReminderTarget(): Promise<{ studentId: string }> {
    const collegeId = fx.collegeId;
    const personId = new Types.ObjectId();
    const parentPersonId = new Types.ObjectId();
    const parentDocId = new Types.ObjectId();
    const studentId = new Types.ObjectId();

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
      rollNumber: `RD-${Date.now()}`,
      status: 'active',
      onboardingStatus: 'completed',
    });
    await DefaulterRecord.create({
      collegeId,
      studentId,
      invoiceId: new Types.ObjectId(),
      overdueAmount: 10000,
      daysOverdue: 5,
      escalationStage: 'stage_1',
    });
    return { studentId: String(studentId) };
  }

  it('200 returns drafts with the agent-draft-v1 templateVersion', async () => {
    const { studentId } = await seedReminderTarget();
    const draftJson = JSON.stringify({
      language: 'te',
      tone: 'soft',
      subject: 'Friendly reminder',
      body: 'Dear parent, this is a gentle reminder.',
      predictedReadRate: 0.78,
    });
    completeMock.mockResolvedValue(llmDone(draftJson));

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts')
      .send({ studentIds: [studentId] })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].templateVersion).toBe('agent-draft-v1');
    expect(res.body[0].tone).toBe('soft');
  });

  it('400 when studentIds is empty', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts')
      .send({ studentIds: [] })
      .expect(400);
  });

  it('400 when studentIds exceeds the 50-cap', async () => {
    const tooMany = Array.from({ length: 51 }, () =>
      new Types.ObjectId().toString(),
    );
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts')
      .send({ studentIds: tooMany })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/reminder-drafts')
      .send({ studentIds: [new Types.ObjectId().toString()] })
      .expect(401);
  });

  it('403 when a studentId belongs to a different college', async () => {
    const mine = await seedReminderTarget();
    const other = await seedDefaulterInOtherCollege();
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts')
      .send({ studentIds: [mine.studentId, other.studentId] })
      .expect(403);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/reminder-drafts/approve
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/reminder-drafts/approve', () => {
  it('200 creates FeeReminder docs with metadata.source=agent-draft-v1', async () => {
    const { studentId } = await seedDefaulter(fx.collegeId, 30);

    const res = await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts/approve')
      .send({
        drafts: [
          {
            studentId,
            subject: 'Pay your fees',
            body: 'Dear parent, please pay…',
          },
        ],
      })
      .expect(200);

    expect(res.body.approvedCount).toBe(1);
    expect(res.body.reminderIds).toHaveLength(1);

    const fr = await FeeReminder.findById(res.body.reminderIds[0]);
    expect(fr).not.toBeNull();
    expect(fr!.metadata?.source).toBe('agent-draft-v1');
    expect(fr!.metadata?.subject).toBe('Pay your fees');
    expect(addJobMock).toHaveBeenCalledTimes(1);
  });

  it('400 when drafts array is empty', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts/approve')
      .send({ drafts: [] })
      .expect(400);
  });

  it('400 when a draft is missing required fields', async () => {
    const { studentId } = await seedDefaulter(fx.collegeId, 30);
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts/approve')
      .send({
        drafts: [{ studentId, subject: '', body: 'no subject' }],
      })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/reminder-drafts/approve')
      .send({
        drafts: [
          {
            studentId: new Types.ObjectId().toString(),
            subject: 's',
            body: 'b',
          },
        ],
      })
      .expect(401);
  });

  it('403 when any draft references a student in a different college', async () => {
    const mine = await seedDefaulter(fx.collegeId, 30);
    const other = await seedDefaulterInOtherCollege();
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/reminder-drafts/approve')
      .send({
        drafts: [
          { studentId: mine.studentId, subject: 's', body: 'b' },
          { studentId: other.studentId, subject: 's', body: 'b' },
        ],
      })
      .expect(403);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  POST /api/juvi/finance-agent/situations/:fingerprint/dismiss
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/juvi/finance-agent/situations/:fingerprint/dismiss', () => {
  it('200 upserts a SituationDismissal with the right snoozedUntil', async () => {
    const fp = 'fp-test-' + Math.random().toString(36).slice(2);
    const before = Date.now();
    const res = await api
      .as(fx.admin.token)
      .post(`/api/juvi/finance-agent/situations/${fp}/dismiss`)
      .send({ snoozeDays: 7, reason: 'Will revisit next sprint' })
      .expect(200);

    expect(res.body.ok).toBe(true);

    const doc = await SituationDismissal.findOne({
      collegeId: fx.collegeId,
      situationFingerprint: fp,
    });
    expect(doc).not.toBeNull();
    expect(doc!.reason).toBe('Will revisit next sprint');
    const expectedMin = before + 7 * 24 * 60 * 60 * 1000 - 5_000;
    const expectedMax = Date.now() + 7 * 24 * 60 * 60 * 1000 + 5_000;
    expect(doc!.snoozedUntil.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(doc!.snoozedUntil.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('400 when snoozeDays is missing', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/situations/fp-1/dismiss')
      .send({ reason: 'no snooze' })
      .expect(400);
  });

  it('400 when snoozeDays is not in the allowed enum', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/situations/fp-1/dismiss')
      .send({ snoozeDays: 5, reason: 'wrong enum' })
      .expect(400);
  });

  it('400 when reason exceeds the 500-char cap', async () => {
    await api
      .as(fx.admin.token)
      .post('/api/juvi/finance-agent/situations/fp-1/dismiss')
      .send({ snoozeDays: 1, reason: 'x'.repeat(501) })
      .expect(400);
  });

  it('401 without auth header', async () => {
    await api
      .post('/api/juvi/finance-agent/situations/fp-1/dismiss')
      .send({ snoozeDays: 1, reason: 'x' })
      .expect(401);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  Cross-cutting: per-user rate limit (smoke test for one endpoint)
// ═════════════════════════════════════════════════════════════════════

describe('per-user rate-limit smoke', () => {
  it('429 once a single user exceeds the dismiss endpoint quota', async () => {
    // The dismiss endpoint is configured at 60/min/user (the most generous
    // limit on the module after /forecast-narrative). This test floods the
    // limiter for ONE user and verifies the 429 shape. It is naturally a
    // bit slow (~60 requests) but still cheap with mocked LLM.
    let saw429 = false;
    let lastBody: unknown = null;
    for (let i = 0; i < 65; i++) {
      const r = await api
        .as(fx.admin.token)
        .post('/api/juvi/finance-agent/situations/fp-rate-test/dismiss')
        .send({ snoozeDays: 1, reason: 'flood' });
      if (r.status === 429) {
        saw429 = true;
        lastBody = r.body;
        break;
      }
    }
    expect(saw429).toBe(true);
    expect((lastBody as { error?: string }).error).toBe('rate_limited');
  });
});
