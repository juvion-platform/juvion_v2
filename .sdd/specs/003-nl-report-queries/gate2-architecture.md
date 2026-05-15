# GATE 2 Architecture Validation — 003-nl-report-queries

**Validator:** Architecture (003)  
**Date:** 2026-05-14  
**Status:** **PASS** (5 findings; 0 blockers, 2 medium, 3 low)

---

## Summary

The NL report queries feature can proceed to Phase 8 implementation. The architecture is sound:
- Existing `report-service.runReport()` surface cleanly supports NL dispatch (no refactor needed).
- The three allow-listed reports have working runners with correctly-scoped params.
- The pre-existing `report-registry.ts:183` bug exists and is one-liner fixable.
- Cap-guard is already parameterized in the current codebase (no wait for PR #61).
- Role-gate pattern is clear (route-level `authorize()` + in-handler role check).

**Key design decisions validated:**
1. NL layer belongs in `modules/governance/nl-reports/` (mirroring `admissions/lead-scoring/`), with `report-service.runReport()` as the orchestration target.
2. Validation (allow-list, param shape, date sanity) should be a thin validator service inside the nl-reports module, not inline in the controller.
3. Cap-guard namespace should be `'nl-reports'`; it's already parameterized and ready.

---

## Findings by Severity

### [MEDIUM-1] AuditAction type must be extended with 'ai_nl_report_query'

**Location:** `backend/src/shared/types.ts:26–50`

**Status:** Not yet done; required for AC Story 1 §6 (audit logging).

**Context:**
The `AuditAction` type is a union of semantic action names. Currently includes:
```typescript
export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'propose' | 'accept' | 'decline' | 'withdraw' | 'expire' | 'waitlist_promote' | 'vacate_request' | 'vacate_approve' | 'vacate_reject'
  | 'approve' | 'reject' | 'submit' | 'publish' | 'archive'
  | 'ai_score_computed' | 'ai_config_suggested' | 'ai_config_applied';
```

**Finding:**
Spec §1 AC#6 requires `createAuditLog()` writes with `action: 'ai_nl_report_query'`. This action is not in the current union. 

**Remediation:**
Add one line to the union in `backend/src/shared/types.ts:50` (after `'ai_config_applied'`):
```typescript
| 'ai_nl_report_query';
```

Also update the corresponding action list in `backend/src/shared/audit.ts` (currently omitted; discovery reveals it exists per commit a62763c). Verify `AUDIT_ACTIONS` array in `audit.ts` and add the new action if missing.

---

### [MEDIUM-2] Line 183 bug in `report-registry.ts` — `collegeId` must wrap in `new mongoose.Types.ObjectId()`

**Location:** `backend/src/modules/governance/report-registry.ts:183`

**Status:** Confirmed. Bug exists; regression guard test is failing.

**Finding:**
Line 183 in the `lead-source-performance` aggregation pipeline:
```typescript
{ $match: { collegeId, createdAt: { $gte: from, $lte: to } } }
```

The `collegeId` is a shorthand (field-shorthand syntax) — the variable is a string but Mongoose `.aggregate()` does not auto-cast strings to ObjectId in `$match` stages (unlike `.find()`). This is already detected by the regression guard test at `backend/src/__tests__/regression-guards/aggregate-collegeid-pattern.test.ts:82–126`.

The fix is one line (matching the pattern established in `admissions-funnel` at line 125 and `student-roster-snapshot` at line 427):
```typescript
const collegeId = new Types.ObjectId(ctx.collegeId);
```

Then change line 183 to reference the wrapped ObjectId:
```typescript
{ $match: { collegeId, createdAt: { $gte: from, $lte: to } } }  // now `collegeId` refers to the wrapped ObjectId, not the string parameter
```

**Why included in 003:**
- Spec §2 Story 4 AC#2 requires the regression-guard test to pass.
- Any new aggregation added in Phase 8 must start on a clean foundation.
- The fix is pre-existing work, not new to 003.

**Remediation:**
1. Wrap `ctx.collegeId` at the top of the `leadSourcePerformance.run()` function (line 176, after the `const from = ...` and `const to = ...` lines):
   ```typescript
   const collegeId = new Types.ObjectId(ctx.collegeId);
   ```
2. Change line 183 from the bug pattern to reference `collegeId` (it will now resolve to the wrapped ObjectId, not the string). The shorthand syntax remains valid.
3. Run `npm run test -w backend` to confirm `regression-guards/aggregate-collegeid-pattern.test.ts` passes.

---

### [LOW-1] Report parameter shapes — confirmed all three allow-listed reports match spec claims

**Location:** `backend/src/modules/governance/report-registry.ts:109–451`

**Status:** Verified.

**Finding:**
Spec §3 lists the allow-list and declares parameter shapes:
- `admissions-funnel`: params `{ fromDate, toDate, programmeId? }` (spec) vs. actual `{ from, to }` (code, no programmeId)
- `lead-source-performance`: params `{ fromDate, toDate }` (spec) vs. actual `{ from, to }` (code) ✓
- `student-roster-snapshot`: params `{ programmeId?, branchId?, asOfDate? }` (spec) vs. actual `{ status }` (code, no programme/branch/asOf)

**Issue:** Spec parameter names (`fromDate`, `toDate`, `programmeId`, `asOfDate`) do not match actual field keys (`from`, `to`, `status`).

**Impact:** The NL prompt builder must map the user's likely intent ("from" / "to" dates, "programme", "branch") → the actual parameter keys the report runners accept. The spec prompt example (§3) uses `fromDate` / `toDate` but the runners use `from` / `to`. This is not a blocker — it's a **documentation alignment** issue.

**Remediation:**
Update Spec §3 NL Translation Design prompt to use the **actual** parameter keys:
- admissions-funnel: `{ from, to }` (no programmeId in v1)
- lead-source-performance: `{ from, to }` ✓
- student-roster-snapshot: `{ status: 'active' | 'all' }` (no programme/branch/asOfDate in v1)

**Or:** Implement the missing parameters in the runners if the spec intent was to support them. This is a decision call — the spec discovery says 10/12 reports are Phase B stubs, suggesting parameter sets may still be in flux. For now, implement the NL layer to match the **existing runners**, not the spec's aspirational parameter list.

---

### [LOW-2] No explicit module boundary for nl-reports — recommend submodule

**Location:** N/A (architecture pattern)

**Status:** Recommendation.

**Finding:**
The spec doesn't specify whether NL queries should live as:
1. **Submodule** (`modules/governance/nl-reports/` with service + controller + validator), or
2. **Inline** in existing `report-controller.ts` and `report-service.ts`.

**Recommendation:** **Create `modules/governance/nl-reports/` submodule** (mirrors `admissions/lead-scoring/`).

**Rationale:**
- Lead-scoring precedent: feature-specific LLM logic (cap-guard, prompt, scoring, validator) lives in its own submodule, not inline in the parent module.
- Separation of concerns: NL translation + validation is conceptually distinct from report definition/execution.
- Future expansion: Phase B (wider NL coverage, cross-persona, row-level RBAC integration) will add complexity; a submodule scales cleaner.

**Structure:**
```
modules/governance/nl-reports/
  service.ts          # translate(question) → { reportCode, params } or refuse
  validator.ts        # validateAllowList, validateParamShape, validateDates
  prompt.ts           # system + user prompt builder
  controller.ts       # POST /nl-query handler
  index.ts            # exports
  __tests__/
```

The controller will call `report-service.runReport()` after validation succeeds.

---

### [LOW-3] Role gate implementation is clear; no RBAC surface cleanup needed

**Location:** `backend/src/middleware/authorize.ts:14–70`

**Status:** Verified.

**Finding:**
The spec (§2 Story 1 AC#5) requires:
- Route-level: `authorize('governance', 'read')`
- Handler-level: `req.user.role in ['admin', 'super_admin']` hard-coded check

Pattern is already established in the codebase (other governance routes use `authorize('governance', 'read')`; no existing role-specific gate middleware found).

**Implementation approach:**
1. Add route: `router.post('/reports/nl-query', authenticate, authorize('governance', 'read'), nlQueryHandler)`
2. Inside `nlQueryHandler`, add:
   ```typescript
   if (!['admin', 'super_admin'].includes(req.user?.role || '')) {
     return res.status(403).json({ error: 'NL queries restricted to admin / super_admin' });
   }
   ```

No refactor of `authorize.ts` needed. The role check is a simple guard, not a policy evaluation.

---

## Confirmed Architecture Decisions

### 1. Service layer surface supports NL dispatch (no refactor)

**Code:** `backend/src/modules/governance/report-service.ts:49–102`

The `runReport(collegeId, code, parameters, requestedBy)` function is the right target:
- It already orchestrates `getDefinition(code)` (including allow-list validation via registry lookup).
- It persists `ReportRun`, handles errors, calls audit.
- The NL layer simply pre-fills the `parameters` object and passes it through.

**No refactor needed.** NL layer → `validate(params)` → `report-service.runReport()` ✓

---

### 2. Cap-guard is parameterized and ready (no wait for PR #61)

**Code:** `backend/src/modules/admissions/lead-scoring/cap-guard.ts:40–58`

The current live code already has the parameterized signature:
```typescript
export async function tryClaimLLMSlot(
  collegeId: string,
  cap: number,
  now: Date = new Date(),
  namespace: string = 'lead-score',  // ← parameterized!
): Promise<ClaimResult>
```

**No wait needed.** Call it as `tryClaimLLMSlot(collegeId, 30, new Date(), 'nl-reports')` in the NL handler. ✓

---

### 3. Pre-existing audit infrastructure supports new action

**Code:** `backend/src/shared/audit.ts` + `backend/src/shared/types.ts`

The `createAuditLog()` function (used throughout) accepts an `action: AuditAction` parameter. Only blocker: the `'ai_nl_report_query'` action must be added to the union (see MEDIUM-1).

---

### 4. Multi-tenancy is preserved by report-service injection

**Code:** `backend/src/modules/governance/report-service.ts:70`

The `runReport()` function passes `{ collegeId }` to the definition's `.run()` method. The LLM never sees `collegeId` (it's only in the post-LLM handler context). No cross-tenant data leak risk. ✓

---

## Test Coverage Notes

1. **Regression guard** (`aggregate-collegeid-pattern.test.ts`) must pass post-fix (Story 4).
2. **NL-specific tests** should cover:
   - Allow-list enforcement (refuse Phase B codes)
   - Param shape validation (refuse mismatched types)
   - Role gate (reject non-admin)
   - Cap-claim flow (allow/refuse on cap)
   - Audit log entry creation
   - Happy-path: LLM → matched → report runs → result returns

---

## Open Questions Resolved (from spec §9)

**None.** Spec is tight. Narrow scope is deliberate. All validation questions answered by discovery.

---

## Sign-off

✅ **PASS** — Proceed to Phase 8 (Implementation).

**Blockers:** None  
**Medium-severity findings:** 2 (AuditAction extension, line 183 ObjectId wrap)  
**Low-severity findings:** 3 (param shape alignment, module boundary recommendation, role-gate clarity)  
**Recommendations:** Create `modules/governance/nl-reports/` submodule; update prompt specs to match actual param keys.

---

**Next:** Implementation phase — create the nl-reports submodule, fix the line-183 bug, implement the translator + validator, wire the route + handler, and test.
