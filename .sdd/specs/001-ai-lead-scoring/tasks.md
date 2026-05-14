# Task Breakdown — 001-ai-lead-scoring

TDD order. Each task: write failing test → make it pass → typecheck → next.
Tasks are grouped into 5 waves. Each wave ends with `rtk tsc` clean.

Legend: `[BE]` backend, `[FE]` frontend, `[ST]` shared, `[X]` cross-cut.

---

## Wave 1 — Foundations (no business logic yet)

> **GATE 3 corrections applied:** Test runner is **Vitest** (not Jest); commands below use `rtk vitest`. Add `ioredis-mock` to backend devDeps in 1.0. Extend `QueueManager.addJob()` for `jobId` support in 1.0.

| # | Task | File(s) | Test first |
|---|---|---|---|
| 1.0 | [ST] Prereqs: add `ioredis-mock` to `backend/package.json` devDeps; extend `QueueManager.addJob(opts: { ..., jobId?: string })` to forward to BullMQ | `backend/package.json`, `shared/queue/QueueManager.ts` | NEW `shared/queue/__tests__/QueueManager.test.ts` (or extend) — passing `jobId` deduplicates within the queue |
| 1.1 | [ST] Extend `AuditAction` union | `shared/types.ts` | TS compile of audit.ts referencing the new action |
| 1.2 | [ST] Add `'ai_score_computed'` to `AUDIT_ACTIONS` array | `shared/audit.ts` | n/a (data) |
| 1.3 | [ST] Move PII masker to shared location | NEW `shared/llm/pii.ts`, delete `juvi/finance-agent/pii.ts`, update `juvi/finance-agent/service.ts` and `__tests__/pii.test.ts` imports | NEW `shared/llm/__tests__/pii.test.ts` — phone/email/aadhaar masking with `{category_ordinal}` token format; `unmaskText` round-trip |
| 1.4 | [BE] Add `scoreRationale` + `lastScoredAt` to Inquiry schema + interface | `models/admissions/Inquiry.ts` | NEW (or extend) `models/admissions/__tests__/Inquiry.test.ts` — assertion that new fields persist and read back |
| 1.5 | [BE] Add 3 compound indexes on Inquiry | `models/admissions/Inquiry.ts` | n/a |
| 1.6 | [BE] Create `LeadScoringStats` model | NEW `models/admissions/LeadScoringStats.ts`, register in `models/index.ts` | NEW `models/admissions/__tests__/LeadScoringStats.test.ts` — multi-tenant scoping, unique compound idx |
| 1.7 | Wave-1 gate | `rtk tsc` clean across both workspaces; `rtk vitest backend` covers shared+models+queue green; finance-agent tests still pass | — |

## Wave 2 — Pure scoring functions (deterministic, side-effect-free)

| # | Task | File(s) | Test first |
|---|---|---|---|
| 2.1 | [BE] **Rewrite** `deriveLeadGrade` with 4-grade thresholds (GATE 3 B-1) | NEW `modules/admissions/lead-scoring/grade.ts`; delete the old 3-grade function in `workflow.handlers.ts:2654` and replace with import from new location | NEW `lead-scoring/__tests__/grade.test.ts` — exact boundaries: <40→dormant, 40–59→cold, 60–79→warm, ≥80→hot; cover edge values 0, 39, 40, 59, 60, 79, 80, 100; undefined input → undefined |
| 2.2 | [BE] Implement `computeRuleScore` | NEW `lead-scoring/rule-scorer.ts` | NEW `lead-scoring/__tests__/rule-scorer.test.ts` — source quality, academic fit, interaction recency, negative-outcome floor, clamp to 0–100 |
| 2.3 | [BE] Implement `blend()` | NEW `lead-scoring/blender.ts` | NEW `lead-scoring/__tests__/blender.test.ts` — 0.6/0.4 math, llmScore=null fallback, clamp |
| 2.4 | [BE] Build LLM scoring prompt | NEW `lead-scoring/prompt.ts` | NEW `lead-scoring/__tests__/prompt.test.ts` — masked phone/email present in user message; JSON-schema instruction present; modelVersion encoded |
| 2.5 | Wave-2 gate | `rtk tsc` + `rtk jest` for lead-scoring/__tests__ green | — |

## Wave 3 — Stateful pieces (Redis cap, LLM scorer wrapper, debounce)

| # | Task | File(s) | Test first |
|---|---|---|---|
| 3.1 | [BE] Cap-guard with atomic Redis INCR + rollback | NEW `lead-scoring/cap-guard.ts` | NEW `lead-scoring/__tests__/cap-guard.test.ts` — first call sets TTL, exceeded call rolls back counter, TTL not reset on later calls (ioredis-mock) |
| 3.2 | [BE] LLM scorer with 12s AbortController + JSON parse fallback | NEW `lead-scoring/llm-scorer.ts` | NEW `lead-scoring/__tests__/llm-scorer.test.ts` — happy path parses, malformed JSON returns null, abort yields null |
| 3.3 | [BE] `scoreInquiry()` orchestration service | NEW `lead-scoring/service.ts` | NEW `lead-scoring/__tests__/service.integration.test.ts` — full flow with mongodb-memory-server + mock LLM: enqueue not yet; just direct call with a saved Inquiry. Asserts: scoreRationale written, lastScoredAt set, audit log emitted, stats incremented, debounce no-op on 2nd call within 60s |
| 3.4 | [BE] AssignmentRule refactor (`applyAssignmentRulesOnCreate` → `applyAssignmentRules`) | `modules/admissions/service.ts` (keep OnCreate wrapper) | Extend existing service tests if any; otherwise NEW `__tests__/assignment-rules.test.ts` covers re-eval-after-score case |
| 3.5 | Wave-3 gate | `rtk tsc` + targeted `rtk jest` green | — |

## Wave 4 — Queue + HTTP

| # | Task | File(s) | Test first |
|---|---|---|---|
| 4.1 | [BE] Enqueue helper with composite jobId | NEW `lead-scoring/enqueue.ts` | NEW `__tests__/enqueue.test.ts` — same `(collegeId, inquiryId, minute)` produces same jobId; payload carries `performedBy` |
| 4.2 | [BE] Worker registration + processor | NEW `lead-scoring/worker.ts` (calls `registerQueue` at module-load); add side-effect `import './modules/admissions/lead-scoring/worker'` to `backend/src/app.ts` (GATE 3 B-3) | Integration test: bullmq queue in test mode receives a job, processor invokes scoreInquiry, asserts side effects |
| 4.3 | [BE] Wire `createInquiry` to enqueue on success | `modules/admissions/service.ts` | Extend `createInquiry` test (or write one) — confirms enqueue called with right payload |
| 4.4 | [BE] Wire interaction creation to enqueue on positive outcome | `workflow.service.ts` — this is where `LeadInteraction.create()` runs (GATE 3 M-3 confirmed) | Test: positive outcome enqueues; negative outcome doesn't |
| 4.5 | [BE] Update W01 `lead_score` workflow handler to call new scorer | `modules/admissions/workflow.handlers.ts` | Extend `workflow.handlers.test.ts` (or write) — handler invokes scoreInquiry, returns the rationale |
| 4.6 | [BE] Zod schemas | `modules/admissions/validation.ts` | NEW `__tests__/validation.test.ts` slices for the 4 new schemas |
| 4.7 | [BE] Routes + controller for 4 endpoints | `routes.ts`, `controller.ts` | Supertest-style smoke test per route: 202 paths, 404, 400, 403, 208 duplicate |
| 4.8 | Wave-4 gate | `rtk tsc` + full `rtk jest` backend green | — |

## Wave 5 — Frontend

| # | Task | File(s) | Test first |
|---|---|---|---|
| 5.1 | [FE] Service additions | `admin-portal/src/services/admissions.ts` | n/a (thin axios wrappers) |
| 5.2 | [FE] `LeadGradeBadge` component | NEW `components/admissions/LeadGradeBadge.tsx` | NEW `__tests__/LeadGradeBadge.test.tsx` — color + label per grade |
| 5.3 | [FE] InquiriesPage: score column + sort + grade filter | `pages/admissions/InquiriesPage.tsx` | Manual smoke: dev server, load /admissions, see badges |
| 5.4 | [FE] Inquiry detail: rationale card + Recompute button | `pages/admissions/InquiriesPage.tsx` (or detail modal) | Manual smoke: open detail, see factor list; click Recompute, see toast + score refresh |
| 5.5 | [FE] CRM dashboard: Lead Scoring stats card + cap-reached banner | `pages/admissions/CRMDashboardPage.tsx` | Manual smoke |
| 5.6 | Wave-5 gate | `rtk tsc` (admin-portal) + dev server runs + golden path verified in browser | — |

## Wave 6 — Finalize

| # | Task |
|---|---|
| 6.1 | Run full `rtk tsc` both workspaces |
| 6.2 | Run full `rtk vitest` — backend + frontend |
| 6.3 | Hand-test in browser: create inquiry → see job processed within ~5s → score badge appears → click Recompute → score refreshes |
| 6.4 | _(OpenWolf removed from project — no `.wolf/` doc updates needed.)_ |
| 6.5 | Stage commits in logical wave-sized chunks; do NOT push without explicit go-ahead |

## Dependency graph (which task blocks which)

```
1.1, 1.2 → (audit calls anywhere)
1.3 → 2.4 (prompt needs maskPII)
1.4, 1.5 → 3.3 (service writes to Inquiry)
1.6 → 3.3 (service writes stats)
2.1 → 2.3, 3.3 (blender + service use deriveLeadGrade)
2.2, 2.3, 2.4 → 3.3 (service orchestrates them)
3.1 → 3.3 (service consults cap-guard)
3.2 → 3.3 (service calls LLM scorer)
3.3 → 3.4 → 4.2, 4.3, 4.4, 4.5 (worker + integration points wrap service)
4.1, 4.2 → 4.3, 4.4 (enqueue used by triggers)
4.6, 4.7 → 4.8 (routes need validation)
Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6
```

## Estimated complexity

- Wave 1: ~1.5h (mechanical schema work, but all tests must pass)
- Wave 2: ~2h (pure functions, easy to TDD)
- Wave 3: ~3h (Redis + LLM + orchestration is where bugs hide)
- Wave 4: ~2.5h (queue plumbing + 4 routes + W01 handler update)
- Wave 5: ~2.5h (UI polish, manual verification)
- Wave 6: ~1h (typecheck, tests, docs)

**Total estimate: 12–14h of focused work.** Risk surface concentrates in Wave 3.
