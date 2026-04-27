import { AppError } from '../../../middleware/errorHandler';
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
 * Factory: returns the active LLMClient. Throws AppError(503) when the
 * required API key for the active provider is missing.
 *
 * Key resolution per provider (first non-empty wins):
 *   claude  → AI_API_KEY  → ANTHROPIC_API_KEY
 *   openai  → AI_API_KEY  → OPENAI_API_KEY
 *
 * The shared `AI_API_KEY` is the existing repo-wide env name. Provider-
 * specific names are still honoured as a fallback for environments that
 * keep both keys configured.
 */
export function createLLMClient(provider?: LLMProvider): LLMClient {
  const active = resolveProvider(provider);

  if (active === 'claude') {
    const key = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AppError(
        503,
        'LLM provider misconfigured: AI_API_KEY (or ANTHROPIC_API_KEY) missing',
      );
    }
    return createClaudeAdapter({ apiKey: key });
  }

  const key = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new AppError(
      503,
      'LLM provider misconfigured: AI_API_KEY (or OPENAI_API_KEY) missing',
    );
  }
  return createOpenAIAdapter({ apiKey: key });
}
