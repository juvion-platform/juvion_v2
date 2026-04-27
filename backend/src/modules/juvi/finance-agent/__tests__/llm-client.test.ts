import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AppError } from '../../../../middleware/errorHandler';

/**
 * Task A1 — LLM provider abstraction tests (fee-analytics-ai-native).
 *
 * These tests pin the contract for the LLMClient + factory + adapters.
 * Downstream tasks (A4 service orchestrator) consume this surface, so the
 * shape MUST be stable.
 *
 * The Anthropic + OpenAI SDKs are mocked module-level — no real network
 * calls. We verify:
 *
 *   - factory env switching + missing-key 503
 *   - response shape (text + token counts + costInr + provider/model)
 *   - cost computation (per-token rates × INR rate)
 *   - streaming yields incremental deltas + a final chunk with usage
 *   - abortSignal aborts in-flight requests
 *   - per-call opts.model overrides + LLM_MODEL env override
 */

// ── Mock the SDKs at module level ──────────────────────────────────────

const anthropicCreateMock = vi.fn();
const openaiCreateMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  // Default import: must be constructable (the adapter calls `new Anthropic(...)`).
  class MockAnthropic {
    messages = { create: anthropicCreateMock };
    constructor(_opts?: unknown) {
      void _opts;
    }
  }
  return { default: MockAnthropic };
});

vi.mock('openai', () => {
  class MockOpenAI {
    chat = { completions: { create: openaiCreateMock } };
    constructor(_opts?: unknown) {
      void _opts;
    }
  }
  return { default: MockOpenAI };
});

// ── Helpers to build mock SDK responses ────────────────────────────────

function anthropicResponse(opts: {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}) {
  return {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: opts.model ?? 'claude-sonnet-4-5',
    content: [{ type: 'text', text: opts.text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: opts.inputTokens, output_tokens: opts.outputTokens },
  };
}

function openaiResponse(opts: {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}) {
  return {
    id: 'chatcmpl-01',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: opts.model ?? 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        logprobs: null,
        message: { role: 'assistant', content: opts.text, refusal: null },
      },
    ],
    usage: {
      prompt_tokens: opts.inputTokens,
      completion_tokens: opts.outputTokens,
      total_tokens: opts.inputTokens + opts.outputTokens,
    },
  };
}

/** Async-iterable helper that yields the supplied stream events. */
async function* asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

function anthropicStreamEvents(text: string, inputTokens: number, outputTokens: number) {
  // Match the RawMessageStreamEvent shape: start → content_block_delta(s) → message_delta(usage) → message_stop
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_01',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...text.split('').map((ch) => ({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: ch },
    })),
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: outputTokens },
    },
    { type: 'message_stop' },
  ];
}

function openaiStreamChunks(text: string, inputTokens: number, outputTokens: number) {
  const created = Math.floor(Date.now() / 1000);
  const base = {
    id: 'chatcmpl-01',
    object: 'chat.completion.chunk' as const,
    created,
    model: 'gpt-4o-mini',
  };
  const chunks: Array<Record<string, unknown>> = [];
  // First chunk has role; subsequent chunks carry deltas
  for (let i = 0; i < text.length; i++) {
    chunks.push({
      ...base,
      choices: [
        {
          index: 0,
          delta: i === 0 ? { role: 'assistant', content: text[i] } : { content: text[i] },
          finish_reason: null,
        },
      ],
    });
  }
  // Final chunk: stop + usage (only present when stream_options.include_usage)
  chunks.push({
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  });
  return chunks;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const ORIG_ENV = { ...process.env };

function resetEnv() {
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_INR_RATE;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  // The implementation now reads AI_PROVIDER + AI_API_KEY first, falling
  // back to the LLM_*/provider-specific names. Reset both halves here so a
  // value leaking in from the surrounding env can't poison a test.
  delete process.env.AI_PROVIDER;
  delete process.env.AI_API_KEY;
}

beforeEach(() => {
  resetEnv();
  anthropicCreateMock.mockReset();
  openaiCreateMock.mockReset();
});

afterEach(() => {
  // Restore everything we touched.
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIG_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIG_ENV)) {
    if (typeof v === 'string') process.env[k] = v;
  }
});

// ── Cost expectations (from spec) ───────────────────────────────────────
// Claude Sonnet 4.5: $3 / 1M input, $15 / 1M output  (in INR via LLM_INR_RATE)
// GPT-4o-mini:     $0.15 / 1M input, $0.60 / 1M output
const INR_RATE = 85.0;
const claudeCost = (inTok: number, outTok: number, rate = INR_RATE) =>
  Number((((inTok * 3) / 1_000_000 + (outTok * 15) / 1_000_000) * rate).toFixed(4));
const openaiCost = (inTok: number, outTok: number, rate = INR_RATE) =>
  Number((((inTok * 0.15) / 1_000_000 + (outTok * 0.6) / 1_000_000) * rate).toFixed(4));

// ─────────────────────────────────────────────────────────────────────────
// Provider abstraction tests
// ─────────────────────────────────────────────────────────────────────────

describe('createLLMClient — factory + env switching', () => {
  it('returns claude adapter when LLM_PROVIDER=claude and ANTHROPIC_API_KEY set', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient();
    expect(client.provider).toBe('claude');
  });

  it('returns openai adapter when LLM_PROVIDER=openai and OPENAI_API_KEY set', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient();
    expect(client.provider).toBe('openai');
  });

  it('explicit createLLMClient(provider) overrides env', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient('openai');
    expect(client.provider).toBe('openai');
  });

  it('falls back to claude when LLM_PROVIDER is invalid', async () => {
    process.env.LLM_PROVIDER = 'gemini-blah';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient();
    expect(client.provider).toBe('claude');
  });

  it('falls back to claude when LLM_PROVIDER is unset', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient();
    expect(client.provider).toBe('claude');
  });

  it('throws AppError(503) when claude selected but ANTHROPIC_API_KEY missing', async () => {
    process.env.LLM_PROVIDER = 'claude';
    const { createLLMClient } = await import('../llm-client');

    let caught: unknown = null;
    try {
      createLLMClient();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(503);
    expect((caught as AppError).message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('throws AppError(503) when openai selected but OPENAI_API_KEY missing', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const { createLLMClient } = await import('../llm-client');

    let caught: unknown = null;
    try {
      createLLMClient('openai');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(503);
    expect((caught as AppError).message).toMatch(/OPENAI_API_KEY/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Claude adapter
// ─────────────────────────────────────────────────────────────────────────

describe('claude adapter — complete()', () => {
  it('returns text + tokens + model + provider + costInr', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LLM_INR_RATE = String(INR_RATE);
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'Collection is healthy.', inputTokens: 600, outputTokens: 80 }),
    );
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient('claude');
    const res = await client.complete([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);

    expect(res.text).toBe('Collection is healthy.');
    expect(res.inputTokens).toBe(600);
    expect(res.outputTokens).toBe(80);
    expect(res.provider).toBe('claude');
    expect(res.model).toBe('claude-sonnet-4-5');
    expect(res.costInr).toBe(claudeCost(600, 80));
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes system messages via the top-level system param + maps user/assistant turns', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'ok', inputTokens: 10, outputTokens: 5 }),
    );
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient('claude');
    await client.complete([
      { role: 'system', content: 'You are a helpful agent.' },
      { role: 'user', content: 'first user' },
      { role: 'assistant', content: 'first assistant' },
      { role: 'user', content: 'second user' },
    ]);

    const callArgs = anthropicCreateMock.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.system).toBe('You are a helpful agent.');
    expect(callArgs.messages).toEqual([
      { role: 'user', content: 'first user' },
      { role: 'assistant', content: 'first assistant' },
      { role: 'user', content: 'second user' },
    ]);
    expect(callArgs.model).toBe('claude-sonnet-4-5');
  });

  it('per-call opts.model overrides default; LLM_MODEL env overrides default', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LLM_MODEL = 'claude-3-5-sonnet-latest';
    anthropicCreateMock.mockResolvedValue(
      anthropicResponse({ text: 'x', inputTokens: 1, outputTokens: 1, model: 'claude-3-5-sonnet-latest' }),
    );
    const { createLLMClient } = await import('../llm-client');

    const client = createLLMClient('claude');

    // env override
    await client.complete([{ role: 'user', content: 'q' }]);
    expect(anthropicCreateMock.mock.calls[0]?.[0]?.model).toBe('claude-3-5-sonnet-latest');

    // per-call override beats env
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'x', inputTokens: 1, outputTokens: 1, model: 'claude-opus-latest' }),
    );
    await client.complete([{ role: 'user', content: 'q' }], { model: 'claude-opus-latest' });
    expect(anthropicCreateMock.mock.calls[1]?.[0]?.model).toBe('claude-opus-latest');
  });

  it('uses default temperature 0.3 + maxTokens 1500 when opts not provided', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'x', inputTokens: 1, outputTokens: 1 }),
    );
    const { createLLMClient } = await import('../llm-client');

    await createLLMClient('claude').complete([{ role: 'user', content: 'q' }]);
    const args = anthropicCreateMock.mock.calls[0]?.[0];
    expect(args.temperature).toBe(0.3);
    expect(args.max_tokens).toBe(1500);
  });

  it('LLM_INR_RATE env tweaks costInr', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.LLM_INR_RATE = '90.0';
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'x', inputTokens: 1000, outputTokens: 500 }),
    );
    const { createLLMClient } = await import('../llm-client');

    const res = await createLLMClient('claude').complete([{ role: 'user', content: 'q' }]);
    expect(res.costInr).toBe(claudeCost(1000, 500, 90.0));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// OpenAI adapter
// ─────────────────────────────────────────────────────────────────────────

describe('openai adapter — complete()', () => {
  it('returns text + tokens + model + provider + costInr', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.LLM_INR_RATE = String(INR_RATE);
    openaiCreateMock.mockResolvedValueOnce(
      openaiResponse({ text: 'fees due tomorrow', inputTokens: 1200, outputTokens: 60 }),
    );
    const { createLLMClient } = await import('../llm-client');

    const res = await createLLMClient('openai').complete([{ role: 'user', content: 'hi' }]);

    expect(res.text).toBe('fees due tomorrow');
    expect(res.inputTokens).toBe(1200);
    expect(res.outputTokens).toBe(60);
    expect(res.provider).toBe('openai');
    expect(res.model).toBe('gpt-4o-mini');
    expect(res.costInr).toBe(openaiCost(1200, 60));
  });

  it('passes mapped messages including system/user/assistant', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    openaiCreateMock.mockResolvedValueOnce(
      openaiResponse({ text: 'ok', inputTokens: 1, outputTokens: 1 }),
    );
    const { createLLMClient } = await import('../llm-client');

    await createLLMClient('openai').complete([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ]);

    const args = openaiCreateMock.mock.calls[0]?.[0];
    expect(args.model).toBe('gpt-4o-mini');
    expect(args.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u' },
      { role: 'assistant', content: 'a' },
    ]);
    expect(args.temperature).toBe(0.3);
    expect(args.max_tokens).toBe(1500);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────────────────

describe('claude adapter — stream()', () => {
  it('yields delta chunks then a final chunk with usage', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const events = anthropicStreamEvents('Hi.', 30, 5);
    anthropicCreateMock.mockResolvedValueOnce(asAsyncIterable(events));
    const { createLLMClient } = await import('../llm-client');

    const out: Array<{ delta: string; done: boolean }> = [];
    let final: any;
    for await (const ch of createLLMClient('claude').stream([{ role: 'user', content: 'q' }])) {
      out.push({ delta: ch.delta, done: ch.done });
      if (ch.done) final = ch.final;
    }

    const text = out.map((c) => c.delta).join('');
    expect(text).toBe('Hi.');
    expect(out[out.length - 1]?.done).toBe(true);
    expect(final?.text).toBe('Hi.');
    expect(final?.inputTokens).toBe(30);
    expect(final?.outputTokens).toBe(5);
    expect(final?.provider).toBe('claude');
    expect(final?.costInr).toBe(claudeCost(30, 5));
  });
});

describe('openai adapter — stream()', () => {
  it('yields delta chunks then a final chunk with usage', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    const chunks = openaiStreamChunks('Hi!', 50, 8);
    openaiCreateMock.mockResolvedValueOnce(asAsyncIterable(chunks));
    const { createLLMClient } = await import('../llm-client');

    const out: Array<{ delta: string; done: boolean }> = [];
    let final: any;
    for await (const ch of createLLMClient('openai').stream([{ role: 'user', content: 'q' }])) {
      out.push({ delta: ch.delta, done: ch.done });
      if (ch.done) final = ch.final;
    }

    expect(out.map((c) => c.delta).join('')).toBe('Hi!');
    expect(out[out.length - 1]?.done).toBe(true);
    expect(final?.text).toBe('Hi!');
    expect(final?.inputTokens).toBe(50);
    expect(final?.outputTokens).toBe(8);
    expect(final?.provider).toBe('openai');
    expect(final?.costInr).toBe(openaiCost(50, 8));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Abort signal
// ─────────────────────────────────────────────────────────────────────────

describe('abort signal — claude.complete', () => {
  it('passes opts.abortSignal through to the SDK call as opts.signal', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicResponse({ text: 'x', inputTokens: 1, outputTokens: 1 }),
    );
    const { createLLMClient } = await import('../llm-client');

    const ac = new AbortController();
    await createLLMClient('claude').complete([{ role: 'user', content: 'q' }], {
      abortSignal: ac.signal,
    });

    // The Anthropic SDK takes a second `options` arg with a `signal` field.
    const optsArg = anthropicCreateMock.mock.calls[0]?.[1];
    expect(optsArg).toBeDefined();
    expect(optsArg.signal).toBe(ac.signal);
  });

  it('claude.stream() forwards abort signal + aborting before stream throws', async () => {
    process.env.LLM_PROVIDER = 'claude';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { createLLMClient } = await import('../llm-client');

    const ac = new AbortController();
    ac.abort();

    anthropicCreateMock.mockImplementationOnce(async (_body: unknown, opts: { signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      return asAsyncIterable(anthropicStreamEvents('x', 1, 1));
    });

    let caught: unknown = null;
    try {
      for await (const _ of createLLMClient('claude').stream([{ role: 'user', content: 'q' }], {
        abortSignal: ac.signal,
      })) {
        /* noop */
      }
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
  });
});
