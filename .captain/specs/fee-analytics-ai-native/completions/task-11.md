# Completion: Task A11 — API docs + QA checklist (fee-analytics-ai-native)

**Feature:** fee-analytics-ai-native
**Completed:** 2026-04-22
**Person:** srinikandula
**Final Status:** Done

## Files Created

- `backend/docs/api/fee-analytics-ai-native.md` — API reference for the AI-native finance agent. Sections: Overview, Concepts (LLM provider abstraction, PII masking, HITL discipline, audit + reversibility, graceful degradation), Architecture diagram (ASCII), Data model additions (3 new collections + 4 indexes documented), Streaming protocol (SSE), Provider abstraction (table of provider→model→cost-per-1M-token), PII masking field catalog (masked vs not-masked), Endpoints (7 endpoints with method/path/permission/Zod schema/example request/example response/errors), Error codes table, Rate limits, RBAC mapping, Fallback behavior matrix per feature × LLM-up / timeout / misconfigured / Mongo-down, Cost tracking, Known deviations from plan (16 items pulled from spec changelog + A1-A10 completion signals), Open questions (6 spec OQs + 4 plan OQ-Ps with resolutions noted).

- `backend/docs/api/fee-analytics-ai-native-qa-checklist.md` — deploy checklist. Sections: §0 Prerequisites, §1 Environment configuration, §2 Schema + indexes, §3 Provider verification (Claude + OpenAI), §4 PII masking spot-check (security gate), §5 Streaming verification, §6 Cost tracking, §7 Fallback tests (4 degraded states), §8 Smoke tests (5 manual flows), §9 Rollback plan (disable LLM + drop collections + revert PRs), §10 Known limitations (15 items), §11 Post-deploy monitoring (2-week window with concrete query targets), §12 Sign-off (Finance Lead · SRE · Security · Product · Principal). Every line is a verifiable boolean — copy-pasteable command or explicit assertion.

## Files Modified

- `.captain/specs/fee-analytics-ai-native/tasks.md` — Task A11 status moved `Pending → Done`.

## Verification

- API reference cross-checked against actual `routes.ts` + `validation.ts` + `controller.ts` + `service.ts`. All 7 endpoint paths, permissions, request body shapes, and response shapes documented match the shipped code.
- Endpoint path documented as `/situations/:fingerprint/dismiss` (matches the actual route, not the older `/situations/:id/dismiss` from the spec text).
- Pricing table reflects the constants in `llm-client.ts` `PRICING_USD_PER_MILLION` (Claude $3/$15, OpenAI $0.15/$0.60).
- All 16 deviations from plan trace back to specific completion signals (A1-A10) — each item is a documented spec gap from those tasks.
- All 4 indexes from plan §2.2 documented per-collection.
- Fallback behavior matrix mirrors the per-method behaviour in `service.ts` (graceful degradation paths).

## Spec Coverage

This task is documentation-only — no test target. Coverage is verified by reading the API reference and confirming:

| Doc section | Source code reference |
|---|---|
| LLM provider abstraction | `llm-client.ts` `createLLMClient`, `PRICING_USD_PER_MILLION`, `resolveModel` |
| PII masking field catalog | `pii.ts` `MASK_RULES`, `GUARDIAN_FIELD_RULES` |
| Streaming protocol | `controller.ts` `chatHandler` SSE headers + event format |
| 7 endpoints (request/response shapes) | `routes.ts`, `validation.ts`, `controller.ts`, `service.ts` |
| Data model additions | `models/juvi/AgentConversation.ts`, `AgentAction.ts`, `SituationDismissal.ts` |
| Cross-college guard | `controller.ts` `assertStudentsInCollege` |
| Audit log shape (masked) | `service.ts` `logAgentAction`, `AgentAction.ts` |
| Cost computation | `llm-client.ts` `computeCostInr` |
| Fallback per feature | `service.ts` `handleForecastNarrative` (try/catch → narrative=null), `handleSituations` (Zod retry + empty array), `handleReminderDrafts` (deterministic template), `handleChat` (SSE error) |

## Mismatches caught between spec/plan and actual code

These are documented as **Known deviations from plan** in the API reference (and as **Known limitations** in the QA checklist):

1. **Endpoint path is `/situations/:fingerprint/dismiss`**, not `/situations/:id/dismiss` as the spec wording uses. Real fingerprint is the SHA-256 hex from `/situations` response, not a Mongo ObjectId.

2. **No per-call `[llm]` log line emitted.** Plan §5 spec'd `[llm] provider=X model=Y in=N out=M ms=K costInr=Z` per call; only `[llm:json-fail]` and `[llm:pii-warn]` are emitted by the shipped code. Cost is captured in `AgentAction.costInr` instead. The QA checklist explicitly directs §6 verification to the audit collection, not log greps.

3. **Single shared 60/min/user rate-limit** across all endpoints (deviates from plan §1.9 per-endpoint table). Captured in A5 completion §3 and surfaces as a known limitation.

4. **No `/reminder-drafts/skip` endpoint.** A10 implements skip as client-state-only. Documented as a deferred audit gap.

5. **Recall window (5 min) is informational only** — no `[Recall]` button shipped; A10 surfaces it in a toast text. Documented as deferred.

6. **`AgentAction.userId` for forecast/risk/reminder-draft batches uses collegeId as a placeholder** because those endpoints have no per-user invocation. Captured in A4 completion §1, §2.

7. **`handleApproveDrafts.dueAmount = 0`** because the agent flow doesn't carry an invoice-level amount. Captured in A4 completion §6.

8. **All approved drafts route to `platform:sms`** for v1 (deviates from spec's "respect guardian.communicationPreference"). Captured in A4 completion §5.

9. **Top-level `name` NOT masked** — only `guardian.name`. Spec AC was literally interpreted; A1 completion §3 flagged for future review.

10. **Chat user prompt NOT masked; only context is.** A4 completion §9 — Officer "owns their phrasing".

## Files

- Created (2): `backend/docs/api/fee-analytics-ai-native.md`, `backend/docs/api/fee-analytics-ai-native-qa-checklist.md`
- Modified (1): `.captain/specs/fee-analytics-ai-native/tasks.md` (Task A11 status: Pending → Done)
- Created (1 doc): `.captain/specs/fee-analytics-ai-native/completions/task-11.md`
