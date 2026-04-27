# Completion: Task A5 — HTTP API for finance-agent (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Refactored (ready for captain-spec verification → Done)

## Files Changed

### Created (3 production files)

- `backend/src/modules/juvi/finance-agent/validation.ts` — 7 Zod schemas (one per endpoint).
  - `chatQuerySchema` — `prompt` (1..2000), optional uuid `conversationId`, optional `context.filters` + `visibleDefaulterIds[<=50]`.
  - `forecastNarrativeSchema` — `monthAnchor` (z.coerce.date).
  - `riskScoresSchema` — `studentIds[1..100]` + optional `includeNarrative`.
  - `situationsSchema` — `z.object({}).strict()` so any extra body field 400s.
  - `reminderDraftsSchema` — `studentIds[1..50]`.
  - `approveDraftsSchema` — `drafts[1..50]` of `{ studentId, subject>=1, body>=1 }`.
  - `dismissSituationSchema` — `snoozeDays: z.union([z.literal(1|3|7|30)])` + `reason: z.string().max(500)`.

- `backend/src/modules/juvi/finance-agent/controller.ts` — 7 thin handlers delegating to the A4 orchestrator.
  - `chatHandler` — full SSE pipeline. Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`. Calls `res.flushHeaders()` BEFORE the first write. Wires `req.on('close')` to an `AbortController` so the upstream LLM call is cancelled on client disconnect. Per-chunk emission: `event: delta\ndata: {...}\n\n` for each delta, `event: done\ndata: {...}` for the final, `event: error\ndata: {message}` on stream errors. Always ends with `res.end()`.
  - `forecastNarrativeHandler` — POSTs `monthAnchor` to `service.handleForecastNarrative`.
  - `riskScoresHandler` — runs cross-college student-id assertion BEFORE delegating, so a 403 fires before any service work.
  - `situationsHandler` — pulls `userId` from auth and delegates.
  - `reminderDraftsHandler` — also runs cross-college guard; defence-in-depth ahead of the orchestrator's own check inside `handleApproveDrafts`.
  - `approveDraftsHandler` — same cross-college guard (extra layer) + delegates.
  - `dismissSituationHandler` — pulls `:fingerprint` from `req.params`. Express 5 types params as `string | string[]`; the handler normalises to a string.
  - Shared helper `assertStudentsInCollege(collegeId, studentIds)` — invalid ObjectId, missing student, or wrong-college student → `AppError(403, 'Cross-college student IDs detected')`.
  - Shared helper `getUserId(req)` — reads `req.user.id` (per the auth middleware's contract — NOT `_id`/`userId`).

- `backend/src/modules/juvi/finance-agent/routes.ts` — Express Router with 7 routes. All routes:
  - guarded by `authenticate` (router-level)
  - guarded by per-action `authorize(module, action)` (per plan §1.9 table)
  - guarded by a single shared `feeAgentRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 })`
  - validated by `validate(schema)` middleware
  - delegated to the matching `controller.ts` handler

  | Method | Path                                    | Permission           |
  |--------|-----------------------------------------|----------------------|
  | POST   | /query                                  | ('juvi','read')      |
  | POST   | /forecast-narrative                     | ('finance','read')   |
  | POST   | /risk-scores                            | ('finance','read')   |
  | POST   | /situations                             | ('finance','read')   |
  | POST   | /reminder-drafts                        | ('finance','read')   |
  | POST   | /reminder-drafts/approve                | ('finance','update') |
  | POST   | /situations/:fingerprint/dismiss        | ('finance','update') |

### Modified (2 files)

- `backend/src/modules/juvi/routes.ts` — mounts the new sub-router under `/finance-agent`. The mount is declared BEFORE the parent's `router.use(authenticate)` line because the sub-router has its own internal `authenticate` chain (so the legacy CRUD's middleware order isn't disturbed).

- `backend/src/__e2e__/modules/finance-agent-http.e2e.test.ts` — ONE 5-line typing fix in the SSE-buffer helper. The previous agent's `Object.entries(res?.headers ?? {})` triggered TS2339 because the `{}` fallback narrows the entry value to `never`. Replaced with an explicit cast to `Record<string, string | string[] | undefined>`. No behavioural change. Documented under "Spec Gaps" below.

- `.captain/specs/fee-analytics-ai-native/tasks.md` — Task A5 status moved `Pending → Refactored`.

## Test Results

- **Focused (`npm run test:e2e -w backend -- finance-agent-http`):** **36 / 36 passing**, 1 file, ~19s.
  - (The brief mentioned 38 tests; the test file actually has 36 `it()` blocks — minor count discrepancy in the brief that doesn't affect AC coverage.)
- **TypeScript strict (`npm run typecheck -w backend`):** **0 errors** across the full project.
- **Full backend suite (`npm test -w backend`):** **668 / 668 individual tests across 58 test files** — same number as before A5. No regressions.

### Verification log

```
$ npm run test:e2e -w backend -- finance-agent-http
 Test Files  1 passed (1)
      Tests  36 passed (36)
   Duration  18.46s

$ npx tsc --noEmit  (in backend/)
(no errors)

$ npm test -w backend
 Test Files  58 passed (58)
      Tests  668 passed (668)
   Duration  31.77s
```

## Test count per behavior

| Endpoint / cross-cut                          | Tests |
|-----------------------------------------------|------:|
| POST /query (SSE: 200 stream, conversationId, 400 missing prompt, 400 too long, 400 bad uuid, 401)         | 6 |
| POST /forecast-narrative (200 happy, 200 narrative=null on LLM fail, 400 invalid date, 400 missing, 401) | 5 |
| POST /risk-scores (200 no-narrative, 200 with narrative, 400 empty, 400 over-cap, 401, 403 cross-college)  | 6 |
| POST /situations (200 happy, 400 strict extra fields, 401)                                                  | 3 |
| POST /reminder-drafts (200 happy templateVersion, 400 empty, 400 over-cap, 401, 403 cross-college)         | 5 |
| POST /reminder-drafts/approve (200 creates FeeReminder + addJob, 400 empty, 400 missing fields, 401, 403)  | 5 |
| POST /situations/:fingerprint/dismiss (200 upserts, 400 missing snooze, 400 wrong enum, 400 reason >500, 401)| 5 |
| Cross-cutting: per-user 60/min rate-limit smoke (429 with rate_limited shape)                              | 1 |
| **A5 total**                                                                                                | **36** |

(AC required: 20+. Delivered: 36.)

## Spec Coverage (against Task A5 ACs)

| # | Task A5 AC | How proven                                                                                            |
|---|------------|-------------------------------------------------------------------------------------------------------|
| 1 | 7 routes mounted at `/api/juvi/finance-agent/*`                                                           | All 36 e2e tests hit those paths; smoke run shows POSTs in the supertest log lines.                       |
| 2 | All routes guarded by `authenticate` + `authorize()`                                                      | 7 × `401 without auth header` tests pass; 401 for ALL endpoints when no Authorization header.             |
| 3 | Zod validation on body                                                                                    | 14 × `400 ...` tests pass per endpoint (missing fields, over-cap, wrong enum, strict-only).               |
| 4 | Per-user rate-limit                                                                                       | `per-user rate-limit smoke` test fires 65 calls, asserts 429 with `error: rate_limited`. Passes.          |
| 5 | `/query` SSE: text/event-stream, no-cache, X-Accel-Buffering=no                                           | `200 streams delta events followed by a done event with usage` checks all three headers; passes.          |
| 6 | `/query` chunks yield sequentially, final event includes usage                                            | Same test asserts ≥2 delta events + 1 done event with `provider`, `model`, `auditId`, `inputTokens`.      |
| 7 | `/query` abort: client disconnect aborts upstream                                                         | Implemented via `AbortController` wired to `req.on('close')`. Not exercised in e2e but the wire is in place. |
| 8 | `/forecast-narrative`: returns band + narrative; narrative null on LLM fail                               | `200 returns projection + AI narrative` + `200 with narrative=null when LLM fails (degraded path)` pass. |
| 9 | `/risk-scores`: batch, no narrative by default                                                            | `200 returns deterministic scores without narrative by default` passes; assertion `r.narrative === undefined`. |
| 10 | `/situations`: returns LLM-picked situations with id + fingerprint                                        | `200 returns LLM-picked situations with id + fingerprint` passes.                                           |
| 11 | `/reminder-drafts`: returns drafts with `templateVersion: 'agent-draft-v1'`                               | `200 returns drafts with the agent-draft-v1 templateVersion` passes.                                        |
| 12 | `/reminder-drafts/approve`: creates FeeReminder docs + queues dispatch                                    | `200 creates FeeReminder docs with metadata.source=agent-draft-v1` passes; checks DB doc + `addJobMock`.    |
| 13 | `/situations/:id/dismiss`: upserts SituationDismissal with correct snoozedUntil                            | `200 upserts a SituationDismissal with the right snoozedUntil` passes; asserts DB doc, time window.        |
| 14 | Cross-college isolation: passing other college's IDs returns 403                                          | 3 × `403 when a studentId belongs to a different college` tests (risk-scores, reminder-drafts, approve) all pass. |

## Red-Green-Refactor trace

- **RED:** Re-ran the e2e file at task start: 29 failed / 7 passed (the 7 that pass were the no-auth tests that 401 without ever hitting the missing route — Express returns the 401 from the parent juvi router's `authenticate` since the unmounted sub-paths bubble back to the parent). Confirmed RED.
- **GREEN (round 1):** Created `validation.ts`, `controller.ts`, `routes.ts`. Wired the sub-router into `juvi/routes.ts` BEFORE the parent's outer `authenticate` (so the sub-router controls its own middleware order). Re-ran focused e2e: **36 / 36 passing on the first try.** No iteration needed for behavior.
- **REFACTOR:** Two minor type fixes during the typecheck pass:
  1. `req.params.fingerprint` is typed `string | string[]` in Express 5 — normalised to `string` via `Array.isArray(...) ? rawFp[0] : rawFp`.
  2. Test file's SSE-buffer helper had a `Object.entries(res?.headers ?? {})` whose `{}` fallback narrowed entry values to `never` — added an explicit `Record<string, string | string[] | undefined>` cast (5-line change, no behavioural impact). This was a pre-existing typo in the e2e test harness that surfaced once the route existed and the helper was actually exercised.
- **VERIFY:** Three orthogonal verification runs all clean:
  - 36/36 e2e (twice — once just after the controller refactor, once after the test-file typing fix; both times deterministic, no flake).
  - 0 typecheck errors.
  - 668/668 unit suite (no regressions; same count as A4 since A5 has no service-layer logic).

## Spec Gaps / Notes

1. **Brief test count vs. file test count.** The task brief mentions 38 tests; the file has 36 `it()` blocks. All 36 pass. Difference is likely a draft-vs-final count drift in the brief.

2. **One-line test-file typing fix.** The original e2e file had a TS2339 in its `postSse` helper because `Object.entries(res?.headers ?? {})` widens entry values to `never` under strict TS. The fix is a 5-line type cast inside that helper (lines 158–166). No behavioural change. Documented here per the "do not modify the test file unless a clear typo exists" rule. Considered an oversight in the prior agent's harness; necessary to keep `npm run typecheck` clean.

3. **Single shared rate-limit instead of per-endpoint.** Plan §1.9 spec'd different per-endpoint limits (20/min for chat, 60/min for dismiss, 10/min for approve, etc). I shipped one shared `feeAgentRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 })` for simplicity (the brief recommended this). The only test that pins a specific number is the dismiss-endpoint smoke that asserts 429 within 65 calls — 60/min is sufficient. If production traffic shows abuse on a specific endpoint we can tighten that one path with its own factory.

4. **Cross-college guard at the controller level.** Per A4 spec gap #11, `handleRiskScores` did NOT inline a college check (it relied on `assembleFeatures` returning `tier: 'insufficient-data'` for foreign students). Per the brief, A5 is where this becomes a real 403. I added an explicit `assertStudentsInCollege` helper at the controller level for `risk-scores`, `reminder-drafts`, AND `reminder-drafts/approve`. This is defence-in-depth (the orchestrator's `handleApproveDrafts` ALSO checks). Both layers stay; the controller short-circuits earlier (no service work / no FeeReminder creation on a 403). The 3 cross-college 403 tests pass.

5. **`req.user.id` not `req.user._id`.** The brief snippet suggested `String(req.user?._id ?? req.userId ?? '')`, but the auth middleware's `AuthRequest` interface declares `user?: { id: string; ... }` — there is no `_id`. I used `req.user?.id` directly. Documented in `getUserId()` JSDoc.

6. **Mount order in `juvi/routes.ts`.** The new sub-router is mounted BEFORE the parent's `router.use(authenticate)` — because the sub-router has its own `authenticate` chain. If the parent's `authenticate` ran first it would still work, but mounting first keeps the auth + per-action authorize chain on the sub-router self-contained. This way the legacy CRUD continues to use the parent's `authenticate` and the new finance-agent routes use their own (identical) middleware.

7. **`/situations` strict body.** `z.object({}).strict()` 400s on any extra field, which is what the test expects. Note: the LLM-picked situations CALL the orchestrator's `handleSituations`, which still pulls `req.collegeId` from the authenticated request (multi-tenancy guarantee). Body is empty by design.

8. **`fingerprint` not validated as a hex/uuid.** The dismiss endpoint accepts any non-empty string fingerprint; the orchestrator stores it verbatim. Real fingerprints from the `/situations` endpoint are sha256 hex (per service.ts L646), but accepting freeform here keeps the dismiss test's `'fp-test-' + Math.random()` pattern working. If we ever need to lock down the format, a `.regex(/^[a-f0-9]{64}$/)` Zod constraint would do it.

9. **No request-body inspection for SSE error path.** When `service.handleChat` yields `{ type: 'error', error }`, the controller writes an SSE `event: error` AND ends. It does not return a 5xx because headers are already flushed. This matches the SSE convention (errors are stream events, not HTTP statuses) and the test does NOT assert any error-path behaviour beyond auth/validation 400s.

10. **No additional Vite proxy work.** Plan §1.7 + §1.9 OQ-P1 raised concerns about SSE through the Vite dev proxy. That belongs to A6 (frontend wiring). The backend correctly emits SSE; supertest verifies the wire format end-to-end.

## Violations

None observed. All edits respect:
- **Multi-tenancy:** every controller pulls `req.collegeId` from the authenticated request (never from the body); cross-college student IDs are blocked at the controller via `assertStudentsInCollege` AND again at the service layer for approve.
- **TypeScript strict:** zero `any`. The two `as unknown as ...` casts in the validate middleware are pre-existing and shared across the codebase.
- **AppError shape:** `new AppError(403, 'Cross-college student IDs detected')` and `new AppError(401, 'Not authenticated')` — statusCode FIRST per CLAUDE.md.
- **Service layer pattern:** controllers don't reach into Mongo for cross-college checks via custom queries — they use the existing `Student` model with `collegeId` filter (multi-tenant invariant).
- **No raw PII in audit logs:** unchanged from A4 (the controller only delegates).
- **No new dependencies:** all middleware (`authenticate`, `authorize`, `validate`, `createUserRateLimit`) is reused from the existing finance-and-alerts module.
- **Test file changes:** ONE narrow typing fix to address a TS2339 in the prior agent's harness. No assertion changes.

## Files

- Created (3 production files): `validation.ts`, `controller.ts`, `routes.ts` (all under `backend/src/modules/juvi/finance-agent/`).
- Modified: `backend/src/modules/juvi/routes.ts` (mount), `.captain/specs/fee-analytics-ai-native/tasks.md` (status), `backend/src/__e2e__/modules/finance-agent-http.e2e.test.ts` (5-line typing fix).
- No new test files; the e2e file was already authored by the prior agent.
