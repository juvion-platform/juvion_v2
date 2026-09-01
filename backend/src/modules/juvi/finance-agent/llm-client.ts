import { AppError } from '../../../middleware/errorHandler';
import { assertWithinSpendLimit } from '../../platform/spend-limits/service';
import type { AgentActionType } from '../../../models/juvi/AgentAction';
import { createClaudeAdapter } from './claude-adapter';
import { createOpenAIAdapter } from './openai-adapter';

/**
 * Provider-agnostic LLM client interface for the fee-analytics-ai-native
 * finance agent.
 *
 * Two adapters implement this interface:
 *   - claude-adapter.ts → Anthropic SDK (Claude Sonnet 4.5)
 *   - openai-adapter.ts → OpenAI SDK (GPT-4o-mini)
 *
 * Spec source: `.captain/specs/fee-analytics-ai-native/plan.md` §1.4
 */

export type LLMProvider = 'claude' | 'openai';
export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMOptions {
  /** Per-call model override; falls back to `LLM_MODEL` env, then provider default. */
  model?: string;
  /** Default 0.3 — sober, deterministic finance ops voice. */
  temperature?: number;
  /** Default 1500 — calibrated for narratives + structured JSON. */
  maxTokens?: number;
  /** Cancel an in-flight request mid-call. Forwarded to the SDK. */
  abortSignal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: LLMProvider;
  /** Cost in INR using current public per-million-token pricing × LLM_INR_RATE. */
  costInr: number;
  /** End-to-end latency in milliseconds (SDK call duration). */
  durationMs: number;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
  /** Populated only on the final chunk (`done: true`). */
  final?: LLMResponse;
}

export interface LLMClient {
  provider: LLMProvider;
  complete(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse>;
  stream(messages: LLMMessage[], opts?: LLMOptions): AsyncIterable<LLMStreamChunk>;
}

// ── Public defaults ─────────────────────────────────────────────────────

export const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_MAX_TOKENS = 1500;

export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-5';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Per-million-token pricing (USD) — current public rates as of 2026-04.
 *
 *   Claude Sonnet 4.5: $3 input / $15 output
 *   GPT-4o-mini:       $0.15 input / $0.60 output
 *
 * Update here if Anthropic/OpenAI publish new pricing. Cost is converted
 * to INR via `LLM_INR_RATE` env (default 85.0).
 */
export const PRICING_USD_PER_MILLION: Record<LLMProvider, { input: number; output: number }> = {
  claude: { input: 3, output: 15 },
  openai: { input: 0.15, output: 0.6 },
};

const DEFAULT_INR_RATE = 85.0;

/**
 * Compute INR cost for a (provider, model, inputTokens, outputTokens) tuple.
 * Rounded to 4 decimal places.
 *
 * Exposed as a named export so both adapters share the same call site
 * (refactor target) and tests can assert exact numeric outputs.
 */
export function computeCostInr(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number,
  inrRate: number = readInrRate(),
): number {
  const pricing = PRICING_USD_PER_MILLION[provider];
  const usd = (inputTokens * pricing.input) / 1_000_000 + (outputTokens * pricing.output) / 1_000_000;
  const inr = usd * inrRate;
  return Number(inr.toFixed(4));
}

function readInrRate(): number {
  const raw = process.env.LLM_INR_RATE;
  if (!raw) return DEFAULT_INR_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INR_RATE;
}

/**
 * Resolve the active provider from explicit arg → env → fallback.
 *
 * Reads `AI_PROVIDER` (the existing repo-wide env var) primarily; falls back
 * to `LLM_PROVIDER` if `AI_PROVIDER` is not set. This keeps the contract
 * compatible with the older Juvi env config while still honouring the
 * fee-analytics-ai-native naming when callers explicitly use it.
 */
function resolveProvider(explicit?: LLMProvider): LLMProvider {
  if (explicit === 'claude' || explicit === 'openai') return explicit;
  const env = (process.env.AI_PROVIDER ?? process.env.LLM_PROVIDER)?.toLowerCase();
  if (env === 'claude' || env === 'openai') return env;
  // Anything else (unset, typo, "gemini", etc.) → safe default
  return 'claude';
}

/**
 * Resolve the model name for a given provider.
 *
 * Precedence: per-call `opts.model` > `LLM_MODEL` env > provider default.
 *
 * The two adapters call this with their per-call opts so the precedence is
 * applied consistently.
 */
export function resolveModel(provider: LLMProvider, optsModel?: string): string {
  if (optsModel) return optsModel;
  const env = process.env.LLM_MODEL;
  if (env && env.trim().length > 0) return env;
  return provider === 'claude' ? CLAUDE_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL;
}

/**
 * Placeholder API keys that pass a non-empty check but 401 at call time.
 *
 * This repo has already been burned by exactly that: 41 audit rows recorded
 * `model: 'unknown'`, 0 tokens and zero cost because `AI_API_KEY` was the
 * literal string `change-`. Every one of those calls silently degraded to
 * rule-based fallback text and nobody noticed across 41 attempts. Failing at
 * construction turns a silent multi-week degradation into a loud 503.
 */
const PLACEHOLDER_PREFIXES = ['change', 'your-', 'your_', 'xxx', 'todo', '<', 'placeholder', 'replace'];

export function looksLikePlaceholder(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (k.length === 0) return true;
  // Deliberately prefix-only. A length floor was tried and rejected: it fails
  // legitimate short keys (test fixtures use 'sk-test') while catching nothing
  // a prefix does not. The documented real-world failure was the literal
  // string 'change-', which the prefix list covers exactly.
  return PLACEHOLDER_PREFIXES.some((p) => k.startsWith(p));
}

function resolveKey(active: LLMProvider): string {
  const fallbackName = active === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const key =
    process.env.AI_API_KEY ??
    (active === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);

  if (!key) {
    throw new AppError(
      503,
      `LLM provider misconfigured: AI_API_KEY (or ${fallbackName}) missing`,
    );
  }
  if (looksLikePlaceholder(key)) {
    throw new AppError(
      503,
      `LLM provider misconfigured: AI_API_KEY looks like a placeholder, not a real key`,
    );
  }
  return key;
}

/**
 * Per-call accounting context.
 *
 * OPTIONAL by design. `createLLMClient()` keeps working with no arguments, so
 * the eight existing call sites and every test that constructs a client stay
 * untouched. When context IS supplied, the returned client additionally:
 *
 *   - checks the college's weekly spend limit BEFORE the call, and
 *   - writes the `AgentAction` audit row AFTER it.
 *
 * Both of those live in the orchestrator today, which is why only the finance
 * agent is metered — NL reports, config-suggest and lead-scoring spend money
 * the budget cannot see. Passing context here is how a consumer opts in
 * without each one re-implementing the pair.
 *
 * The gate cannot move into the factory itself: the factory is synchronous and
 * `stream()` returns a sync AsyncIterable, so gating happens on the first call
 * rather than at construction. Cost is only known after the call (and for a
 * stream, only on the final chunk), so the audit write hooks the call's end.
 */
export interface LLMCallContext {
  collegeId: string;
  /** AgentAction.userId is required; pass the college id for batch/system work. */
  userId: string;
  actionType: AgentActionType;
  /**
   * Prompts reaching this layer are ALREADY PII-masked by the caller — masking
   * happens before prompt assembly. Nothing here re-masks.
   */
  promptLabel?: string;
}

export function createLLMClient(
  provider?: LLMProvider,
  ctx?: LLMCallContext,
): LLMClient {
  const active = resolveProvider(provider);
  const key = resolveKey(active);
  const base =
    active === 'claude'
      ? createClaudeAdapter({ apiKey: key })
      : createOpenAIAdapter({ apiKey: key });

  if (!ctx) return base;
  return withAccounting(base, ctx);
}

/** Serialise the outbound messages for the audit row (already masked). */
function promptFor(ctx: LLMCallContext, messages: LLMMessage[]): string {
  if (ctx.promptLabel) return ctx.promptLabel;
  return messages[messages.length - 1]?.content ?? '(no prompt)';
}

/**
 * Wrap a client so every call is gated then audited.
 *
 * Failure posture is deliberate and asymmetric:
 *   - the spend gate's 429 PROPAGATES (an over-budget tenant must be stopped)
 *   - an audit write failure NEVER propagates (losing a log entry must not
 *     lose the caller's answer)
 */
function withAccounting(base: LLMClient, ctx: LLMCallContext): LLMClient {
  return {
    provider: base.provider,

    async complete(messages, opts) {
      await assertWithinSpendLimit(ctx.collegeId);
      try {
        const res = await base.complete(messages, opts);
        await writeAudit(ctx, promptFor(ctx, messages), res.text, res);
        return res;
      } catch (err) {
        await writeAudit(ctx, promptFor(ctx, messages), '(llm-failed)', null);
        throw err;
      }
    },

    async *stream(messages, opts) {
      await assertWithinSpendLimit(ctx.collegeId);
      let text = '';
      let final: LLMResponse | null = null;
      try {
        for await (const chunk of base.stream(messages, opts)) {
          if (chunk.delta) text += chunk.delta;
          if (chunk.done && chunk.final) final = chunk.final;
          yield chunk;
        }
      } finally {
        // `finally` so an aborted stream still records what it spent.
        await writeAudit(ctx, promptFor(ctx, messages), text || '(no output)', final);
      }
    },
  };
}

async function writeAudit(
  ctx: LLMCallContext,
  maskedPrompt: string,
  maskedResponse: string,
  llm: LLMResponse | null,
): Promise<void> {
  try {
    const { AgentAction } = await import('../../../models/juvi/AgentAction');
    await AgentAction.create({
      collegeId: ctx.collegeId,
      userId: ctx.userId,
      type: ctx.actionType,
      // Mongoose 6+ rejects empty strings on required String fields.
      maskedPrompt: maskedPrompt || '(no prompt)',
      maskedResponse: maskedResponse || '(no response)',
      provider: llm?.provider ?? 'claude',
      model: llm?.model ?? 'unknown',
      durationMs: llm?.durationMs ?? 0,
      inputTokens: llm?.inputTokens ?? 0,
      outputTokens: llm?.outputTokens ?? 0,
      costInr: llm?.costInr ?? 0,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[llm-audit] write failed college=${ctx.collegeId} type=${ctx.actionType}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
