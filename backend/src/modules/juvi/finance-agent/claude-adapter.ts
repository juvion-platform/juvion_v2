import Anthropic from '@anthropic-ai/sdk';

import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  computeCostInr,
  resolveModel,
  type LLMClient,
  type LLMMessage,
  type LLMOptions,
  type LLMResponse,
  type LLMStreamChunk,
} from './llm-client';

/**
 * Anthropic SDK adapter for the LLMClient interface.
 *
 * SDK pinned to `@anthropic-ai/sdk@^0.30.0`. The `Model` type in 0.30.x is
 * `(string & {}) | <hardcoded list>` — `claude-sonnet-4-5` is accepted as
 * an arbitrary string. If a future SDK release tightens the type, cast via
 * `unknown` first.
 */

interface ClaudeAdapterDeps {
  apiKey: string;
}

/**
 * Split LLMMessage[] into the (system, conversation) shape Anthropic
 * expects. Anthropic's Messages API uses a top-level `system` parameter
 * separate from the `messages` array.
 *
 * If multiple system turns are passed, they are joined with a blank line —
 * the Anthropic API rejects multiple system params and our orchestrator
 * (A4) typically passes a single system anyway, but be defensive.
 */
function splitSystem(messages: LLMMessage[]): {
  system: string | undefined;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systems: string[] = [];
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systems.push(m.content);
    } else {
      turns.push({ role: m.role, content: m.content });
    }
  }
  return {
    system: systems.length > 0 ? systems.join('\n\n') : undefined,
    turns,
  };
}

export function createClaudeAdapter(deps: ClaudeAdapterDeps): LLMClient {
  const sdk = new Anthropic({ apiKey: deps.apiKey });
  const provider = 'claude' as const;

  async function complete(messages: LLMMessage[], opts: LLMOptions = {}): Promise<LLMResponse> {
    const { system, turns } = splitSystem(messages);
    const model = resolveModel(provider, opts.model);
    const start = Date.now();

    // The Model type in 0.30.x doesn't list `claude-sonnet-4-5` literally,
    // but the type alias is `(string & {}) | <list>` which accepts any
    // string. Cast through `unknown` to satisfy future stricter SDKs.
    const body = {
      model: model as unknown as string,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      messages: turns,
      ...(system ? { system } : {}),
    };

    const sdkOpts = opts.abortSignal ? { signal: opts.abortSignal } : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await (sdk.messages.create as any)(body, sdkOpts);
    const durationMs = Date.now() - start;

    const text = extractText(raw);
    const inputTokens = Number(raw?.usage?.input_tokens ?? 0);
    const outputTokens = Number(raw?.usage?.output_tokens ?? 0);
    const respModel = String(raw?.model ?? model);

    return {
      text,
      inputTokens,
      outputTokens,
      model: respModel,
      provider,
      costInr: computeCostInr(provider, inputTokens, outputTokens),
      durationMs,
    };
  }

  function stream(messages: LLMMessage[], opts: LLMOptions = {}): AsyncIterable<LLMStreamChunk> {
    return claudeStream(sdk, messages, opts);
  }

  return { provider, complete, stream };
}

/**
 * Pull a single concatenated text payload out of a non-streaming Anthropic
 * Message. The shape is `content: Array<TextBlock | ToolUseBlock>`; we
 * concatenate text blocks and ignore tool_use (not used by the agent yet).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(raw: any): string {
  const content = raw?.content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts.join('');
}

/**
 * Async iterator over Anthropic stream events.
 *
 * Maps `RawMessageStreamEvent` to LLMStreamChunk:
 *   - `content_block_delta.text_delta` → `{ delta, done: false }`
 *   - `message_stop` → final chunk with usage + cost
 *
 * `usage.input_tokens` is sourced from the initial `message_start`; the
 * cumulative `output_tokens` comes from the trailing `message_delta`.
 */
async function* claudeStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any,
  messages: LLMMessage[],
  opts: LLMOptions,
): AsyncIterable<LLMStreamChunk> {
  const { system, turns } = splitSystem(messages);
  const model = resolveModel('claude', opts.model);
  const start = Date.now();

  const body = {
    model: model as unknown as string,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    messages: turns,
    stream: true as const,
    ...(system ? { system } : {}),
  };

  const sdkOpts = opts.abortSignal ? { signal: opts.abortSignal } : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: AsyncIterable<any> = await (sdk.messages.create as any)(body, sdkOpts);

  let inputTokens = 0;
  let outputTokens = 0;
  let respModel = model;
  const textParts: string[] = [];

  for await (const ev of stream) {
    if (ev?.type === 'message_start') {
      const u = ev?.message?.usage;
      if (u) {
        inputTokens = Number(u.input_tokens ?? 0);
        outputTokens = Number(u.output_tokens ?? 0);
      }
      const m = ev?.message?.model;
      if (m) respModel = String(m);
    } else if (ev?.type === 'content_block_delta') {
      const d = ev?.delta;
      if (d?.type === 'text_delta' && typeof d.text === 'string' && d.text.length > 0) {
        textParts.push(d.text);
        yield { delta: d.text, done: false };
      }
    } else if (ev?.type === 'message_delta') {
      const u = ev?.usage;
      if (u && typeof u.output_tokens === 'number') {
        outputTokens = u.output_tokens;
      }
    }
    // message_stop / content_block_start / content_block_stop are no-ops.
  }

  const final: LLMResponse = {
    text: textParts.join(''),
    inputTokens,
    outputTokens,
    model: respModel,
    provider: 'claude',
    costInr: computeCostInr('claude', inputTokens, outputTokens),
    durationMs: Date.now() - start,
  };
  yield { delta: '', done: true, final };
}
