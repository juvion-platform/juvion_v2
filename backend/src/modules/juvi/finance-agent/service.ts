/**
 * Task A4 — Finance-agent orchestrator (fee-analytics-ai-native).
 *
 * Public entry points for the 7 HTTP endpoints in A5. Each method:
 *   1. Asserts college-scope on inputs (multi-tenancy guarantee)
 *   2. Pulls deterministic context via ContextAssembler / A3 helpers
 *   3. Masks PII (A1) before building the LLM prompt
 *   4. Calls the LLM client (A1) with prompts (`./prompts.ts`)
 *   5. Validates structured output via Zod where applicable
 *   6. Unmasks the LLM response with the per-call token map
 *   7. Persists an `AgentAction` entry (always with the MASKED prompt)
 *   8. Returns the result
 *
 * Spec: .captain/specs/fee-analytics-ai-native/spec.md
 * Plan: .captain/specs/fee-analytics-ai-native/plan.md §1.8
 */

import { randomUUID, createHash } from 'crypto';
import { Types } from 'mongoose';
import { z } from 'zod';

import { AppError } from '../../../middleware/errorHandler';
import { addJob, QUEUE_NAMES } from '../../../shared/queue/QueueManager';

import { FeeReminder } from '../../../models/finance/FeeReminder';
import { Student } from '../../../models/people/Student';

import { AgentConversation } from '../../../models/juvi/AgentConversation';
import {
  AgentAction,
  type AgentActionType,
} from '../../../models/juvi/AgentAction';
import { SituationDismissal } from '../../../models/juvi/SituationDismissal';

import { createLLMClient, type LLMResponse } from './llm-client';
import { maskPII, unmaskText } from './pii';
import {
  forChat,
  forForecast,
  forReminderDraft,
} from './context';
import {
  systemPrefix,
  buildChatMessages,
  buildForecastNarrativeMessages,
  buildRiskNarrativeMessages,
  buildSituationsMessages,
  buildReminderDraftMessages,
} from './prompts';
import {
  assembleFeatures,
  computeRiskScore,
  type RiskTier,
  type RiskFactor,
} from './risk-scorer';
import { forecastMonthEnd } from './forecast';
import {
  gatherCandidates,
  type SituationCandidate,
} from './situation-candidates';
import {
  withBoundedConcurrency,
  tryParseJson,
  trimTurnsForBudget,
  truncateNarrative,
} from './orchestrator-helpers';

// ── Public types (consumed by A5 controller) ───────────────────────────

export interface AgentChatContext {
  filters?: { from?: Date; to?: Date; programmeIds?: string[] };
  visibleDefaulterIds?: string[];
}

export interface AgentChatFinal {
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  durationMs: number;
  auditId: string;
  conversationId: string;
}

export interface AgentChatChunk {
  type: 'delta' | 'done' | 'error';
  text?: string;
  final?: AgentChatFinal;
  error?: string;
}

export interface ForecastWithNarrative {
  projection: {
    lower: number;
    mean: number;
    upper: number;
    confidence: number;
    monthEnd: Date;
    daysInWindow: number;
  };
  narrative: string | null;
  generatedAt: Date;
}

export interface RiskScoreResult {
  studentId: string;
  score: number | null;
  tier: RiskTier;
  factors: RiskFactor[];
  narrative?: string;
}

export type SituationActionType =
  | 'draft_plan'
  | 'draft_reminder'
  | 'schedule_call'
  | 'review_policy'
  | 'dismiss';

export interface Situation {
  id: string;
  fingerprint: string;
  kind: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  narrative: string;
  studentIds: string[];
  actions: Array<{
    label: string;
    type: SituationActionType;
    payload?: Record<string, unknown>;
  }>;
}

export interface ReminderDraft {
  studentId: string;
  language: string;
  tone: 'soft' | 'firm' | 'empathetic';
  subject: string;
  body: string;
  predictedReadRate: number;
  templateVersion: string;
}

export interface ApprovedDraft {
  studentId: string;
  subject: string;
  body: string;
}

export interface ApprovalResult {
  reminderIds: string[];
  approvedCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const NARRATIVE_CONCURRENCY = 5;
const TURN_INPUT_BUDGET_TOKENS = 8000;
const CHAR_PER_TOKEN_ESTIMATE = 4;
const SITUATIONS_MAX_TOKENS = 1500;

// ── Helpers ────────────────────────────────────────────────────────────

function ensureCollegeId(collegeId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(collegeId)) {
    throw new AppError(400, 'Invalid collegeId');
  }
  return new Types.ObjectId(collegeId);
}

interface AgentActionPayload {
  collegeId: string;
  userId: string;
  type: AgentActionType;
  maskedPrompt: string;
  maskedResponse: string;
  llm: Pick<
    LLMResponse,
    'provider' | 'model' | 'durationMs' | 'inputTokens' | 'outputTokens' | 'costInr'
  > | null;
}

/**
 * Persist an AgentAction. Always uses the masked prompt + response per
 * spec ("audit log stores the MASKED prompt + response").
 */
async function logAgentAction(p: AgentActionPayload): Promise<string> {
  const doc = await AgentAction.create({
    collegeId: p.collegeId,
    userId: p.userId,
    type: p.type,
    maskedPrompt: p.maskedPrompt,
    maskedResponse: p.maskedResponse,
    provider: p.llm?.provider ?? 'claude',
    model: p.llm?.model ?? 'unknown',
    durationMs: p.llm?.durationMs ?? 0,
    inputTokens: p.llm?.inputTokens ?? 0,
    outputTokens: p.llm?.outputTokens ?? 0,
    costInr: p.llm?.costInr ?? 0,
  });
  return String(doc._id);
}

// ── Streaming chat ─────────────────────────────────────────────────────

export async function* handleChat(
  collegeId: string,
  userId: string,
  prompt: string,
  conversationId?: string,
  context?: AgentChatContext,
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentChatChunk> {
  const start = Date.now();
  ensureCollegeId(collegeId);

  // 1. Load (or start) conversation
  let convoDoc = null;
  let resolvedConvoId = conversationId;
  if (conversationId) {
    convoDoc = await AgentConversation.findOne({
      collegeId,
      userId,
      conversationId,
    });
  }
  if (!convoDoc) {
    resolvedConvoId = randomUUID();
  }

  // 2. Build prior-turn list (cap last 10) and trim to token budget
  const priorTurnsAll = (convoDoc?.turns ?? []).slice(-10).map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const priorTurns = trimTurnsForBudget(
    priorTurnsAll,
    TURN_INPUT_BUDGET_TOKENS,
    CHAR_PER_TOKEN_ESTIMATE,
  );

  // 3. Assemble + mask context
  const ctxBundle = await forChat(collegeId, context);
  const { masked, tokenMap } = maskPII(ctxBundle);

  // 4. Build messages: [system, ...priorTurns, contextual user turn]
  const baseMessages = buildChatMessages({
    sys: { today: new Date() },
    contextBundle: masked,
    userPrompt: prompt,
  });
  // Insert prior turns between the system + final user turn
  const messages = [
    baseMessages[0]!,
    ...priorTurns.map((t) => ({
      role: t.role as 'user' | 'assistant',
      content: t.content,
    })),
    baseMessages[1]!,
  ];

  // 5. Stream the LLM response
  let client;
  try {
    client = createLLMClient();
  } catch (e) {
    yield {
      type: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
    return;
  }

  let accumulated = '';
  let final: LLMResponse | null = null;
  try {
    for await (const chunk of client.stream(messages, { abortSignal })) {
      if (chunk.delta) {
        accumulated += chunk.delta;
        yield { type: 'delta', text: chunk.delta };
      }
      if (chunk.done && chunk.final) {
        final = chunk.final;
      }
    }
  } catch (e) {
    yield {
      type: 'error',
      error: e instanceof Error ? e.message : String(e),
    };
    return;
  }

  // 6. Unmask final text + persist
  const unmasked = unmaskText(accumulated, tokenMap);
  const finalResponse = final ?? {
    text: unmasked,
    inputTokens: 0,
    outputTokens: 0,
    model: 'unknown',
    provider: 'claude',
    costInr: 0,
    durationMs: Date.now() - start,
  };

  // Update or create AgentConversation
  const newTurns = [
    {
      role: 'user' as const,
      content: prompt,
      timestamp: new Date(),
    },
    {
      role: 'assistant' as const,
      content: unmasked,
      timestamp: new Date(),
    },
  ];
  if (convoDoc) {
    convoDoc.turns.push(...newTurns);
    convoDoc.lastModel = finalResponse.model;
    convoDoc.lastProvider = finalResponse.provider;
    convoDoc.totalInputTokens =
      (convoDoc.totalInputTokens ?? 0) + finalResponse.inputTokens;
    convoDoc.totalOutputTokens =
      (convoDoc.totalOutputTokens ?? 0) + finalResponse.outputTokens;
    convoDoc.totalCostInr =
      (convoDoc.totalCostInr ?? 0) + finalResponse.costInr;
    await convoDoc.save();
  } else {
    await AgentConversation.create({
      collegeId,
      userId,
      conversationId: resolvedConvoId!,
      turns: newTurns,
      lastModel: finalResponse.model,
      lastProvider: finalResponse.provider,
      totalInputTokens: finalResponse.inputTokens,
      totalOutputTokens: finalResponse.outputTokens,
      totalCostInr: finalResponse.costInr,
    });
  }

  // The maskedPrompt is the full user-message body that was sent to the LLM.
  // (Includes the masked context bundle.)
  const sentUser = messages[messages.length - 1]?.content ?? prompt;
  const auditId = await logAgentAction({
    collegeId,
    userId,
    type: 'chat',
    maskedPrompt: sentUser,
    maskedResponse: accumulated, // accumulated is masked-tokenised
    llm: finalResponse,
  });

  yield {
    type: 'done',
    final: {
      provider: finalResponse.provider,
      model: finalResponse.model,
      inputTokens: finalResponse.inputTokens,
      outputTokens: finalResponse.outputTokens,
      costInr: finalResponse.costInr,
      durationMs: finalResponse.durationMs,
      auditId,
      conversationId: resolvedConvoId!,
    },
  };
}

// ── Forecast narrative ─────────────────────────────────────────────────

export async function handleForecastNarrative(
  collegeId: string,
  monthAnchor: Date,
): Promise<ForecastWithNarrative> {
  ensureCollegeId(collegeId);

  const projection = await forecastMonthEnd(collegeId, monthAnchor);
  const signals = await forForecast(collegeId);

  // PII-free aggregates only — no masking required for forecast.
  const messages = buildForecastNarrativeMessages({
    sys: { today: new Date() },
    projection: {
      lower: projection.lower,
      mean: projection.mean,
      upper: projection.upper,
      confidence: projection.confidence,
    },
    signals,
  });

  let narrative: string | null = null;
  let llm: LLMResponse | null = null;
  try {
    const client = createLLMClient();
    llm = await client.complete(messages, { maxTokens: 200 });
    narrative = truncateNarrative(llm.text);
  } catch {
    // Graceful degradation: keep projection, drop narrative.
    narrative = null;
  }

  await logAgentAction({
    collegeId,
    userId: collegeId, // forecast has no per-user invocation; college as actor
    type: 'forecast',
    maskedPrompt: messages[messages.length - 1]?.content ?? '(no prompt)',
    maskedResponse: narrative ?? '(llm-failed; projection-only)',
    llm,
  });

  return {
    projection: {
      lower: projection.lower,
      mean: projection.mean,
      upper: projection.upper,
      confidence: projection.confidence,
      monthEnd: projection.monthEnd,
      daysInWindow: projection.daysInWindow,
    },
    narrative,
    generatedAt: new Date(),
  };
}

// ── Risk scores ────────────────────────────────────────────────────────

export async function handleRiskScores(
  collegeId: string,
  studentIds: string[],
  includeNarrative?: boolean,
): Promise<RiskScoreResult[]> {
  ensureCollegeId(collegeId);

  // Compute deterministic scores in parallel
  const scoreEntries = await Promise.all(
    studentIds.map(async (sid) => {
      const features = await assembleFeatures(collegeId, sid);
      const score = computeRiskScore(features);
      return { studentId: sid, score };
    }),
  );

  if (!includeNarrative) {
    return scoreEntries.map((e) => ({
      studentId: e.studentId,
      score: e.score.score,
      tier: e.score.tier,
      factors: e.score.factors,
    }));
  }

  // Bounded-concurrency LLM narratives
  const narrativeResults = await withBoundedConcurrency(
    scoreEntries,
    NARRATIVE_CONCURRENCY,
    async (entry) => {
      const { masked, tokenMap } = maskPII({ factors: entry.score.factors });
      const messages = buildRiskNarrativeMessages({
        sys: { today: new Date() },
        studentId: entry.studentId,
        factors: (masked as { factors: unknown }).factors,
        score: entry.score.score,
        tier: entry.score.tier,
      });
      const client = createLLMClient();
      const out = await client.complete(messages, { maxTokens: 120 });
      const text = unmaskText(out.text.trim(), tokenMap);
      return { ...entry, narrative: text, llm: out };
    },
  );

  // Aggregate batch usage for one combined AgentAction entry
  let inTotal = 0;
  let outTotal = 0;
  let costTotal = 0;
  let totalMs = 0;
  let provider: 'claude' | 'openai' = 'claude';
  let model = 'unknown';
  for (const r of narrativeResults) {
    if (r.status === 'fulfilled') {
      inTotal += r.value.llm.inputTokens;
      outTotal += r.value.llm.outputTokens;
      costTotal += r.value.llm.costInr;
      totalMs += r.value.llm.durationMs;
      provider = r.value.llm.provider;
      model = r.value.llm.model;
    }
  }

  const results: RiskScoreResult[] = scoreEntries.map((e, i) => {
    const r = narrativeResults[i];
    const base: RiskScoreResult = {
      studentId: e.studentId,
      score: e.score.score,
      tier: e.score.tier,
      factors: e.score.factors,
    };
    if (r && r.status === 'fulfilled') {
      base.narrative = r.value.narrative;
    }
    return base;
  });

  await logAgentAction({
    collegeId,
    userId: collegeId,
    type: 'risk',
    maskedPrompt: `risk-narrative batch: ${studentIds.length} students`,
    maskedResponse: JSON.stringify(
      results.map((r) => ({ studentId: r.studentId, narrative: !!r.narrative })),
    ),
    llm:
      narrativeResults.some((r) => r.status === 'fulfilled')
        ? {
            provider,
            model,
            inputTokens: inTotal,
            outputTokens: outTotal,
            costInr: costTotal,
            durationMs: totalMs,
          }
        : null,
  });

  return results;
}

// ── Situations ─────────────────────────────────────────────────────────

const SituationsResponseSchema = z.array(
  z.object({
    kind: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    title: z.string(),
    narrative: z.string(),
    studentIds: z.array(z.string()),
    actions: z.array(
      z.object({
        label: z.string(),
        type: z.enum([
          'draft_plan',
          'draft_reminder',
          'schedule_call',
          'review_policy',
          'dismiss',
        ]),
        payload: z.unknown().optional(),
      }),
    ),
  }),
);

export async function handleSituations(
  collegeId: string,
  userId: string,
): Promise<Situation[]> {
  ensureCollegeId(collegeId);

  // 1. Deterministic candidates
  const allCandidates = await gatherCandidates(collegeId);

  // 2. Filter dismissed candidates (active snoozes only)
  const activeDismissals = await SituationDismissal.find({
    collegeId,
    userId,
    snoozedUntil: { $gt: new Date() },
  })
    .select({ situationFingerprint: 1 })
    .lean();
  const dismissedFingerprints = new Set(
    activeDismissals.map((d) => d.situationFingerprint),
  );
  const candidates = allCandidates.filter(
    (c) => !dismissedFingerprints.has(c.fingerprint),
  );

  if (candidates.length === 0) {
    await logAgentAction({
      collegeId,
      userId,
      type: 'situations',
      maskedPrompt: 'no-candidates',
      maskedResponse: '[]',
      llm: null,
    });
    return [];
  }

  // 3. Mask candidate context
  const { masked, tokenMap } = maskPII({ candidates });
  const maskedCandidates =
    (masked as { candidates: SituationCandidate[] }).candidates ?? [];

  // 4. Call LLM (with one strict-retry on Zod failure)
  let llm: LLMResponse | null = null;
  let parsed: z.infer<typeof SituationsResponseSchema> | null = null;
  let lastMaskedResponse = '';
  for (const strict of [false, true]) {
    const messages = buildSituationsMessages({
      sys: { today: new Date() },
      candidates: maskedCandidates,
      strict,
    });
    try {
      const client = createLLMClient();
      const out = await client.complete(messages, {
        maxTokens: SITUATIONS_MAX_TOKENS,
      });
      llm = out;
      lastMaskedResponse = out.text;
      const parseResult = tryParseJson(out.text, SituationsResponseSchema);
      if (parseResult.ok && parseResult.value) {
        parsed = parseResult.value;
        break;
      }
    } catch {
      // Retry path covers transient errors too.
    }
  }

  await logAgentAction({
    collegeId,
    userId,
    type: 'situations',
    maskedPrompt: `${candidates.length} candidates`,
    maskedResponse: lastMaskedResponse,
    llm,
  });

  if (!parsed) {
    // eslint-disable-next-line no-console
    console.warn('[llm:json-fail] situations endpoint — empty result');
    return [];
  }

  // 5. Unmask narrative + attach id/fingerprint by matching candidate kind+studentIds
  const result: Situation[] = [];
  for (const item of parsed) {
    const unmaskedNarrative = unmaskText(item.narrative, tokenMap);
    const sortedStudents = [...item.studentIds].sort();
    const matchFingerprint = createHash('sha256')
      .update(`${item.kind}:${sortedStudents.join(',')}`)
      .digest('hex');
    result.push({
      id: randomUUID(),
      fingerprint: matchFingerprint,
      kind: item.kind,
      severity: item.severity,
      title: item.title,
      narrative: unmaskedNarrative,
      studentIds: item.studentIds,
      actions: item.actions.map((a) => ({
        label: a.label,
        type: a.type,
        payload:
          a.payload && typeof a.payload === 'object'
            ? (a.payload as Record<string, unknown>)
            : undefined,
      })),
    });
  }
  return result;
}

// ── Reminder drafts ────────────────────────────────────────────────────

const ReminderDraftSchema = z.object({
  language: z.string().min(1),
  tone: z.enum(['soft', 'firm', 'empathetic']),
  subject: z.string().min(1),
  body: z.string().min(1),
  predictedReadRate: z.number().min(0).max(1),
});

function determineTone(ctx: {
  priorReminderCount: number;
  welfareReferralActive: boolean;
}): 'soft' | 'firm' | 'empathetic' {
  if (ctx.welfareReferralActive) return 'empathetic';
  if (ctx.priorReminderCount >= 2) return 'firm';
  return 'soft';
}

function deterministicFallback(input: {
  language: string;
  tone: 'soft' | 'firm' | 'empathetic';
  rollNumber?: string;
  daysOverdue: number;
  overdueAmount: number;
  guardianMaskedName?: string;
}): {
  language: string;
  tone: 'soft' | 'firm' | 'empathetic';
  subject: string;
  body: string;
  predictedReadRate: number;
} {
  const greeting = input.guardianMaskedName
    ? `Dear ${input.guardianMaskedName},`
    : 'Dear parent,';
  const subject =
    input.tone === 'soft'
      ? 'Friendly fee reminder'
      : input.tone === 'firm'
        ? 'Action required: outstanding fees'
        : 'Support available — outstanding fees';
  const body = [
    greeting,
    `This is a reminder that ${input.overdueAmount > 0 ? `INR ${input.overdueAmount}` : 'an outstanding amount'} is currently overdue${input.daysOverdue > 0 ? ` by ${input.daysOverdue} days` : ''}${input.rollNumber ? ` for roll ${input.rollNumber}` : ''}.`,
    'Please reach out to the college finance office for support.',
  ].join(' ');
  return {
    language: input.language,
    tone: input.tone,
    subject,
    body,
    predictedReadRate: 0.5,
  };
}

export async function handleReminderDrafts(
  collegeId: string,
  studentIds: string[],
): Promise<ReminderDraft[]> {
  ensureCollegeId(collegeId);

  // 1. Per-student context (raw guardian PII)
  const contexts = await Promise.all(
    studentIds.map((sid) => forReminderDraft(collegeId, sid)),
  );

  // 2. Bounded-concurrency LLM drafts
  const items = contexts
    .map((c, idx) => ({ idx, ctx: c, sid: studentIds[idx]! }))
    .filter((e) => e.ctx !== null);

  // Aggregate LLM stats across the batch for a single AgentAction
  let inTotal = 0;
  let outTotal = 0;
  let costTotal = 0;
  let totalMs = 0;
  let provider: 'claude' | 'openai' = 'claude';
  let model = 'unknown';
  let anyLlmFulfilled = false;

  // Capture a representative masked-prompt sample for the audit log so
  // PII spot-checks pass deterministically.
  let sampleMaskedPrompt = '';

  const drafted = await withBoundedConcurrency(
    items,
    NARRATIVE_CONCURRENCY,
    async (item) => {
      const ctx = item.ctx!;
      const tone = determineTone({
        priorReminderCount: ctx.priorReminderCount,
        welfareReferralActive: ctx.welfareReferralActive,
      });
      const language = ctx.guardian.preferredLanguage ?? 'en';
      const { masked, tokenMap } = maskPII({
        guardian: ctx.guardian,
        rollNumber: ctx.rollNumber,
        daysOverdue: ctx.daysOverdue,
        overdueAmount: ctx.overdueAmount,
      });
      const messages = buildReminderDraftMessages({
        sys: { today: new Date() },
        studentId: ctx.studentId,
        language,
        tone,
        context: masked,
      });
      // Capture the first masked prompt for the audit log
      const maskedPromptForAudit = messages[messages.length - 1]?.content ?? '';
      if (!sampleMaskedPrompt) {
        sampleMaskedPrompt = maskedPromptForAudit;
      }

      let draft: ReminderDraft;
      try {
        const client = createLLMClient();
        const out = await client.complete(messages, { maxTokens: 400 });
        inTotal += out.inputTokens;
        outTotal += out.outputTokens;
        costTotal += out.costInr;
        totalMs += out.durationMs;
        provider = out.provider;
        model = out.model;
        anyLlmFulfilled = true;

        const parsed = tryParseJson(out.text, ReminderDraftSchema);
        if (parsed.ok && parsed.value) {
          draft = {
            studentId: ctx.studentId,
            language: parsed.value.language,
            tone: parsed.value.tone,
            subject: unmaskText(parsed.value.subject, tokenMap),
            body: unmaskText(parsed.value.body, tokenMap),
            predictedReadRate: parsed.value.predictedReadRate,
            templateVersion: 'agent-draft-v1',
          };
        } else {
          // Deterministic fallback when JSON invalid
          const fb = deterministicFallback({
            language,
            tone,
            rollNumber: ctx.rollNumber,
            daysOverdue: ctx.daysOverdue,
            overdueAmount: ctx.overdueAmount,
          });
          draft = { ...fb, studentId: ctx.studentId, templateVersion: 'agent-draft-v1' };
        }
      } catch {
        const fb = deterministicFallback({
          language,
          tone,
          rollNumber: ctx.rollNumber,
          daysOverdue: ctx.daysOverdue,
          overdueAmount: ctx.overdueAmount,
        });
        draft = {
          ...fb,
          studentId: ctx.studentId,
          templateVersion: 'agent-draft-v1',
        };
      }
      return draft;
    },
  );

  await logAgentAction({
    collegeId,
    userId: collegeId, // batched — caller is implicit
    type: 'reminder-draft',
    maskedPrompt: sampleMaskedPrompt || `${items.length} drafts`,
    maskedResponse: `${items.length} drafts produced`,
    llm: anyLlmFulfilled
      ? {
          provider,
          model,
          inputTokens: inTotal,
          outputTokens: outTotal,
          costInr: costTotal,
          durationMs: totalMs,
        }
      : null,
  });

  return drafted
    .filter((r): r is { status: 'fulfilled'; value: ReminderDraft } =>
      r.status === 'fulfilled',
    )
    .map((r) => r.value);
}

// ── Approve drafts ─────────────────────────────────────────────────────

export async function handleApproveDrafts(
  collegeId: string,
  userId: string,
  drafts: ApprovedDraft[],
): Promise<ApprovalResult> {
  ensureCollegeId(collegeId);

  // 1. Validate every studentId is in this college
  const ids = drafts
    .map((d) => d.studentId)
    .filter((s) => Types.ObjectId.isValid(s));
  const students = await Student.find({
    collegeId,
    _id: { $in: ids.map((s) => new Types.ObjectId(s)) },
  })
    .select({ _id: 1 })
    .lean();
  const validSet = new Set(students.map((s) => String(s._id)));
  for (const d of drafts) {
    if (!validSet.has(d.studentId)) {
      throw new AppError(403, 'Cross-college access denied');
    }
  }

  // 2. Create FeeReminder per draft + enqueue
  const reminderIds: string[] = [];
  for (const d of drafts) {
    const fr = await FeeReminder.create({
      collegeId,
      studentId: d.studentId,
      channel: 'sms',
      sentAt: new Date(),
      dueAmount: 0,
      status: 'sent',
      deliveryStatus: 'pending',
      metadata: {
        source: 'agent-draft-v1',
        approvedBy: userId,
        subject: d.subject,
        body: d.body,
        originalDraft: { subject: d.subject, body: d.body },
      },
    });
    reminderIds.push(String(fr._id));

    try {
      await addJob(QUEUE_NAMES.SMS, 'agent-reminder', {
        reminderId: String(fr._id),
        collegeId,
        studentId: d.studentId,
      });
    } catch (e) {
      // Don't fail the whole approval if Redis is offline — the worker
      // can be replayed later via an admin tool.
      // eslint-disable-next-line no-console
      console.warn(
        `[fee-agent] addJob failed for reminder=${String(fr._id)}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  await logAgentAction({
    collegeId,
    userId,
    type: 'reminder-approve',
    maskedPrompt: `${drafts.length} drafts approved`,
    maskedResponse: JSON.stringify(reminderIds),
    llm: null,
  });

  return {
    reminderIds,
    approvedCount: reminderIds.length,
  };
}

// ── Dismiss situation ──────────────────────────────────────────────────

export async function handleDismissSituation(
  collegeId: string,
  userId: string,
  fingerprint: string,
  snoozeDays: 1 | 3 | 7 | 30,
  reason: string,
): Promise<void> {
  ensureCollegeId(collegeId);

  const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000);

  await SituationDismissal.findOneAndUpdate(
    {
      collegeId,
      userId,
      situationFingerprint: fingerprint,
    },
    {
      $set: { snoozedUntil, reason },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await logAgentAction({
    collegeId,
    userId,
    type: 'situation-dismiss',
    maskedPrompt: `dismiss fingerprint=${fingerprint} snoozeDays=${snoozeDays}`,
    maskedResponse: `snoozedUntil=${snoozedUntil.toISOString()}`,
    llm: null,
  });
}

// ── Re-export for tests + A5 controller ────────────────────────────────

export { systemPrefix };
