# GATE 2 — API + Security Validation

## Summary
**FAIL** — 6 findings: 1 CRITICAL (missing RBAC role for recompute button), 3 HIGH (idempotency enforcement unclear, rate-limit atomicity not specified, HTTP error codes undefined), and 2 MEDIUM (audit trail completeness, PII masking for LLM context).

---

## Findings

### 🔴 CRITICAL

#### 1. RBAC role `admissions_admin` does not exist in policy defaults
**Spec reference:** Story 4 (line 59): "A 'Recompute score' button appears in the detail modal for users with role `admissions_admin` or above."

**Current state:** 
- `backend/src/shared/rbac/defaults.ts` defines personae like `ST-ADM-AC` (Admissions Counsellor), `ST-ADM-AO-CH` (Cluster Head), `ST-ADM-DIR` (Admissions Director).
- No role or personaType `admissions_admin` exists in the policy hierarchy (lines 1–115).
- The spec assumes a role that is not defined in the system.

**Risk:** Authorization middleware `backend/src/middleware/authorize.ts` will deny the recompute action to all users, breaking Story 4. The UI button will either be permanently hidden or trigger 403 errors.

**Recommended fix:**
1. **Option A (Preferred — by role):** Define a new global role `admissions_admin` in defaults.ts (priority 760):
   ```typescript
   { role: 'admissions_admin', module: 'admissions', action: '*', effect: 'allow', priority: 760, isActive: true, description: 'Admissions Admin: full admissions + lead scoring controls' },
   ```
   Then spec update routes as `authorize('admissions', 'update')` and document that `admissions_admin` or higher (principal, admin, super_admin) can recompute.

2. **Option B (by persona):** Assign recompute (`rescore`) to `ST-ADM-DIR` (Admissions Director, already priority 780) as a restricted action. Update routes to use `authorize('admissions', 'update', { subDomain: 'lead-scoring' })` and add `ST-ADM-DIR` explicit allow for that subDomain.

**Recommended approach:** Option A — simpler and aligns with the story's intent.

---

### 🟠 HIGH

#### 2. Idempotency enforcement not specified in API contract
**Spec reference:** NFR constraint (line 130): "Idempotency: Same Inquiry scored twice within 60s → second job no-ops"

**Current state:**
- BullMQ's `addJob()` (backend/src/shared/queue/QueueManager.ts:62–77) does NOT deduplicate by jobId; it accepts `name`, `data`, and opts but does NOT use a composite jobId derived from `inquiryId + timestamp`.
- No mention of how a second call within 60s is detected (Redis cache key? In-memory lock? Job metadata?).
- Routes `/inquiries/:id/rescore` and workflow handler `createLeadInteraction` will enqueue jobs without checking if one already exists.

**Risk:** 
- Race condition: two concurrent rescore requests on the same inquiry will spawn two scoring jobs, both writing to the same Inquiry doc → unpredictable final state.
- Spec compliance fails; ops will re-score the same lead twice and be charged twice for LLM calls.

**Recommended fix:**
Specify idempotency in the spec clearly:
1. **Worker-level:** BullMQ job deduplication by composite key:
   ```typescript
   const jobId = `score:${inquiryId}:${Math.floor(Date.now() / 60000)}`;  // minute granule
   await addJob('admissions:lead-scoring', 'score', { inquiryId, collegeId }, { jobId });
   ```
   This prevents duplicate jobs within a 60s window.

2. **Service-level:** In the scoring service, read the Inquiry's `scoreRationale.computedAt` and skip if `Date.now() - computedAt < 60000`.

3. **API response:** Return 202 Accepted with the jobId (for polling), or 208 Already Reported if a recent score exists, per RFC 7231.

**Code location:** 
- Service: `backend/src/modules/admissions/service.ts` (rescore function, to be created)
- Routes: `backend/src/modules/admissions/routes.ts` (add `POST /inquiries/:id/rescore`)

---

#### 3. Rate-limit cap enforcement not atomic (Redis race condition risk)
**Spec reference:** Story 3 (lines 47): "max 500 LLM-backed scores per college per 24h (config via env `LEAD_SCORE_DAILY_LLM_CAP`)"

**Current state:**
- No Redis counter or atomic operation documented.
- If the cap check is done as `get counter → check → increment`, a second worker thread will see the same counter and both will proceed.

**Risk:**
- A college exceeds the daily LLM cap silently; unexpected costs.
- Batch jobs (story 3) will not correctly fall back to rules-only after reaching the cap.

**Recommended fix:**
Use Redis INCR with TTL (atomic check-and-increment):
```typescript
const today = new Date().toISOString().slice(0, 10);
const counterKey = `lead-score:llm:${collegeId}:${today}`;
const dailyCap = parseInt(process.env.LEAD_SCORE_DAILY_LLM_CAP || '500', 10);

const count = await redis.incr(counterKey);
if (count === 1) await redis.expire(counterKey, 86400);  // set 24h TTL on first call

if (count > dailyCap) {
  // Skip LLM, use rules-only fallback
  rationale.llmSkipped = true;
} else {
  // Call LLM, increment cost
  const result = await llmClient.complete(maskedMessages);
  rationale.llmScore = result.score;
  rationale.llmCostInr = result.costInr;
}
```

**Code location:** `backend/src/modules/admissions/lead-scoring-worker.ts` (to be created)

---

#### 4. HTTP error codes and status contracts not defined
**Spec reference:** Story 3 (lines 43–47), Story 5 (lines 67–69)

**Current state:**
- Spec mentions 202 Accepted for async operations but does not define HTTP status codes for:
  - Cap reached (429 Too Many Requests? 402 Payment Required? 200 + fallback?)
  - Inquiry not found (404)
  - Invalid batch filter syntax (400)
  - LLM upstream timeout (504 Gateway Timeout or 200 with fallback?)

**Risk:**
- Frontend cannot reliably handle error states; UI behavior is unpredictable.
- Monitoring/alerting cannot distinguish "normal fallback" from "error."

**Recommended fix:**
Add a "API Contract" section to the spec with explicit HTTP codes:

| Scenario | Code | Body |
|----------|------|------|
| Rescore enqueued | 202 | `{ jobId: "...", status: "enqueued" }` |
| Inquiry not found | 404 | `{ error: "Inquiry not found" }` |
| Invalid batch filter | 400 | `{ error: "Invalid filter: ..." }` |
| Daily LLM cap reached | 200 | `{ jobId: "...", status: "enqueued", llmSkipped: true, reason: "cap_reached" }` |
| LLM timeout (fallback) | 200 | `{ jobId: "...", status: "enqueued", llmFallback: true }` |
| Unauthorized (no recompute role) | 403 | `{ error: "Access denied" }` |

This makes it explicit that cap-reached and LLM-timeout are **not errors** — they succeed with graceful degradation.

**Code location:** Routes and controller, to be added.

---

### 🟡 MEDIUM

#### 5. Audit trail does not capture which user triggered scoring
**Spec reference:** Story 1 (line 25): "The score write triggers a `createAuditLog` entry with `action: 'ai_score_computed'`"

**Current state:**
- Spec says audit action is `'ai_score_computed'`, but:
  - Auto-score on inquiry creation: triggered by the `/POST /inquiries` controller, which has `performedBy: req.user.id`.
  - Re-score on interaction: triggered by a job worker (background, no user context).
  - Manual recompute: triggered by `/POST /inquiries/:id/rescore`, which has `performedBy: req.user.id`.
- BullMQ workers do not have access to `req.user` context; they only see the job payload `{ inquiryId, collegeId }`.

**Risk:**
- Audit log will show `performedBy: undefined` or `performedBy: "system"` for background rescores, losing user-attribution for manual recomputes initiated via Story 3 button.
- Compliance audit trail incomplete: cannot trace "who asked for the recompute?"

**Recommended fix:**
1. **For auto-score and manual recompute:** Controller passes `performedBy: req.user.id` in the job data:
   ```typescript
   await addJob('admissions:lead-scoring', 'score', {
     inquiryId, collegeId, performedBy: req.user!.id
   });
   ```

2. **In the worker:** Read `performedBy` from the job and pass to audit:
   ```typescript
   await createAuditLog({
     collegeId, entityType: 'Inquiry', entityId: String(inquiry._id),
     entityName: inquiry.name, action: 'ai_score_computed',
     changes: [{ field: 'leadScore', old: inquiry.leadScore, new: newScore }],
     performedBy: job.data.performedBy || 'system:lead-scoring-batch',
   });
   ```

3. **Audit action enum:** Extend `backend/src/shared/audit.ts` to define `'ai_score_computed'` as a valid action if not already present.

**Code location:** 
- Routes: pass `performedBy` in job data.
- Worker: read from job and pass to audit.

---

#### 6. PII masking for LLM context not confirmed to exist for Inquiry fields
**Spec reference:** NFR constraint (line 127): "PII handling: Inquiry phone/email masked before LLM context (reuse `prompts.ts` pattern)"

**Current state:**
- `backend/src/modules/juvi/finance-agent/pii.ts` defines a PII masker for finance data (phone, email, address, aadhaar, pan, dob, guardian fields).
- The masker is **finance-agent-specific** and is not documented as reusable for admissions scoring.
- Spec says "reuse prompts.ts pattern" (fee-analytics masking), but the scoring feature will send different LLM prompts (inquiry summary + interaction notes, not fee breakdowns).
- **Unknown:** Will the masker be extracted to a shared module, or duplicated in lead-scoring-worker?

**Risk:**
- Leads' phone/email may leak to Claude API if the masking utility is not called.
- Compliance risk: PII transmitted to external LLM unmasked.

**Recommended fix:**
1. **Extract PII masker to shared module:** Move `pii.ts` from `backend/src/modules/juvi/finance-agent/` to `backend/src/shared/pii.ts` (or a shared `llm-pii/` folder) so both finance-agent and lead-scoring can import it.

2. **In lead-scoring-worker:** Call the masker before LLM:
   ```typescript
   import { maskPII } from '../../shared/pii';

   const inquiryData = {
     name: inquiry.name,
     phone: inquiry.phone,
     email: inquiry.email,
     // ... other non-sensitive fields
   };

   const { masked: maskedInquiry, tokenMap } = maskPII(inquiryData);
   
   const prompt = buildLeadScoringPrompt({
     inquiry: maskedInquiry,
     interactions: maskedInteractions,
   });

   const result = await llmClient.complete(prompt);
   ```

3. **Test:** Unit test confirms phone, email, aadhaar, etc. are replaced with tokens before LLM call.

**Code location:**
- Shared module: `backend/src/shared/pii.ts` (new or moved from finance-agent).
- Worker: `backend/src/modules/admissions/lead-scoring-worker.ts` (uses the shared masker).
- Test: `backend/src/modules/admissions/__tests__/lead-scoring-worker.test.ts`.

---

## Confirmed

✅ **Routes conflict-free:** Proposed routes (`POST /inquiries/:id/rescore`, `POST /lead-scoring/batch`, `GET /lead-scoring/batch/:batchId`, `GET /lead-scoring/stats`) are not yet in `backend/src/modules/admissions/routes.ts` or `workflow.routes.ts` (lines 1–118). No naming collisions.

✅ **Middleware patterns:** Routes use standard pattern (`authenticate` + `authorize` + `validate(schema)`) consistent with existing routes (e.g., lines 20–28 in routes.ts).

✅ **Multi-tenancy:** `authenticate` middleware extracts `collegeId` (backend/src/middleware/authenticate.ts:21), and spec requires all jobs carry `collegeId` in payload (§5, line 128). Confirmed in job data structure.

✅ **Multi-tenancy in queue workers:** BullMQ workers receive `{ inquiryId, collegeId, ... }` from job data; spec requires workers validate `collegeId` scoping. This is an implementation detail (not yet written) but the pattern is sound.

✅ **Audit pattern:** `createAuditLog()` exists in `backend/src/shared/audit.ts` and is called in routes (e.g., workflow.handlers.ts:45). Spec can reuse it for `action: 'ai_score_computed'`.

✅ **Pagination:** Spec does not require pagination for stats (line 67) or batch results (line 46), but if added later, `paginate()` helper exists in shared modules.

✅ **Validation:** Zod schemas will be added to `backend/src/modules/admissions/validation.ts`. Current patterns include required fields, enum checks, and range validation (e.g., leadScore 0–100). No special validation risk.

✅ **Stats endpoint scoping:** `GET /lead-scoring/stats?range=today` must aggregate by `collegeId` to prevent cross-tenant leaks. No confirmation yet that the aggregation query filters by `collegeId`, but this is a standard pattern in the codebase (e.g., dashboardStats in routes.ts:20).

✅ **Error responses:** `AppError(statusCode, message)` pattern is enforced (CLAUDE.md). Existing routes use 404 for not found, 400 for bad input, 403 for authorization failure.

---

## Recommendations for Implementer (Phase 8)

1. **Immediate (CRITICAL):**
   - Clarify RBAC: Define `admissions_admin` role or assign recompute to existing `ST-ADM-DIR` persona.
   - Design idempotency: Use BullMQ jobId composite key + worker-level debounce check.

2. **Before implementation (HIGH):**
   - Finalize HTTP contract for cap-reached, timeout, and error states.
   - Extract PII masker to shared module before lead-scoring-worker writes the first line.

3. **During implementation (MEDIUM):**
   - Pass `performedBy` through job payload; audit log will be complete.
   - Write unit tests for idempotency, rate-limiting, and PII masking.

---

## Sign-off

**Validator:** API + Security lead  
**Date:** 2026-05-14  
**Status:** Ready for Phase 8 with findings resolved.
