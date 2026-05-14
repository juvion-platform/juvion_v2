# GATE 2 — Architecture Validation

## Summary
**FAIL** — 4 critical issues block implementation. Schema fields missing; assignment rule re-evaluation is discoverable but spec omits triggering point; debounce tracking field missing; audit action enum needs extension.

## Findings

### CRITICAL

- **[C-1] Missing schema fields on Inquiry model** — Spec §3 requires `scoreRationale` (object with ruleScore, llmScore, blendedScore, factors[], etc.) and §2 Story 2 requires `lastScoredAt` for debounce enforcement (`max 1 rescore per 5 minutes per inquiry`). Neither field exists in `backend/src/models/admissions/Inquiry.ts` (lines 1–192). The Inquiry interface (lines 3–63) and schema (lines 65–180) have `leadScore` and `leadGrade` but no `scoreRationale` or `lastScoredAt`. **Fix:** Add both fields to Inquiry schema before implementation begins. `scoreRationale: { type: Schema.Types.Mixed }` is permissive but risks unvalidated structure; recommend a subdocument schema for type safety (matching the object shape in spec §3).

- **[C-2] Audit action 'ai_score_computed' not in enum** — Spec §2 Story 1 AC#3 requires `createAuditLog` with `action: 'ai_score_computed'`. The audit enum at `backend/src/shared/audit.ts:27–32` lists only CRUD primitives (`create`, `update`, `delete`) and workflow actions (`propose`, `accept`, etc.) — no `ai_score_computed`. **Fix:** Add `'ai_score_computed'` to the `AUDIT_ACTIONS` array in audit.ts and the `AuditAction` union in `shared/types.ts` (reference not shown but inferred from the pattern).

- **[C-3] Spec prescribes assignment rule re-evaluation but omits triggering code** — Spec §2 Story 1 AC#4 states "AssignmentRule re-evaluation runs after scoring so `leadScore`/`leadGrade` conditions apply to the newly scored inquiry." The spec names `applyAssignmentRulesOnCreate()` (discovery.md implies it exists) and it does (service.ts:100–117), but the spec doesn't describe *when* the re-evaluation job runs or *how* it's triggered by the lead-scoring worker. This is a narrative gap, not necessarily code-missing, but it blocks the worker design: is re-evaluation synchronous (scoring job calls it before return) or async (enqueues a follow-up job)? The spec must clarify. **Fix:** Amend spec §2 Story 1 AC#4 to specify: (a) re-evaluation is enqueued immediately after `leadScore` / `leadGrade` write, (b) it re-runs the enabled rules on the updated Inquiry, and (c) if a new rule matches, it updates `assignedOfficerId` and creates an audit entry.

- **[C-4] LLM cost cap + daily LLM count tracking not wired to any model** — Spec §2 Story 3 AC#3 requires per-college daily cap (`LEAD_SCORE_DAILY_LLM_CAP`, default 500). No model or service currently tracks LLM-backed score count per college per day. Juvion has no `LLMUsageDaily` or similar record. This must be added to enforce the cap (return 409 or enqueue rules-only job if cap exceeded). **Fix:** Create a simple model to record daily LLM score counts per college (or piggyback on existing cost tracking if available in the finance module); ensure the scoring worker increments it and checks it *before* calling the LLM.

### HIGH

- **[H-1] BullMQ queue `admissions:lead-scoring` is reserved but worker not yet registered** — `backend/src/shared/queue/QueueManager.ts:109` declares `LEAD_SCORING: 'admissions:lead-scoring'` but no `registerQueue()` call for it exists in the codebase. The spec assumes the queue exists and can accept jobs, but the worker processor function must be registered before the server starts. **Fix:** Create `backend/src/modules/admissions/lead-scoring-worker.ts` (or extend intake-service/workflow.service to include the worker registration). Call `registerQueue({ name: QUEUE_NAMES.LEAD_SCORING, processor: scoringJobProcessor })` on server init (likely in the admissions module's `index.ts` or a top-level `src/bootstrap.ts`).

- **[H-2] LLM client timeout pattern uses `AbortSignal` but spec's 12s timeout lacks implementation detail** — Spec §7 Risk table mentions "12s timeout via `AbortSignal`; fall back to rules-only." The claude-adapter (lines 76, 151) *does* accept `opts.abortSignal` and forward it to the SDK. However, the spec doesn't specify *where* the 12-second timeout is created/enforced: does the scoring worker wrap the LLM call in `setTimeout(..., 12000)` and `abort()`? Or does the LLM client itself enforce it? **Fix:** Spec §6 Dependencies should add: "LLM client timeout: 12s `AbortSignal` created by the scoring worker via `new AbortController()` with `setTimeout(..., 12000)` triggering `controller.abort()`." Implement the pattern in the worker, not the LLM client.

- **[H-3] Module boundary: scorer in admissions or juvi?** — Spec §6 lists `juvi/finance-agent/llm-client.ts` as a dependency but doesn't declare which module owns the scoring service. The spec names it "Juvi LLM call" (§3, "LLM component") yet the scoring logic (rules + blend) is admissions-specific. Recommend: **admissions** module owns `lead-scoring-service.ts` (rules scorer, blending logic, job processor, stats API), **juvi** owns only the LLM adapter call (already decoupled). Admissions imports from juvi; no reverse dependency. This maintains single responsibility: admissions = domain logic, juvi = LLM abstraction. **Confirmation:** No circular dependency risk (verified above).

### MEDIUM

- **[M-1] `scoreRationale` storage shape under-specified for Mongoose Mixed** — Spec §3 proposes a well-typed object (ruleScore, llmScore, factors[], etc.) but Inquiry.scoreRationale is suggested as `Schema.Types.Mixed` for now. Mixed fields bypass validation and can accumulate tech debt. **Recommendation:** Define a strict subdocument schema (nested in Inquiry or as a separate type) and validate it via Zod in the service layer before write. Aligns with the codebase's TypeScript strictness philosophy.

- **[M-2] Daily LLM cap enforcement ambiguous on batch endpoint** — Spec §2 Story 3 AC#3 says batch endpoint respects the cap ("Excess inquiries score with rules-only fallback and `scoreRationale.llmSkipped: true`"). But does the batch processor check the cap *per job* (slower, safer) or *once at batch start* (faster, but may overspend if cap is tight)? **Fix:** Clarify in spec: "The batch worker checks the daily LLM cap once at start; if remaining capacity < N inquiries, it marks excess jobs with `llmSkipped: true` at enqueue time (no LLM calls for them)."

- **[M-3] `leadGrade` derivation helper referenced but not verified in codebase** — Spec §2 Story 1 mentions `deriveLeadGrade(score)` (§3, "existing helper"). Confirmed present in workflow.handlers.ts:71 but not exported from service or utility module. Ensure it's accessible to the scoring worker. **Fix:** Export `deriveLeadGrade` from a shared utility or service module so the scorer can call it without duplicating logic.

- **[M-4] Prompt masking for PII — "reuse `prompts.ts` pattern" is vague** — Spec §5 NFRs says "Inquiry phone/email masked before LLM context (reuse `prompts.ts` pattern)." No reference to `prompts.ts` location or pattern visible in the codebase from the spec perspective. **Fix:** Spec §6 Dependencies should cite the exact file path and the masking function name (e.g., `backend/src/modules/juvi/prompts.ts:maskPhoneEmail`).

### LOW

- **[L-1] Stats API grouping (`gradeDistribution`) under-specified** — Spec §2 Story 5 AC#1 requires `GET /api/admissions/lead-scoring/stats?range=today` returning `gradeDistribution`. Is it a count per grade (`{ hot: 42, warm: 18, cold: 5, dormant: 2 }`) or percentages? **Fix:** Clarify in spec or add an example response.

- **[L-2] "Idempotency" NFR (§5) may be misaligned with worker semantics** — NFR states "Same Inquiry scored twice within 60s → second job no-ops." This is achievable via job deduplication (BullMQ job ID strategy) or checking `lastScoredAt`, but the spec doesn't name the mechanism. **Fix:** Clarify whether idempotency is via: (a) BullMQ job ID collision (same data = same hash), (b) worker checks `lastScoredAt` and returns early, or (c) concurrent request handling at the HTTP API level.

## Confirmed (no issue)

- ✅ Hybrid scoring model (0.6 rules + 0.4 LLM) integrates cleanly into the W01 `lead_score` step handler (workflow.handlers.ts:66–85). Handler already reads `result.leadScore` and `result.leadGrade` and updates the Inquiry. The scoring worker will populate these before the handler runs.
- ✅ BullMQ `QueueManager.registerQueue()` pattern is well-established (QueueManager.ts:27–52). Queue registration is straightforward; just needs the worker processor.
- ✅ `applyAssignmentRulesOnCreate()` exists in service.ts:100–117 and is already wired into `createInquiry()` (line 75). Can be adapted for re-evaluation post-score.
- ✅ LeadInteraction model (LeadInteraction.ts:1–44) captures outcome enum ('interested', 'callback_requested', 'visit_scheduled', 'converted') that aligns with spec §2 Story 2 trigger conditions.
- ✅ AbortSignal + timeout pattern is proven in the existing claude-adapter (lines 76, 151). Scoring worker can safely adopt it.
- ✅ No circular import risk between admissions and juvi modules (verified: juvi is not imported in admissions, only models are shared).
- ✅ Multi-tenancy discipline is consistent: every Inquiry query filters by `collegeId`; the scoring worker will receive `collegeId` in job payload.
- ✅ Audit logging infrastructure supports semantic actions via the `AuditAction` union; only the `ai_score_computed` action needs to be added.
- ✅ createAuditLog() pattern (audit.ts:50–52) matches the spec's intended usage.

