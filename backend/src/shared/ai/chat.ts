import { maskFields } from '../rbac/sensitivity';
/**
 * The one streaming-chat orchestration. Finance and People both answer a
 * free-text question from a pre-baked context bundle; the only things that
 * differ per module are the bundle, the prompt template and the audit label,
 * so those are parameters and everything else — spend gate, conversation
 * persistence, PII masking, turn budget, streaming, audit row — lives here.
 *
 * Contract carried over from finance: the model answers FROM the bundle, it
 * never queries the database. Every number a user sees was computed server
 * side before the model was asked to phrase it.
 */
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';
import {
  assertWithinSpendLimit,
  type SpendCheckResult,
} from '../../modules/platform/spend-limits/service';
import { AgentConversation } from '../../models/juvi/AgentConversation';
import { AgentAction, type AgentActionType } from '../../models/juvi/AgentAction';
import { maskPII, unmaskText } from '../llm/pii';
import { createLLMClient, type LLMMessage, type LLMResponse } from './llm/client';
import { trimTurnsForBudget } from './helpers';

const TURN_INPUT_BUDGET_TOKENS = 8000;
const CHAR_PER_TOKEN_ESTIMATE = 4;

export interface BudgetWarning {
  spent: number;
  limit: number;
  pct: number;
  resetsAt: string; // ISO
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
  budgetWarning?: BudgetWarning;
}

export interface AgentChatChunk {
  type: 'delta' | 'done' | 'error';
  text?: string;
  final?: AgentChatFinal;
  error?: string;
}

export type AgentKey = 'finance' | 'people';

export interface AgentChatInput {
  collegeId: string;
  userId: string;
  prompt: string;
  conversationId?: string;
  abortSignal?: AbortSignal;
  /** Conversation namespace — a people conversation id never resumes a finance one. */
  agent: AgentKey;
  actionType: AgentActionType;
  /** Deterministic, unmasked context. Masking happens here, once, with the prompt. */
  buildContext: () => Promise<unknown>;
  /** 010 P3 — sensitivity classes the caller may not see; stripped from the context before it reaches the model. */
  hiddenClasses?: readonly string[];
  /** Returns `[system, user]`; prior turns are spliced between them. */
  buildMessages: (maskedContext: unknown, maskedPrompt: string) => LLMMessage[];
  /** Per-surface model override; defaults to `JUVI_CHAT_MODEL`, then the provider default. */
  model?: string;
}

/** Persist an AgentAction. Always the MASKED prompt + response. */
export async function logAgentAction(p: {
  collegeId: string;
  userId: string;
  type: AgentActionType;
  maskedPrompt: string;
  maskedResponse: string;
  llm: Pick<LLMResponse, 'provider' | 'model' | 'durationMs' | 'inputTokens' | 'outputTokens' | 'costInr'> | null;
}): Promise<string> {
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

export function toBudgetWarning(check: SpendCheckResult): BudgetWarning | undefined {
  if (!check.warning) return undefined;
  return { spent: check.spent, limit: check.limit, pct: check.pct, resetsAt: check.resetsAt.toISOString() };
}

export async function* runAgentChat(input: AgentChatInput): AsyncGenerator<AgentChatChunk> {
  const { collegeId, userId, prompt, agent } = input;
  const start = Date.now();
  if (!Types.ObjectId.isValid(collegeId)) throw new AppError(400, 'Invalid collegeId');

  // 0. Spend gate at request entry. A 429 becomes an error chunk so the SSE
  // controller can write `event: error` after headers are already flushed.
  let spendCheck: SpendCheckResult;
  try {
    spendCheck = await assertWithinSpendLimit(collegeId);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 429) {
      yield { type: 'error', error: e.message };
      return;
    }
    throw e;
  }

  // 1. Load (or start) the conversation.
  let convoDoc = input.conversationId
    ? await AgentConversation.findOne({ collegeId, userId, conversationId: input.conversationId, agent })
    : null;
  const resolvedConvoId = convoDoc ? convoDoc.conversationId : randomUUID();

  // 2. Prior turns: last 10, trimmed to the token budget.
  const priorTurns = trimTurnsForBudget(
    (convoDoc?.turns ?? []).slice(-10).map((t) => ({ role: t.role, content: t.content })),
    TURN_INPUT_BUDGET_TOKENS,
    CHAR_PER_TOKEN_ESTIMATE,
  );

  // 3. Context + question masked together so a name in the question gets the
  // same token as the same name in the bundle.
  const { masked, tokenMap } = maskPII({ bundle: maskFields(await input.buildContext(), input.hiddenClasses ?? []), prompt });

  // 4. [system, ...prior, user]
  const base = input.buildMessages(masked.bundle, String(masked.prompt));
  const messages: LLMMessage[] = [
    base[0]!,
    ...priorTurns.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    base[1]!,
  ];

  // 5. Stream.
  let client;
  try {
    client = createLLMClient();
  } catch (e) {
    yield { type: 'error', error: e instanceof Error ? e.message : String(e) };
    return;
  }

  let accumulated = '';
  let final: LLMResponse | null = null;
  try {
    // Command bars scan a long context for exact conditions, which the cheapest
    // model gets wrong; `JUVI_CHAT_MODEL` lifts only the chat surfaces.
    const model = input.model ?? (process.env.JUVI_CHAT_MODEL?.trim() || undefined);
    for await (const chunk of client.stream(messages, { abortSignal: input.abortSignal, model })) {
      if (chunk.delta) {
        accumulated += chunk.delta;
        yield { type: 'delta', text: unmaskText(chunk.delta, tokenMap) };
      }
      if (chunk.done && chunk.final) final = chunk.final;
    }
  } catch (e) {
    yield { type: 'error', error: e instanceof Error ? e.message : String(e) };
    return;
  }

  // 6. Unmask + persist.
  const unmasked = unmaskText(accumulated, tokenMap);
  const finalResponse: LLMResponse = final ?? {
    text: unmasked, inputTokens: 0, outputTokens: 0, model: 'unknown', provider: 'claude',
    costInr: 0, durationMs: Date.now() - start,
  };
  const newTurns = [
    { role: 'user' as const, content: prompt, timestamp: new Date() },
    { role: 'assistant' as const, content: unmasked, timestamp: new Date() },
  ];
  if (convoDoc) {
    convoDoc.turns.push(...newTurns);
    convoDoc.lastModel = finalResponse.model;
    convoDoc.lastProvider = finalResponse.provider;
    convoDoc.totalInputTokens = (convoDoc.totalInputTokens ?? 0) + finalResponse.inputTokens;
    convoDoc.totalOutputTokens = (convoDoc.totalOutputTokens ?? 0) + finalResponse.outputTokens;
    convoDoc.totalCostInr = (convoDoc.totalCostInr ?? 0) + finalResponse.costInr;
    await convoDoc.save();
  } else {
    convoDoc = await AgentConversation.create({
      collegeId, userId, agent, conversationId: resolvedConvoId, turns: newTurns,
      lastModel: finalResponse.model, lastProvider: finalResponse.provider,
      totalInputTokens: finalResponse.inputTokens, totalOutputTokens: finalResponse.outputTokens,
      totalCostInr: finalResponse.costInr,
    });
  }

  const auditId = await logAgentAction({
    collegeId, userId, type: input.actionType,
    // The full masked user turn — bundle included — is what the model saw.
    maskedPrompt: messages[messages.length - 1]?.content ?? prompt,
    maskedResponse: accumulated,
    llm: finalResponse,
  });

  yield {
    type: 'done',
    final: {
      provider: finalResponse.provider, model: finalResponse.model,
      inputTokens: finalResponse.inputTokens, outputTokens: finalResponse.outputTokens,
      costInr: finalResponse.costInr, durationMs: finalResponse.durationMs,
      auditId, conversationId: resolvedConvoId, budgetWarning: toBudgetWarning(spendCheck),
    },
  };
}
