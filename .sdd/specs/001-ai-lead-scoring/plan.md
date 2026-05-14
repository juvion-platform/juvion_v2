# Implementation Plan — 001-ai-lead-scoring

**Source spec:** `.sdd/specs/001-ai-lead-scoring/spec.md` (post-GATE 2)
**Target branch:** `feat/ai-lead-scoring` (cut from `main`)
**Owner module:** M01 Admissions (with one cross-cut to shared and one trivial change in juvi/finance-agent)

## Architecture in one picture

```
POST /api/admissions/inquiries           POST /api/admissions/inquiries/:id/interactions
       │                                          │
       ▼                                          ▼
createInquiry() ─ enqueue ─┐         createLeadInteraction() ─ enqueue (if positive outcome) ─┐
                            │                                                                 │
POST /api/admissions/inquiries/:id/rescore ─ enqueue (auth check) ─┐                          │
POST /api/admissions/lead-scoring/batch ─ enqueue N (cap-aware) ───┤                          │
                                                                    ▼                         ▼
                                                      BullMQ queue: admissions:lead-scoring
                                                                    │
                                                                    ▼
                                                       lead-scoring-worker (concurrency 3)
                                                       │  1. Debounce check (lastScoredAt < 60s → no-op)
                                                       │  2. Load inquiry + recent interactions
                                                       │  3. ruleScore = computeRuleScore(...)
                                                       │  4. Redis INCR daily LLM counter
                                                       │  5. If under cap: llmScore via Juvi LLM (12s abort)
                                                       │     Else: llmSkipped, blend = ruleScore
                                                       │  6. blendedScore = 0.6*rule + 0.4*llm
                                                       │  7. leadGrade = deriveLeadGrade(blendedScore)
                                                       │  8. Update Inquiry (score, grade, rationale, lastScoredAt)
                                                       │  9. createAuditLog('ai_score_computed')
                                                       │ 10. applyAssignmentRules(inquiry)  ← post-write
                                                       │ 11. Increment LeadScoringStats daily bucket
                                                       ▼
                                              Inquiry doc updated; UI polls and renders badge.
```

## File-by-file changes

### A. Shared infrastructure (touch first — blocks everything downstream)

| File | Change |
|---|---|
| `backend/src/shared/types.ts` | Add `'ai_score_computed'` to `AuditAction` union |
| `backend/src/shared/audit.ts` | Add `'ai_score_computed'` to `AUDIT_ACTIONS` array |
| `backend/src/shared/llm/pii.ts` | **NEW** — Moved from `backend/src/modules/juvi/finance-agent/pii.ts`. Export `maskPII(obj)` and `unmaskText(text, tokenMap)` (note: existing name is `unmaskText`, not `unmaskPII`). Token format `{category_ordinal}` (e.g. `{email_1}`) — preserve exactly. |
| `backend/src/modules/juvi/finance-agent/pii.ts` | **DELETE** + update `juvi/finance-agent/service.ts` and `__tests__/pii.test.ts` to import from `shared/llm/pii` |
| `backend/src/shared/queue/QueueManager.ts` | **GATE 3 B-2:** Extend `addJob()` opts to include `jobId?: string`; forward to BullMQ's native `jobId` dedup. ~5-line change. |
| `backend/package.json` | **GATE 3 M-2:** Add `ioredis-mock` to devDependencies (for cap-guard tests) |

### B. Data layer

| File | Change |
|---|---|
| `backend/src/models/admissions/Inquiry.ts` | Add `scoreRationale` (typed subdoc) + `lastScoredAt` to interface and schema. Add 3 indexes: `{collegeId:1, leadScore:-1}`, `{collegeId:1, leadGrade:1, leadScore:-1}`, `{collegeId:1, lastScoredAt:-1}`. Export `ScoreRationale` type. |
| `backend/src/models/admissions/LeadScoringStats.ts` | **NEW** — daily aggregation model per spec §10.3. Unique compound index `{collegeId:1, date:-1}`. |
| `backend/src/models/index.ts` | Re-export `LeadScoringStats` |

### C. Scoring engine (admissions module)

Create directory `backend/src/modules/admissions/lead-scoring/`:

| File | Responsibility |
|---|---|
| `grade.ts` | **GATE 3 B-1:** Re-home AND extend `deriveLeadGrade`. Current 3-grade helper (≥80 hot, ≥50 warm, else cold) does NOT produce 'dormant' despite the Inquiry enum supporting it. New 4-grade thresholds matching spec §3: `≥80 hot, ≥60 warm, ≥40 cold, else dormant`. **Behavior change:** scores 50–59 were 'warm' under old logic, become 'cold' under new; scores 0–39 were 'cold', become 'dormant'. W01 callers see new grades for new inquiries — acceptable since W01 expected scoring to produce semantically meaningful grades. Old function deleted from workflow.handlers.ts; replaced by `import { deriveLeadGrade } from './lead-scoring/grade'`. |
| `rule-scorer.ts` | `computeRuleScore(inquiry, recentInteractions): { score: number, factors: Factor[] }`. Pure function, deterministic. |
| `prompt.ts` | `buildLeadScoringPrompt({ maskedInquiry, maskedInteractions })`: returns `LLMMessage[]` per the system/user pattern. Includes the JSON-schema instruction (`{score, factors[], summary}`). |
| `llm-scorer.ts` | `computeLLMScore(maskedContext, abortSignal): Promise<{score, factors, costInr} \| null>`. Calls Juvi `llmClient.complete`, parses JSON, falls back to null on parse error. |
| `blender.ts` | `blend({ ruleScore, llmScore }): { blendedScore, factors }`. 0.6/0.4 weights, clamps 0–100. |
| `cap-guard.ts` | `tryClaimLLMSlot(collegeId): Promise<boolean>` — Redis `INCR` + `EXPIRE` + rollback pattern. |
| `service.ts` | `scoreInquiry(collegeId, inquiryId, performedBy, opts)`. Orchestrates: debounce → rule → cap → LLM (with abort) → blend → write → audit → assignment-rule re-eval → stats increment. Returns the updated Inquiry. |
| `worker.ts` | `registerLeadScoringWorker()`. Calls `QueueManager.registerQueue` with concurrency 3, processor that calls `scoreInquiry`. |
| `enqueue.ts` | `enqueueScoring({ inquiryId, collegeId, performedBy, trigger })` — uses composite `jobId` per §10.6. |

### D. Module wiring

| File | Change |
|---|---|
| `backend/src/app.ts` | **GATE 3 B-3:** Add side-effect import `import './modules/admissions/lead-scoring/worker'` alongside existing handler imports. The worker module calls `registerQueue` at load time — no explicit init function. |
| `backend/src/modules/admissions/service.ts` | `createInquiry()` calls `enqueueScoring(..., 'create')` after the doc + applyAssignmentRulesOnCreate. Refactor `applyAssignmentRulesOnCreate(collegeId, inquiryPayload)` (current signature returns `Promise<IAssignmentRule \| null>`) → `applyAssignmentRules(collegeId, inquiry)` (same logic, callable from worker post-score). Keep `applyAssignmentRulesOnCreate` as a thin wrapper preserving the original signature. |
| `backend/src/modules/admissions/workflow.service.ts` | **GATE 3 M-3:** This is where `LeadInteraction.create()` happens (NOT `intake-service.ts`). After a positive-outcome interaction is created, call `enqueueScoring(..., 'interaction')`. |
| `backend/src/modules/admissions/routes.ts` | Add 4 routes (rescore, batch, batch-status, stats) with `authenticate` + `authorize` + `validate` |
| `backend/src/modules/admissions/controller.ts` | Add 4 controller handlers — thin, delegate to scoring service |
| `backend/src/modules/admissions/validation.ts` | Zod schemas: `rescoreSchema`, `batchScoreSchema`, `batchStatusSchema`, `statsQuerySchema` |
| `backend/src/modules/admissions/workflow.handlers.ts` | Update `'lead_score'` step to call `scoreInquiry` internally instead of expecting an external `result.leadScore`. The W01 handler becomes a thin wrapper around the new scorer. |

### E. Frontend

| File | Change |
|---|---|
| `admin-portal/src/services/admissions.ts` | Add `rescoreInquiry(id)`, `batchScore(filter)`, `getBatchStatus(batchId)`, `getLeadScoringStats(range)` |
| `admin-portal/src/components/admissions/LeadGradeBadge.tsx` | **NEW** — colored badge (`hot`=red, `warm`=orange, `cold`=gray, `dormant`=slate) + score number |
| `admin-portal/src/pages/admissions/InquiriesPage.tsx` | Add score+grade column. Add sort-by-score (desc default). Add grade filter chip ("Hot only", "Warm+Hot", "All"). |
| `admin-portal/src/pages/admissions/InquiryDetailModal.tsx` (or inline in InquiriesPage if no separate modal) | Render rationale card: blended/rule/llm scores, top factors with weights, "Recompute" button (visible if user role allows). |
| `admin-portal/src/pages/admissions/CRMDashboardPage.tsx` | Add "Lead Scoring" stats card: total scored today, LLM vs rules ratio, daily cost, cap warning banner. |

### F. Tests (paired with each file as it lands — TDD)

| File | Coverage |
|---|---|
| `backend/src/modules/admissions/lead-scoring/__tests__/rule-scorer.test.ts` | Source quality, academic fit, interaction recency math, negative-outcome floor, clamp to 0–100 |
| `backend/src/modules/admissions/lead-scoring/__tests__/blender.test.ts` | Blend math, clamp, llmScore=null path |
| `backend/src/modules/admissions/lead-scoring/__tests__/prompt.test.ts` | Prompt includes masked phone/email (token format), JSON schema instruction, modelVersion baked in |
| `backend/src/modules/admissions/lead-scoring/__tests__/cap-guard.test.ts` | Atomic INCR; rollback on miss; TTL set on first call only (mock ioredis) |
| `backend/src/modules/admissions/lead-scoring/__tests__/service.integration.test.ts` | End-to-end: enqueue → worker processes → Inquiry updated → audit log emitted → stats incremented (in-memory mongo + mock LLM) |
| `backend/src/shared/llm/__tests__/pii.test.ts` | Phone/email/aadhaar tokenized; unmask round-trip works |
| `admin-portal/src/__tests__/LeadGradeBadge.test.tsx` | Renders correct color per grade |

## Risks introduced by this plan

| Risk | Mitigation |
|---|---|
| Moving `finance-agent/pii.ts` could break finance-agent at runtime | Update all imports (`finance-agent/service.ts`, `finance-agent/__tests__/pii.test.ts`) in the same commit as the move; run `rtk tsc` + `rtk vitest` (note: Vitest, not Jest — GATE 3 M-1) before next commit |
| `applyAssignmentRulesOnCreate` rename ripples | Keep old export as a wrapper for one release |
| W01 workflow handler change breaks existing instances | The new handler does what the old one did + more; no breaking change to call sites |
| `deriveLeadGrade` threshold change shifts existing inquiries | Acknowledged behavior change (B-1). Existing inquiries keep their stored `leadGrade` until rescored; only newly-scored inquiries see the new mapping. Backfill plan (§10.13) handles the transition. |
| Worker registration timing (must run before first job is enqueued) | `worker.ts` calls `registerQueue` at module-load via side-effect import in `app.ts` — fires before the HTTP server starts listening |
| `QueueManager.addJob` needs `jobId` support | Wave 1, Task 1.0 extends the signature; ~5-line change |

## Out-of-scope deferrals (logged for future PRs)

- Migration script for existing inquiries (runbook only, not a code change in this branch)
- Per-college prompt-template UI
- Score-tuning slider for admins
- Placement (M07) scoring
