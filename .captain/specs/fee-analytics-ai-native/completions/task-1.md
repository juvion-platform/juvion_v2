# Completion: Task A1 — LLM provider abstraction + PII masker (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored (ready for captain-spec verification → Done)

## Files Changed

### Created

- `backend/src/modules/juvi/finance-agent/llm-client.ts` — provider-agnostic interface + factory.
  - Public surface (downstream A4 depends on these exact types):
    - `LLMProvider`, `LLMRole`, `LLMMessage`, `LLMOptions`, `LLMResponse`, `LLMStreamChunk`, `LLMClient`
    - `createLLMClient(provider?: LLMProvider): LLMClient`
    - `computeCostInr(provider, inputTokens, outputTokens, inrRate?): number` — single shared cost helper
    - `resolveModel(provider, optsModel?): string` — applies precedence: per-call > `LLM_MODEL` env > provider default
    - Constants: `DEFAULT_TEMPERATURE = 0.3`, `DEFAULT_MAX_TOKENS = 1500`, `CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-5'`, `OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'`, `PRICING_USD_PER_MILLION` table.
  - Factory throws `AppError(503, 'LLM provider misconfigured: <KEY> missing')` (statusCode FIRST per CLAUDE.md) when the active provider lacks its API key.
  - `LLM_PROVIDER` env honored; invalid values fall back to `claude` per spec.
  - `LLM_INR_RATE` env (default 85.0) feeds `computeCostInr`.

- `backend/src/modules/juvi/finance-agent/claude-adapter.ts` — Anthropic SDK adapter.
  - `createClaudeAdapter({ apiKey })` returns `LLMClient`.
  - `complete()` issues a single `messages.create()` call. System messages are joined and lifted to the top-level `system` parameter (Anthropic's API shape); user/assistant turns pass through as-is.
  - `stream()` async-iterates `RawMessageStreamEvent`s — extracts `message_start.usage.input_tokens`, accumulates `content_block_delta.text_delta` for incremental yield, captures the cumulative `output_tokens` from the trailing `message_delta`. Final chunk carries the consolidated `LLMResponse` (text, tokens, cost, model, durationMs).
  - `abortSignal` is forwarded to the SDK as the second-arg `{ signal }`.

- `backend/src/modules/juvi/finance-agent/openai-adapter.ts` — OpenAI SDK adapter.
  - `createOpenAIAdapter({ apiKey })` returns `LLMClient`.
  - `complete()` calls `chat.completions.create()` with full messages array (no system-split — OpenAI accepts the system role inline).
  - `stream()` emits `stream: true, stream_options: { include_usage: true }` so the final chunk carries the token usage. Yields per-token deltas and a final `done: true` chunk.
  - `abortSignal` forwarded the same way.

- `backend/src/modules/juvi/finance-agent/pii.ts` — masker + unmasker.
  - `maskPII(input): { masked, tokenMap }` — deep traversal of objects and arrays. Preserves nulls, empty strings, numbers, booleans, and any field not in the AC mask list.
  - Per-field categories: top-level `phone | email | address | aadhaar | pan | dob`; nested under `guardian.*` parent → `guardian_name | guardian_phone | guardian_email`. Tokens follow `{<category>_<ordinal>}`.
  - Same value reused → same token (per-call dedup map). Ordinals reset per call.
  - `unmaskText(text, tokenMap): string` — replaces every `{token}` literal with its mapped value. Unknown tokens are left literal and a `[llm:pii-warn] unknown_token=<name>` is logged via `console.warn` (one log per unique token, not per occurrence — keeps log volume bounded).

- `backend/src/modules/juvi/finance-agent/__tests__/llm-client.test.ts` — 21 tests (provider abstraction + adapters + streaming + abort).
- `backend/src/modules/juvi/finance-agent/__tests__/pii.test.ts` — 14 tests (masker + unmasker + edges + perf budget).

### Modified

- `backend/package.json` — added `@anthropic-ai/sdk@^0.30.0` (resolved 0.30.1) and `openai@^4.60.0` (resolved 4.104.0). Both via `npm install -w backend` so the workspace lockfile updates atomically.
- `package-lock.json` — auto-updated by npm.
- `.captain/specs/fee-analytics-ai-native/tasks.md` — Task A1 status moved `Ready → Red → Refactored` per captain contract.

## Test Results

- **Focused (`npm test -w backend -- llm-client pii`):** 35 tests, **35 passing.** Two test files, full coverage of the AC list.
- **Full backend suite (`npm test -w backend`):** **648 of 648 individual tests passing across 57 test files.** Re-ran 3× to confirm — observed one transient timeout on `service-aggregates-and-bounce.test.ts > getReconciliationStatus` under heavy parallelism, which passes deterministically when run in isolation. Pre-existing flake, not introduced by A1.
- **TypeScript strict (`npm run typecheck -w backend`):** **0 errors** across the full project. (Earlier in the cycle, A3 RED-state test files were causing `Cannot find module '../forecast'` errors — those resolved when the parallel A3 agent landed its source modules.)

## Spec Coverage (against Task A1 ACs)

**Provider abstraction (10 ACs / 10 covered):**

| # | AC | Test |
|---|---|---|
| 1 | `createLLMClient('claude')` returns claude adapter when ANTHROPIC_API_KEY set | `factory + env switching > returns claude adapter when LLM_PROVIDER=claude and ANTHROPIC_API_KEY set` |
| 2 | `createLLMClient('openai')` returns openai adapter when OPENAI_API_KEY set | `... > returns openai adapter when LLM_PROVIDER=openai and OPENAI_API_KEY set` |
| 3 | Missing API key throws 503 AppError | `... > throws AppError(503) when claude selected but ANTHROPIC_API_KEY missing` (+ openai twin) |
| 4 | `LLM_PROVIDER` env determines default; invalid value falls back to claude | `... > falls back to claude when LLM_PROVIDER is invalid` (+ unset twin) |
| 5 | `LLM_MODEL` env override respected | `claude.complete > per-call opts.model overrides default; LLM_MODEL env overrides default` |
| 6 | `complete()` returns `{ text, inputTokens, outputTokens, model, provider, costInr }` | `claude.complete > returns text + tokens + model + provider + costInr` (+ openai twin) |
| 7 | Cost: claude `in*3/1M*RATE + out*15/1M*RATE` | shared cost helper exercised in both `claude.complete > returns text + tokens...` and `... > LLM_INR_RATE env tweaks costInr` |
| 8 | Cost: openai gpt-4o-mini rates | `openai.complete > returns text + tokens + model + provider + costInr` |
| 9 | `stream()` yields deltas + final chunk with usage | `claude.stream > yields delta chunks then a final chunk with usage` (+ openai twin) |
| 10 | Abort signal cancels in-flight request | `abort signal — claude.complete > passes opts.abortSignal through to the SDK call as opts.signal` + `claude.stream > forwards abort signal + aborting before stream throws` |

**PII masker (15 ACs / 14 covered + 1 edge added):**

| # | AC | Test |
|---|---|---|
| 1 | Masks `phone` at top level | `top-level fields > masks phone at top level + preserves rollNumber/programme/amount/dueDate` |
| 2 | Masks `guardian.phone` at nested level | `nested guardian.* + arrays > masks guardian.phone, guardian.email, guardian.name` |
| 3 | Masks `guardian.email`, `guardian.name` | same test (combined assertions) |
| 4 | Does NOT mask `rollNumber` | `top-level fields > masks phone... preserves rollNumber/programme/amount/dueDate` |
| 5 | Does NOT mask `programme`, `branch`, `batch`, `amount`, `dueDate` | `top-level fields > does NOT mask rollNumber, programme, branch, batch, escalationStage, amount*, *Date, *Id, _id, status, role` (sweeps 14 fields) |
| 6 | Array of students: each PII masked, ordinals increment | `nested guardian.* + arrays > handles array of students; ordinals increment across the array` |
| 7 | Round-trip: `unmaskText(llmResponse, tokenMap)` restores | `unmaskText > restores all known tokens in a free-form LLM-style sentence` |
| 8 | Unknown token: literal pass-through + warning | `unmaskText > leaves unknown tokens literal + emits [llm:pii-warn] log` |
| 9 | Same value twice → same token | `determinism + edges > reuses the same token for identical values within a single call` |
| 10 | Same input twice in one request: stable ordinals; new request → new ordinals | `determinism + edges > ordinals reset per call — fresh request gets fresh tokens` |
| 11 | Nested arrays handled | `nested guardian.* + arrays > handles deeply nested arrays-in-objects-in-arrays` |
| 12 | Null preserved | `determinism + edges > preserves null values (does not mask null)` |
| 13 | Empty string preserved | `determinism + edges > preserves empty strings (does not mask "")` |
| 14 | `maskPII({})` → `{ masked: {}, tokenMap: {} }` | `determinism + edges > handles empty input cleanly` (+ array variant) |
| 15 | 100-student payload < 50ms | `determinism + edges > handles a 100-student payload in under 50ms` |

Plus: `top-level fields > masks email at top level` and `> masks address, aadhaar, pan, dob at top level` cover the rest of the AC mask field list.

**Total: 35 tests, 25+ target met (and exceeded).**

## Red-Green-Refactor trace

- **RED:** Wrote `llm-client.test.ts` (21 tests) and `pii.test.ts` (14 tests) first. Confirmed RED via focused run: `Cannot find module '../llm-client'` and `'../pii'` — 18 LLM tests collected & failed (PII suite failed to load entirely as expected for unfound module).
- **GREEN (round 1):** Created `llm-client.ts`, `claude-adapter.ts`, `openai-adapter.ts`, `pii.ts`. Re-ran focused tests: 20/35 pass, 15 fail. Cause: SDK default-export mocks were declared as functions returning POJOs, not constructable classes — adapters call `new Anthropic(...)` / `new OpenAI(...)`, which threw `not a constructor`.
- **GREEN (round 2):** Updated test mocks to return ES classes (`class MockAnthropic { messages = { create: anthropicCreateMock } }` etc.). Re-ran: **35/35 passing.**
- **REFACTOR:** The shared cost helper (`computeCostInr` in `llm-client.ts`) is consumed by both adapters — single call site for the per-million-token-rate × INR conversion. Verified neither adapter computes cost inline. Removed the dead `_CLAUDE_DEFAULT_MODEL` import alias from `claude-adapter.ts` (leftover from an earlier draft) and the unused `MASKED_FIELDS` set in `pii.ts`. Re-ran focused tests: 35/35 still passing.
- **VERIFY:** `npm run typecheck -w backend` → **0 errors.** `npm test -w backend` → **648/648.** Final.

## Spec Gaps / Notes

1. **SDK API drift — none observed.** Anthropic SDK 0.30.1 (matches `^0.30.0`) and OpenAI SDK 4.104.0 (within `^4.60.0`) both exposed the documented surface. The Anthropic `Model` type alias `(string & {}) | <hardcoded list>` does not literally include `'claude-sonnet-4-5'`, but the alias accepts arbitrary strings — the model name is passed through to the API verbatim. If a future SDK release tightens this to a closed union, cast through `unknown` (already done in `claude-adapter.ts`).
2. **Streaming usage on OpenAI.** OpenAI omits `usage` on streaming responses unless `stream_options: { include_usage: true }` is set. Set it. Documented inline in `openai-adapter.ts`. The Anthropic stream surfaces input tokens on `message_start` and the final cumulative output tokens on `message_delta` — no extra opt-in needed.
3. **PII tokens for top-level `name`.** Spec AC lists `guardian.name` as masked but does NOT list a top-level `name`. The masker honors this: top-level `name` passes through unchanged. If A4 finds it needs to mask student names at the top level (Indian college rollNumber + name often pair on screen), update the `MASK_RULES` table in `pii.ts`.
4. **Unknown-token warning rate.** `unmaskText` logs `[llm:pii-warn]` once per unique unknown token per call, not once per occurrence — bounded log volume even if a hallucinated token shows up 10 times. Trade-off: a single unique unknown only emits one log line. Acceptable since A4's audit log will capture the full `maskedResponse` separately.
5. **`durationMs` precision.** Both adapters use `Date.now()` deltas — millisecond resolution. For sub-ms calls (mock-driven tests), the value can be `0`. The assertion uses `>= 0` rather than `> 0` to keep tests deterministic.
6. **Abort during stream — partial-text emission.** When `abortSignal.aborted` fires mid-stream, the SDK throws an `AbortError` from the iterator. The adapter does not yield a `done: true` final chunk in that case — the consumer sees the exception. This matches A4's expectation that aborts unwind the orchestrator (no half-final result).
7. **Cost computation precision.** Rounded to 4 decimal places per spec. Exact arithmetic: `costInr = ((inTok * inputUSD + outTok * outputUSD) / 1_000_000) * INR_RATE`. Tests assert exact equality — any future precision changes (e.g. moving to 6 decimals) will fail tests deliberately.
8. **`LLM_RATE_LIMIT_PER_MINUTE` and `LLM_COST_TRACKING` env vars** mentioned in the spec dependency list are NOT consumed by the LLM client itself. They belong to A5 (rate-limit middleware) and A4 (audit log persistence). No-op for A1.

## Violations

None observed. All edits respect:
- **Multi-tenancy:** N/A at this layer per task brief — college-scoping happens in A4. Documented in the file headers.
- **TypeScript strict:** No bare `any`. Where SDK types are dynamic (`raw: any`, `stream: AsyncIterable<any>`), the `any` is contained to the adapter-internal SDK boundary, and ESLint disable comments are scoped to the exact line. The public types from `llm-client.ts` are fully typed (no `any`).
- **AppError shape:** `new AppError(503, 'LLM provider misconfigured: ANTHROPIC_API_KEY missing')` — statusCode FIRST per CLAUDE.md.
- **Env-var pattern:** Only direct `process.env.X` reads (LLM_PROVIDER, LLM_MODEL, LLM_INR_RATE, ANTHROPIC_API_KEY, OPENAI_API_KEY). No new env-loader abstraction.
- **No real network calls in tests.** Both SDKs are mocked at the module level via `vi.mock(...)` with class shims that route to `vi.fn()` instances. Verified by spot-checking: `anthropicCreateMock.mock.calls` and `openaiCreateMock.mock.calls` carry the request bodies.
- **No raw PII in logs.** The `[llm:pii-warn]` log includes only the token name, never the underlying value.
