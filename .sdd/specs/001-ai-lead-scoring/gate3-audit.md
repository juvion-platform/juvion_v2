# GATE 3 — Pre-Implementation Audit

## Summary
**PASS with minor corrections** — plan is implementable. One blocking finding on deriveLeadGrade mapping, one critical note on jobId support, one clarification on worker bootstrap.

## Verified (plan is correct here)
- `backend/src/shared/types.ts` exists; `AuditAction` union ready for `'ai_score_computed'` addition (lines 26–46)
- `backend/src/shared/audit.ts` exists; `AUDIT_ACTIONS` array ready for extension (lines 27–32)
- `backend/src/modules/juvi/finance-agent/pii.ts` exists and exports `maskPII()` + `unmaskText()` (lines 132, 143)
- Importers of pii.ts found: `__tests__/pii.test.ts`, `service.ts` — will need path update when moved
- `deriveLeadGrade()` exists in `workflow.handlers.ts` line 2654 and is re-homed; safe to move and re-export
- `backend/src/models/admissions/Inquiry.ts` confirmed: no `scoreRationale` or `lastScoredAt` fields exist (grep clean)
- `backend/src/models/admissions/LeadScoringStats.ts` does not exist (ready for creation)
- `applyAssignmentRulesOnCreate()` exists in `service.ts` line 100; signature: `async function applyAssignmentRulesOnCreate(collegeId: string, inquiryPayload: Record<string, unknown>): Promise<IAssignmentRule | null>`
- `backend/src/modules/admissions/intake-service.ts` exists (32.3K); interactions created via `LeadInteraction.create()` in `workflow.service.ts`
- `backend/src/modules/admissions/routes.ts` verified: no conflicts with planned routes (`POST /inquiries/:id/rescore`, `POST /lead-scoring/batch`, `GET /lead-scoring/batch/:batchId`, `GET /lead-scoring/stats`)
- `backend/src/modules/admissions/index.ts` is thin (128B); imports from routes, controller, service; no existing worker registration
- `backend/src/shared/queue/QueueManager.ts` exists; `registerQueue()` signature at line 27; `addJob()` signature at line 62
- `authorize()` middleware at `backend/src/middleware/authorize.ts` line 14; signature: `authorize(module: string, action: string, opts?: RbacOptions)` ✓
- `admin-portal/src/services/admissions.ts` exists (8.9K); ready for new API methods
- `admin-portal/src/pages/admissions/InquiriesPage.tsx`, `CRMDashboardPage.tsx` confirmed present
- Redis singleton at `backend/src/config/redis.ts` exports default `redis` (ioredis instance)
- Test infrastructure: **Vitest** (not Jest) is primary test runner (`package.json` scripts: `test`, `test:watch`); `mongodb-memory-server` **present**; `ioredis-mock` NOT found in dependencies

## Drift / Plan corrections required

### BLOCKING (must fix plan before Wave 1)

- **[B-1] `deriveLeadGrade()` logic is incomplete**
  - Current implementation at line 2654 returns only `'hot' | 'warm' | 'cold'` (≥80, ≥50, else cold)
  - Plan spec §3 requires four grades: `'hot' | 'warm' | 'cold' | 'dormant'`
  - No `dormant` path exists in current code. When plan moves function to `lead-scoring/grade.ts`, define dormant logic (e.g., score < 30?)
  - **Fix in plan:** Clarify dormant threshold and update spec §3.1 threshold table

- **[B-2] `QueueManager.addJob()` does NOT support `jobId` option for dedup**
  - Current signature (line 62): `addJob(queueName, jobName, data, opts?: { delay?, priority?, attempts?, backoff? })`
  - No `jobId` in options; BullMQ native `jobId` dedup unavailable through current API
  - Plan §10.6 calls `enqueueScoring()` with composite `jobId` to deduplicate scores within 60s window
  - **Fix required:** Either (a) extend `QueueManager.addJob()` opts to include `jobId?: string` (minimal, forward-compatible), or (b) call `queue.add()` directly in `enqueue.ts` bypassing QueueManager
  - **Recommendation:** Update QueueManager to expose jobId option (5-line change); use in dedup middleware downstream

- **[B-3] Worker registration bootstrap location unclear**
  - Plan § D says "Call `registerLeadScoringWorker()` on init" in `admissions/index.ts`
  - Current `admissions/index.ts` (128B) only exports; no init hooks or module-load-time side effects
  - Example codebase pattern: `proposal-expiry-worker.ts` + `workers/fee-commitment.worker.ts` call `registerQueue()` at module load
  - **Fix in plan:** Either (a) call `registerLeadScoringWorker()` in `worker.ts` at module load (function auto-runs on import), or (b) clarify bootstrap happens in `app.ts` after all module imports
  - **Recommendation:** Place `import './modules/admissions/lead-scoring/worker'` in `app.ts` alongside other handler imports (line 12 pattern); worker.ts calls registerQueue on load

### MINOR (note in plan, fix during impl)

- **[M-1] Test framework is Vitest, not Jest**
  - Plan references `rtk jest` in risks; actual runner is `vitest` (found in backend/package.json scripts)
  - Minimal impact — Vitest is Jest-compatible; test syntax unchanged
  - Update plan risk table row 1: "…run `rtk tsc` + finance-agent tests…" → "…run `npm run typecheck` + `npm run test`…"

- **[M-2] `ioredis-mock` not in dependencies**
  - Backend dependencies include `ioredis` but not `ioredis-mock` for test mocking
  - Cap-guard `tryClaimLLMSlot()` needs Redis mocks in integration tests
  - Add `ioredis-mock` to backend devDependencies during implementation (Wave 1 prerequisite, not blocking plan)

- **[M-3] LeadInteraction creation flow spans two layers**
  - Interactions are created in `workflow.service.ts` (line calls `LeadInteraction.create()`)
  - Controller calls `wfSvc.createLeadInteraction()` (workflow.controller.ts)
  - Plan says "intake-service.ts or wherever interactions are created" — confirm route is `POST /inquiries/:inquiryId/interactions` (workflow.routes.ts line 33)
  - **No drift;** plan task 1.5 correctly targets the workflow layer for the `enqueueScoring(..., 'interaction')` hook

## Additional context discovered

- **QueueManager already defines `QUEUE_NAMES.LEAD_SCORING`** at line 109 as `'admissions:lead-scoring'` — plan correct
- **Workflow handler W01 'lead_score'** at line 66 currently updates Inquiry after handler returns; plan will replace this with a call to `scoreInquiry()` orchestrator
- **Inquiry model is ~192 lines**, rich with CRM fields (UTM, MQL/SQL, officer hierarchy); schema.indexes ready for lead-scoring indexes (score, grade, lastScoredAt)
- **`deriveLeadGrade()` is currently unexported**; moving it to shared/re-exported is safe (no other importers found outside workflow.handlers)
- **pii.ts uses token format `{category_ordinal}`** (e.g., `{email_1}`); exact match requirement when building masked prompts
- **Redis connection** via `config/redis.ts` singleton; cap-guard can import and use directly: `import redis from '../../config/redis'`

## Recommendations before Wave 1

1. **Extend QueueManager.addJob()** to accept optional `jobId` parameter (maps to BullMQ `jobId` option)
2. **Define dormant threshold** in spec (e.g., score < 30 → 'dormant') and update plan gradient table
3. **Add worker bootstrap import** to app.ts: `import './modules/admissions/lead-scoring/worker'` (after line 12)
4. **Add ioredis-mock** to backend/package.json devDependencies before integration test writing
5. **Confirm enqueue dedup window** — plan says 60s; confirm Redis TTL strategy (set key once, never again until expires)
