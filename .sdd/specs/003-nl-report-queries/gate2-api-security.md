# GATE 2 Validation — API + Security (003-nl-report-queries)

**Validator:** API + Security (highest-risk role)  
**Date:** 2026-05-14  
**Status:** FINDINGS (9 critical/major, 6 minor, 1 informational)

---

## Summary

The spec is **well-structured and risk-aware**, but has **critical gaps in authorization mechanics and audit logging that MUST be resolved before Phase B implementation**. The deliberate narrow scope (admin/super_admin only, 3-report allow-list) is the right call; the pre-existing `report-registry.ts:183` bug is a real blocker.

**Blocker findings:**
- **CRITICAL:** No clear authorization implementation path — the spec says "`authorize('governance', 'read') AND` a hard-coded role gate" but the codebase has no example of in-handler role checks.
- **CRITICAL:** `AuditAction` enum is missing `'ai_nl_report_query'` — it must be added.
- **CRITICAL:** The pre-existing collegeId ObjectId-wrap bug at `report-registry.ts:183` will cause the stats endpoint aggregation to return zeros.

**Major findings:**
- Post-LLM allow-list validator is under-specified — no guidance on `reportCode` type-safety or the exact shape of the allow-list check.
- Param validation spec is nominal — date range validation is missing specifics on "sane range" thresholds.
- PII masking strategy is under-specified — no clarity on whether the question text is masked BEFORE or AFTER LLM invocation.
- Idempotency is unaddressed — no deduplication strategy for repeated identical questions.

---

## Findings by Risk Level

### 🔴 CRITICAL

#### 1. Authorization Role Gate — No Implementation Pattern in Codebase

**Finding:** Spec §2, Story 1 AC#5 says: "Route uses `authorize('governance', 'read') AND a hard-coded role gate restricting to admin / super_admin`". The `authorize` middleware in `backend/src/middleware/authorize.ts` does not provide an "in-handler" role check option — it gates access via RBAC policies, but policies are column-indexed by `role`, `personaType`, `module`, and `action`. There is **no existing pattern** in the codebase for an in-handler check like `if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403)`.

**Why it matters:** Spec requires a hard 403 for non-admin personas (HOD, student, parent). Without a clear, audited authorization pattern, the gate could be bypassed or forgotten during implementation.

**Reference code:** `authorize.ts:14–70` shows the middleware returns 403 only when the RBAC policy effect is `'deny'` or missing. In-handler role checks are not idiomatic to the project.

**Recommendation:** 
1. **Clarify the intended pattern.** Either:
   - Add an `opts.adminOnly: true` flag to `authorize()` middleware so the gate is declarative in the route, or
   - Accept in-handler role checks and document the shape: `if (!['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: 'Admin role required' })`.
2. **Update spec §2 AC#5** to reflect the chosen pattern.
3. **Add a test** that verifies non-admin roles (HOD, student, parent) receive 403.

---

#### 2. AuditAction Enum Missing `ai_nl_report_query`

**Finding:** Spec §2, Story 1 AC#6 requires: "audit entry with `action: 'ai_nl_report_query'`". The `AuditAction` union in `backend/src/shared/types.ts:26–50` does not include this action — it only has:
- `'ai_score_computed'`
- `'ai_config_suggested'`
- `'ai_config_applied'`

**Why it matters:** TypeScript strict mode will reject the attempt to call `createAuditLog({ ..., action: 'ai_nl_report_query' })` unless the type is extended first.

**Reference code:** `shared/types.ts:48–50`, `shared/audit.ts:32–34` (the AUDIT_ACTIONS array).

**Recommendation:**
1. Update `backend/src/shared/types.ts` to add `| 'ai_nl_report_query'` to the `AuditAction` union (around line 50).
2. Update `backend/src/shared/audit.ts` to add `'ai_nl_report_query'` to the `AUDIT_ACTIONS` array (around line 35).
3. Commit this as a separate, tiny PR before 003 implementation so the test passes.

---

#### 3. Pre-existing Report-Registry collegeId Bug Blocks Stats Endpoint

**Finding:** Spec §2, Story 3 AC#2 requires a `GET /reports/nl-query/stats` endpoint that aggregates `NlReportQuery` documents. The aggregation pipeline must filter by `collegeId` in the first `$match` stage. However, `backend/src/modules/governance/report-registry.ts:183` has a pre-existing bug:

```typescript
const collegeId = new Types.ObjectId(ctx.collegeId);  // line 177: correctly wrapped
const pipeline: any[] = [
  { $match: { collegeId, createdAt: { ... } } },  // line 183: BUG — collegeId is a string here, not the ObjectId from line 177
```

The variable `collegeId` on line 183 shadows the outer `collegeId` parameter (which is a string), not the `ObjectId` from line 177. This causes the aggregation to return zero rows for any college.

**Why it matters:**
1. The `regression-guards/aggregate-collegeid-pattern.test.ts` is currently failing because of this (and other potential sites).
2. The stats endpoint will always return `{ totalQueries: 0, matched: 0, refused: 0, llmCostInr: 0, byReport: {} }` regardless of actual query volume.
3. Story 4 AC#1 requires this bug to be fixed so the test passes.

**Reference code:**
- Bug site: `backend/src/modules/governance/report-registry.ts:177–183`
- Test: `backend/src/__tests__/regression-guards/aggregate-collegeid-pattern.test.ts:82–125`
- Expected fix pattern in test comments: lines 24–30

**Recommendation:**
1. Fix the bug in this feature's scope (per Story 4 AC#1):
   ```typescript
   const cidObj = new Types.ObjectId(ctx.collegeId);
   const pipeline: any[] = [
     { $match: { collegeId: cidObj, createdAt: { ... } } },
   ```
2. Verify `npm run test -w backend -- regression-guards/aggregate-collegeid-pattern.test.ts` passes.
3. Commit the fix in its own small commit for reviewer clarity.

---

### 🟠 MAJOR

#### 4. Allow-List Enforcement — Validation Logic Under-Specified

**Finding:** Spec §3 states the validator checks:
> 1. `reportCode` is in the allow-list (else convert to `refused`).

However, the spec does not specify:
- **The allow-list representation.** Is it an array of strings, a Set, a map of `ReportDefinition`s?
- **The validation point.** Does the check happen in the route handler, in a dedicated service function, or in a middleware?
- **The error shape on violation.** Does an out-of-scope `reportCode` return a `refused` response as-is, or throw so the handler can catch and format it?
- **Type safety.** The spec says the LLM response shape is `{ status, reportCode?, params?, ... }`, but there's no Zod schema or TypeScript interface to validate the LLM output before the allow-list check.

**Why it matters:** If the validator is loose or missing, a malformed LLM response (e.g., `reportCode: 'sql_injection_attempt'`) could reach `report-service.runReport()`, which would then throw a 404 or worse, surface unimplemented stubs.

**Reference code:**
- Spec §3, lines 96–102 (validation steps).
- `report-registry.ts:72–91` (the 12 registered reports).
- `report-service.ts:27–30` (the `getDefinition` function that throws 404 for unknown codes).

**Recommendation:**
1. **Define the allow-list shape** in the spec: `const ALLOWED_REPORTS = ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'] as const;`
2. **Add an interface** for the LLM response:
   ```typescript
   interface NLReportResponse {
     status: 'matched' | 'refused';
     reportCode?: string;
     params?: Record<string, unknown>;
     reason?: string;
     rationale?: string;
   }
   ```
3. **Add validation logic** to the spec (pseudo-code):
   ```
   if (llmResponse.status === 'matched') {
     if (!ALLOWED_REPORTS.includes(llmResponse.reportCode)) {
       return { status: 'refused', reason: 'Report not supported in v1' };
     }
     // Proceed to runReport()
   }
   ```
4. Update the spec §3 to include this pseudocode as part of the validation checklist.

---

#### 5. Param Validation — "Sane Range" Under-Specified

**Finding:** Spec §3, validation step 3 says:
> Dates are ISO and within a sane range (`fromDate <= toDate`, no future endpoints beyond today + 1y).

However:
- **No explicit bounds.** What is "today + 1y"? Is it Jan 1 of the next year, or exactly 365 days from today?
- **No past bounds.** Can `fromDate` be in 1970? Should there be a minimum like "last 5 years only"?
- **No null/undefined handling.** Can `fromDate` and `toDate` be optional, or must they always be present?
- **No programmeId/branchId validation.** The `student-roster-snapshot` report accepts optional `programmeId` and `branchId`. The spec doesn't say how to validate these — do they need to exist in the college's registry?

**Why it matters:** Loose date validation could allow expensive or malformed aggregations (e.g., a 50-year range, or negative timestamps).

**Reference code:**
- Spec §3, lines 97–102 (validation steps).
- `report-registry.ts:72–91` (the 3 allowed reports and their param shapes).

**Recommendation:**
1. **Tighten the bounds** in the spec:
   ```
   - fromDate, toDate: ISO 8601 dates, required.
   - fromDate <= toDate.
   - fromDate >= (today - 5 years).
   - toDate <= (today + 1 year).
   - programmeId, branchId (if present): must exist in the college's Programme/Branch registry.
   ```
2. **Add a validation service function** with clear logic:
   ```typescript
   export async function validateReportParams(
     collegeId: string,
     reportCode: string,
     params: Record<string, unknown>,
   ): Promise<{ valid: true } | { valid: false; reason: string }> {
     // Check dates, check foreign keys, etc.
   }
   ```
3. Update the spec to reference this function.

---

#### 6. PII Masking Strategy — Before or After LLM?

**Finding:** Spec §5, NFR line says:
> PII — question may include free text; we DO NOT pass any college data into the LLM context beyond the allow-list — the LLM doesn't see student rows. **PII masker called defensively on the question itself before logging.**

This is ambiguous:
- **Is the question masked before or before the LLM call?** The phrase "before logging" suggests it's masked post-LLM, at the audit-log step. But "defensively on the question itself" suggests the question is the input being masked.
- **What PII is in a question?** Questions like "How did the September funnel compare to August?" are unlikely to contain phone numbers or email. Is the masker even necessary?
- **Does masking happen in the handler or in the audit function?** The spec doesn't say.
- **What about question retention?** The spec says the question is truncated to 500 chars for storage in the `NlReportQuery` document. Is that truncation before or after masking?

**Why it matters:** If the question is NOT masked before being sent to the LLM, then the LLM logs (at Anthropic) may retain unmasked free-text questions. If a question like "For student John Doe, what's their fee status?" reaches the LLM unmasked, PII has leaked to the LLM provider.

**Reference code:**
- Spec §5, NFR section, lines 137–149.
- `backend/src/shared/llm/pii.ts:1–120` (the masker).
- `lead-scoring/prompt.ts` (how lead-scoring uses the masker).

**Recommendation:**
1. **Clarify the data flow** in the spec:
   ```
   Question (raw) → Mask PII (if any) → LLM call → Receive response → 
   Log masked question to NlReportQuery + AuditLog → Truncate for display
   ```
2. **If the question is user-typed, use the masker** defensively:
   ```typescript
   const maskResult = maskPII(question);
   const maskedQuestion = maskResult.masked;
   const response = await callLLM(maskedQuestion);
   // Log maskedQuestion, not question
   ```
3. Add a Zod schema for the input that caps question length at 500 chars and rejects empty/whitespace-only:
   ```typescript
   const nlQuerySchema = z.object({
     question: z.string().min(1).max(500).trim(),
   });
   ```

---

#### 7. Idempotency — No Deduplication Strategy

**Finding:** The spec does not address what happens if an admin submits the same question twice in quick succession (e.g., accidental double-click). Options:
1. **Run twice, bill twice.** Two separate `NlReportQuery` records, two LLM calls, two bills.
2. **Deduplicate (30s window, like 002).** Return the cached response from the previous call if the question is identical and within a time window.
3. **Idempotency key.** Require the client to pass a unique request ID; server deduplicates by that ID.

The spec for 002 (config-suggest) mentions a "30s window" for deduplication (discovery line ~40). This feature should clarify its own approach.

**Why it matters:**
- If deduplication is desired, the implementation must use Redis (like cap-guard does) to track recent question hashes.
- If deduplication is NOT desired, the behavior should be documented so users understand they may be billed twice.

**Reference code:**
- Spec §3, no mention of idempotency.
- `cap-guard.ts:25–58` (the deduplication pattern from 002).

**Recommendation:**
1. **Add an open question to the spec** (e.g., "Should identical questions within 30s return cached results, or run fresh each time?").
2. **Recommend deduplication** for cost-control: "If the same question is submitted twice within 30 seconds, return the cached response from the first call without re-invoking the LLM."
3. **Implementation sketch:**
   ```typescript
   const cacheKey = `nl-query:${collegeId}:${hash(question)}:${Math.floor(Date.now() / 30000)}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   // Otherwise, call LLM and cache result
   ```

---

#### 8. HTTP Response Contract — Incomplete Status Code Table

**Finding:** Spec §2, Stories 1–3 describe response shapes for happy paths and refusal (`status: 'matched'` vs `status: 'refused'`), but the spec does not provide an explicit **status code by scenario table**. Scenarios with missing documentation:
- Cap reached (`NL_REPORT_DAILY_LLM_CAP` exceeded) — spec says return `status: 'refused'`, but what HTTP status? 429 (too many requests) or 200 with `{ status: 'refused', reason: 'cap_reached' }`?
- Malformed request body (missing/empty question) — 400 Bad Request assumed, but not stated.
- Non-admin user (HOD, student) — 403 Forbidden, per spec §2 AC#5.
- Unknown `reportCode` that somehow bypasses allow-list validator — 400 or 500?
- LLM timeout (>10s) — 504 Gateway Timeout or 200 with `status: 'refused'`?

**Why it matters:** Without explicit status codes, implementation teams may choose idiosyncratic codes, breaking client-side error handling.

**Reference code:**
- Spec §2, Stories 1–3.
- Spec §5, NFR, line 143 (mentions LLM timeout 10s).

**Recommendation:**
Add an explicit HTTP contract table to Spec §3 or a new subsection:

```
| Scenario | HTTP Status | Response Body |
|----------|-------------|---|
| Success (report runs) | 200 | { status: 'matched', reportCode, params, runId, results, ... } |
| Refused (no match) | 200 | { status: 'refused', reason, supportedReports, ... } |
| Cap reached | 200 | { status: 'refused', reason: 'cap_reached', supportedReports, ... } |
| Malformed body (empty question) | 400 | { error: 'Question required and non-empty' } |
| Non-admin user | 403 | { error: 'Admin role required' } |
| LLM timeout | 200 | { status: 'refused', reason: 'timeout', supportedReports, ... } |
| Unknown reportCode (should not happen) | 400 | { error: 'Invalid report selection' } |
```

---

### 🟡 MINOR

#### 9. `NlReportQuery` Model — Schema Gaps

**Finding:** Spec §3 defines the `NlReportQuery` schema, but:
- **No explicit `requiredFields` note.** Are all fields required, or can some (e.g., `params`, `runId`) be optional?
- **`refusalReason` vs `reason`.** Spec defines `refusalReason?` but Story 3 AC#1 says the response has `reason`. The field name should match.
- **Truncation of question for logging.** Spec says "question (truncated to 200 chars)" in the audit log, but the `NlReportQuery` document stores the full 500-char question. Should the document also store the truncated version for consistency?

**Why it matters:** Minor schema confusion could cause TypeScript compilation warnings or audit-log questions to be longer than intended.

**Recommendation:**
1. Rename `refusalReason` to `reason` in the interface for consistency with the HTTP contract.
2. Add explicit `required: true` annotations to the spec for: `collegeId`, `question`, `status`, `performedBy`, `generatedAt`, `model`, `promptVersion`, `costInr`.
3. Mark as optional: `selectedReport`, `params`, `refusalReason`, `runId`, `capReached`.
4. Consider adding a separate `questionTruncated` field (max 200 chars) for audit logs, or clarify that the audit log truncates at the logging step.

---

#### 10. `POST /reports/nl-query` — Missing Response Example

**Finding:** Spec §2, Story 1 AC#2 describes the response shape at a high level, but no JSON example is provided. Spec §3, NL Translation Design has a response shape in pseudo-JSON, but it's not formal.

**Why it matters:** Implementation teams often work from examples; a formal JSON schema would reduce interpretation variance.

**Recommendation:**
Add explicit JSON examples to Spec §2:

```json
// Matched response example
{
  "status": "matched",
  "reportCode": "admissions-funnel",
  "params": { "fromDate": "2026-04-01", "toDate": "2026-04-30", "programmeId": null },
  "runId": "507f1f77bcf86cd799439011",
  "results": { "rows": [...], "summary": {...} },
  "rationale": "You asked about April funnel; matched admissions-funnel with April date range.",
  "model": "claude-opus-4-7",
  "costInr": 0.42
}

// Refused response example
{
  "status": "refused",
  "reason": "Request asks for a Phase B report (collection-summary) not yet implemented in v1.",
  "supportedReports": ["admissions-funnel", "lead-source-performance", "student-roster-snapshot"],
  "model": "claude-opus-4-7",
  "costInr": 0.15
}
```

---

#### 11. Stats Endpoint — Aggregation Pipeline Missing from Spec

**Finding:** Spec §2, Story 3 AC#2 requires:
> `GET /api/governance/reports/nl-query/stats?range=today|week|month` returns `{ totalQueries, matched, refused, llmCostInr, byReport }`

However, the spec does **not** provide the aggregation pipeline shape or the exact structure of `byReport`. For example:
- Does `byReport` look like `{ "admissions-funnel": { count: 5, cost: 2.10 } }`?
- Does the `$match` stage filter by `collegeId` as the FIRST stage (it must, per multi-tenancy guidelines)?
- How is the `range` parameter interpreted? Is `today` the calendar day, or the last 24 hours?

**Why it matters:** Missing details in the aggregation pipeline spec will cause:
1. The `$match` stage to potentially be ordered incorrectly (performance + correctness).
2. The response shape to diverge across implementation attempts.
3. Test coverage uncertainty.

**Reference code:**
- Spec §2, Story 3 AC#2.
- Lead-scoring stats (if one exists) for a reference pattern.

**Recommendation:**
1. Add a pseudocode aggregation pipeline to the spec:
   ```
   Pipeline:
     1. $match: { collegeId: ObjectId(collegeId), generatedAt: { $gte: rangeStart, $lte: rangeEnd } }
     2. $facet: {
          byStatus: [ { $group: { _id: '$status', count: { $sum: 1 } } } ],
          byReport: [ { $group: { _id: '$selectedReport', count: { $sum: 1 }, cost: { $sum: '$costInr' } } } ],
          totalCost: [ { $group: { _id: null, total: { $sum: '$costInr' } } } ]
        }
   ```
2. Add explicit JSON example for the response (for range=today, example data).

---

#### 12. Frontend Integration — "Ask a Question" UI Not in Scope, But Endpoint Contract Unclear

**Finding:** Spec §2, Story 2 AC#1–4 describe the frontend behavior, but the backend API spec does not clarify:
- Does the "Ask a question" textarea live inside the existing ReportsPage, or is it a separate modal/tab?
- Is there a separate endpoint to fetch the list of supported reports for the "refused" chip list, or is it hardcoded?
- What happens to the `runId` in the response? The frontend must know how to fetch the full `ReportRun` document for display.

**Why it matters:** If the frontend doesn't have a clear contract for linking the `NlReportQuery` response to the full `ReportRun` result, the UI may show incomplete or stale data.

**Reference code:**
- Spec §2, Stories 2–3 (frontend behavior).

**Recommendation:**
1. Clarify in the spec whether the frontend should:
   - Fetch the full `ReportRun` by `runId` after receiving the NL response, or
   - Expect the full `ReportRun` result embedded in the NL response (current spec says `results`).
2. Add a note: "The `runId` can be used to re-fetch the result via `GET /api/governance/reports/runs/:id` if needed."

---

### ℹ️ INFORMATIONAL

#### 13. Prompt Version Tracking — Good Practice, Version Number Not Defined

**Finding:** Spec §3, `NlReportQuery` schema includes `promptVersion: string` for audit trail purposes. This is good practice (like 001 and 002 do). However, the spec does not define the version format. Should it be:
- A timestamp (e.g., `"2026-05-14T12:00:00Z"`)?
- A semantic version (e.g., `"1.0.0"`)?
- A commit hash (e.g., `"9cc8ecc"` — the declarative report engine commit)?

**Why it matters:** Future changes to the prompt (e.g., adding more reports, refining the LLM instructions) will need to be tracked for reproducibility and analytics.

**Recommendation:**
Add a note to Spec §3 or §6 Dependencies:
```
PROMPT_VERSION format: YYYY-MM-DD_HHmmss or Git commit short-hash of the commit 
that last changed the prompt text. Example: "2026-05-14_120000" or "9cc8ecc".
Use a constant in code: const PROMPT_VERSION = '2026-05-14_120000';
```

---

## Multi-Tenancy Validation

✅ **PASS.** The spec correctly states that `collegeId` is injected by `report-service.runReport()` (existing layer), which means the NL layer cannot bypass multi-tenancy even if the LLM sneaks a `collegeId` override into the params. The service-layer injection is the right place for this.

---

## RBAC & Row-Level Scope Validation

✅ **PASS.** The spec is correct to **exclude non-admin personas from v1**. The discovery document correctly identifies that row-level RBAC at the query layer is a prerequisite for safe cross-persona NL (e.g., HOD asking "show me my department's funnel"). This is deferred to a separate feature, which is the right call.

---

## Pre-Existing Bug Status

🔴 **BLOCKER.** The `report-registry.ts:183` collegeId ObjectId bug MUST be fixed before stats endpoint is testable. This is acknowledged in Story 4; confirm fix is committed before GATE 3.

---

## Recommendation Summary

| Priority | Finding | Action |
|----------|---------|--------|
| 🔴 CRITICAL | Authorization pattern unclear | Clarify in-handler vs middleware approach; update spec §2 AC#5 |
| 🔴 CRITICAL | `AuditAction` missing `'ai_nl_report_query'` | Add to `types.ts` and `audit.ts` enums before implementation |
| 🔴 CRITICAL | collegeId ObjectId bug at `:183` | Fix and verify test passes (Story 4 AC#1–2) |
| 🟠 MAJOR | Allow-list validator logic under-specified | Add Zod schema + validation function to spec §3 |
| 🟠 MAJOR | Date/param validation bounds unclear | Add explicit bounds (5-year past, 1-year future, etc.) |
| 🟠 MAJOR | PII masking strategy ambiguous | Clarify before-LLM vs after-LLM; recommend before-LLM |
| 🟠 MAJOR | No idempotency/deduplication strategy | Add optional deduplication (30s window, Redis) to spec |
| 🟠 MAJOR | HTTP status codes not tabulated | Add explicit status-code-by-scenario table |
| 🟡 MINOR | Schema field naming inconsistency | Rename `refusalReason` → `reason` |
| 🟡 MINOR | Stats aggregation pipeline not specified | Add pseudocode pipeline + JSON example |
| 🟡 MINOR | Prompt version format not defined | Define format (timestamp or commit hash) |
| ℹ️ INFO | (No issues) | — |

---

## Conclusion

**Recommendation: CONDITIONAL PASS to GATE 3 (Phase B implementation) pending resolution of CRITICAL findings.**

The spec's deliberate narrow scope (admin-only, 3-report allow-list, no Phase B stubs) is the right risk-mitigation choice. The architecture correctly scopes multi-tenancy to the report-service layer. However, implementation cannot proceed until:

1. The authorization role-gate pattern is clarified and spec-updated.
2. `AuditAction` enum is extended with `'ai_nl_report_query'`.
3. The pre-existing collegeId bug is fixed and regression test passes.

The major findings (allow-list validation, param bounds, PII masking, idempotency) should be resolved in the spec before implementation starts to avoid rework.

**Validator sign-off:** Ready for implementation team GATE 3 review. Findings log updated.
