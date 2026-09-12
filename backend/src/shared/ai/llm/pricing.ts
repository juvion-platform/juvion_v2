import { AppError } from '../../../middleware/errorHandler';

/**
 * Per-million-token pricing (USD), keyed by MODEL, not provider.
 *
 * Keyed by provider it silently mispriced on any model swap (a Haiku call
 * billed at Sonnet rates, or an Opus call billed at Sonnet rates) and that
 * number is what the weekly spend gate reads. An unknown model now throws at
 * client construction rather than costing ₹0 — add the row here when you
 * change `LLM_MODEL`.
 *
 * Lookup is longest-prefix so dated snapshots (`claude-sonnet-4-5-20250929`,
 * `gpt-4o-mini-2024-07-18`) price as their base model.
 *
 * Rates: Anthropic public API list (2026-06) and OpenAI list. Converted to
 * INR via `LLM_INR_RATE` (default 85).
 */
export const PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

const DEFAULT_INR_RATE = 85.0;

export function priceFor(model: string): { input: number; output: number } {
  let best: string | undefined;
  for (const key of Object.keys(PRICING_USD_PER_MILLION)) {
    if (model.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  if (!best) {
    throw new AppError(
      503,
      `LLM provider misconfigured: no pricing for model "${model}" — add it to shared/ai/llm/pricing.ts`,
    );
  }
  return PRICING_USD_PER_MILLION[best]!;
}

/** INR cost for one call, rounded to 4 decimals. */
export function computeCostInr(
  model: string,
  inputTokens: number,
  outputTokens: number,
  inrRate: number = readInrRate(),
): number {
  const p = priceFor(model);
  const usd = (inputTokens * p.input) / 1_000_000 + (outputTokens * p.output) / 1_000_000;
  return Number((usd * inrRate).toFixed(4));
}

function readInrRate(): number {
  const raw = process.env.LLM_INR_RATE;
  if (!raw) return DEFAULT_INR_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INR_RATE;
}
