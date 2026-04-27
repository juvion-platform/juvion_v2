import OpenAI from 'openai';

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
 * OpenAI SDK adapter for the LLMClient interface.
 *
 * SDK pinned to `openai@^4.60.0`. Uses the chat.completions API surface;
 * streaming responses arrive as `ChatCompletionChunk`s.
 */

interface OpenAIAdapterDeps {
  apiKey: string;
}

export function createOpenAIAdapter(deps: OpenAIAdapterDeps): LLMClient {
  const sdk = new OpenAI({ apiKey: deps.apiKey });
  const provider = 'openai' as const;

  async function complete(messages: LLMMessage[], opts: LLMOptions = {}): Promise<LLMResponse> {
    const model = resolveModel(provider, opts.model);
    const start = Date.now();

    const body = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    const sdkOpts = opts.abortSignal ? { signal: opts.abortSignal } : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await (sdk.chat.completions.create as any)(body, sdkOpts);
    const durationMs = Date.now() - start;

    const text = String(raw?.choices?.[0]?.message?.content ?? '');
    const inputTokens = Number(raw?.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(raw?.usage?.completion_tokens ?? 0);
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
    return openaiStream(sdk, messages, opts);
  }

  return { provider, complete, stream };
}

/**
 * Stream `ChatCompletionChunk`s from OpenAI and yield LLMStreamChunks.
 *
 * We pass `stream_options.include_usage = true` so the final chunk carries
 * the token counts; otherwise OpenAI omits `usage` on streaming responses.
 */
async function* openaiStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any,
  messages: LLMMessage[],
  opts: LLMOptions,
): AsyncIterable<LLMStreamChunk> {
  const model = resolveModel('openai', opts.model);
  const start = Date.now();

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true as const,
    stream_options: { include_usage: true },
  };

  const sdkOpts = opts.abortSignal ? { signal: opts.abortSignal } : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: AsyncIterable<any> = await (sdk.chat.completions.create as any)(body, sdkOpts);

  let inputTokens = 0;
  let outputTokens = 0;
  let respModel = model;
  const textParts: string[] = [];

  for await (const chunk of stream) {
    if (!chunk) continue;
    if (chunk.model && typeof chunk.model === 'string') {
      respModel = chunk.model;
    }
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      textParts.push(delta);
      yield { delta, done: false };
    }
    if (chunk.usage) {
      inputTokens = Number(chunk.usage.prompt_tokens ?? inputTokens);
      outputTokens = Number(chunk.usage.completion_tokens ?? outputTokens);
    }
  }

  const final: LLMResponse = {
    text: textParts.join(''),
    inputTokens,
    outputTokens,
    model: respModel,
    provider: 'openai',
    costInr: computeCostInr('openai', inputTokens, outputTokens),
    durationMs: Date.now() - start,
  };
  yield { delta: '', done: true, final };
}
