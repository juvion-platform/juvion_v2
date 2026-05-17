# GATE 2 Data-Layer Validation — 004-rbac-nl-queries

**Validator:** Data-layer (GATE 2)
**Feature:** 004-rbac-nl-queries
**Date:** 2026-05-17
**Status:** **FAIL** — 2 CRITICAL, 3 HIGH, 4 MEDIUM, 2 LOW

GATE 2 PASS requires CRITICAL=0 AND HIGH=0. This review fails on both axes.

> **Validator note:** `.sdd/specs/004-rbac-nl-queries/spec.md` did **not exist** on disk at validation time (only the empty directory was present). This review is grounded against the inline spec summary in the task prompt + the actual code under `backend/src/shared/rbac/`, `backend/src/modules/governance/`, and `backend/src/models/`. If the on-disk spec ends up materially differing from the prompt's summary, re-run the gate.

---

## Verdict

**FAIL.** Two CRITICAL findings (C-DATA-1: HOD `departmentId` semantic mismatch with `Student.branchId`; C-DATA-2: silent scope-leak when `applyAuthScope` receives `departmentOnly: true` with `departmentId` undefined) prove the spec's assumption that authScope can be dropped into the existing aggregations as a `$match` mutation is incorrect for the dominant runner (`student-roster-snapshot`). Three HIGH findings concern eligibility-gate ordering (Q6), the `selfOnly` self-field choice for `lead-source-performance` (legacy string vs canonical ObjectId), and the dedup-cache extension that must include `(departmentId, personId)` not just `(role, scopeFingerprint)` to avoid cross-persona response leakage. Address all five before re-running GATE 2.

---

## Findings

### C-DATA-1 — CRITICAL — `departmentId` vs `branchId`: type-incompatible mapping in `student-roster-snapshot`

**Where:** Spec §3 example proposes `applyAuthScope(match, authScope, { departmentField: 'branchId' })` for the `student-roster-snapshot` runner.
**Risk:** Scope leak. HOD sees zero rows (no leak — but feature is broken) OR, worse, sees ALL students (full leak) when `departmentId` is undefined.

**Code reality:**
- `AuthScope.departmentId` is resolved by `backend/src/shared/rbac/scope-resolver.ts:51-61`: for `role: 'hod' | 'faculty'`, it loads `Faculty.findOne({ personId, collegeId })` and pulls `faculty.departmentId`. `Faculty.departmentId` is `Schema.Types.ObjectId, ref: 'Department'` (`backend/src/models/people/Faculty.ts:101, 198`).
- `Student.branchId` is `Schema.Types.ObjectId, ref: 'Branch'` (`backend/src/models/people/Student.ts:83, 148`). It is **not** a Department ObjectId — it points to a `Branch` document.
- `Branch.departmentId` (the bridge) is itself a separate ObjectId (`backend/src/models/academic-structure/Branch.ts:13`).

Setting `match.branchId = authScope.departmentId` therefore compares a `Department._id` against `Student.branchId`, which is a `Branch._id`. The two collections will share no overlapping ObjectId values in real data. Result: every HOD running `student-roster-snapshot` will see **zero rows** — but with `departmentId: undefined` (e.g., HOD persona without a seeded `Faculty` row), `applyAuthScope` no-ops (next finding C-DATA-2) and the HOD sees **the entire college's roster**. The same HOD that nominally was "department-scoped" will return everyone, including departments they have no authority over.

**Fix (must land in spec before implementation):**
1. The runner must compute the set of branches that belong to the HOD's department:
   ```typescript
   // pseudocode for student-roster-snapshot runner with authScope
   const branchIdsForDept = await Branch.find(
     { collegeId: cidObj, departmentId: new Types.ObjectId(authScope.departmentId) },
     { _id: 1 }
   ).lean();
   match.branchId = { $in: branchIdsForDept.map(b => b._id) };
   ```
   This is a 2-stage query, not a single `applyAuthScope(... { departmentField: 'branchId' })` call. The current `applyAuthScope` helper cannot express it because the field-name mapping it offers presumes the FK collection and the AuthScope have the same id.
2. Alternative (faster, requires migration): denormalise `departmentId` onto `Student` so a single `match.departmentId = authScope.departmentId` works. **Out of scope for v1** but should be acknowledged in §10 as the proper long-term shape — the join-via-Branch approach above is correct for v1 but adds a non-zero per-call lookup.
3. Either way, `applyAuthScope(match, authScope, { departmentField: 'branchId' })` as written in the prompt **is wrong** and must not ship.

**Severity:** CRITICAL — silently incorrect aggregation OR (when `departmentId` is unresolved) a full scope leak. The blast radius is everyone in the college.

---

### C-DATA-2 — CRITICAL — `applyAuthScope` short-circuits silently when `departmentId` is undefined

**Where:** `backend/src/shared/rbac/apply-scope.ts:41-44`
```typescript
if (authScope.departmentOnly && authScope.departmentId) {
  const field = opts?.departmentField ?? 'departmentId';
  filter[field] = authScope.departmentId;
}
```

**Risk:** Scope leak via misconfigured persona. A HOD user whose `Faculty` record is missing or doesn't carry `departmentId` (per `scope-resolver.ts:51-61`, lookup gracefully degrades to "no departmentId in scope") will hit this branch with `departmentOnly: true` and `departmentId: undefined`. The condition fails, **no filter is added**, and the aggregation returns the whole college's data scoped only by `collegeId`. The HOD sees everyone.

The existing `applyAuthScope` test at `apply-scope.test.ts:26-31` even documents this behaviour ("does not add departmentId when departmentOnly but no departmentId resolved") as if it were desirable. It is not — for query mutation, "no filter" means "return everything", which is precisely the wrong default for a scope-restricted persona.

**Why this matters more for 004 than for 003:** Existing `applyAuthScope` callers (M03 academics, M06 welfare) operate over `find()` filters where, in practice, every model the HOD-scope hits has a column that the HOD already has narrow data for, so leakage damage is bounded. For NL queries the surface is wider: a HOD types "show me all student-roster" and `student-roster-snapshot` returns every student in the college if their `departmentId` resolution silently failed at login.

**Fix:** The 004 spec **MUST** state — and the runner-eligibility check (§3 in spec / §6 in this gate) **MUST enforce** — a hard refusal when:
1. The runner declares `departmentOnly: 'supported'` AND the policy has `scope.departmentOnly: true` AND `authScope.departmentId` is undefined → refuse with `reason: 'scope_unresolved'` (or similar). Don't run the report.
2. Same for `selfOnly`: refuse when `selfOnly: true` and `authScope.personId` is undefined (selfField wants `personId`) or `authScope.userId` empty.

This refusal must be inside `runReport` before the runner is invoked (also see H-DATA-1 below), not inside the runner — placing it in the runner risks the next runner forgetting it.

**Severity:** CRITICAL — silent scope leak triggered by data quality issues that production will hit (HODs whose Faculty record was loaded before the `departmentId` column was populated, audit refusing roles assigned by spreadsheet ops).

---

### H-DATA-1 — HIGH — `ScopeNotSupportedError` must be raised BEFORE `runReport` invokes the runner

**Where:** Spec §3 and §6 in the task prompt.

The prompt states: "if a non-admin still triggers it (refusal happens AFTER LLM call), the eligibility check in `runReport` MUST happen BEFORE invoking the runner." This is correct as a requirement, but the current `runReport` (`backend/src/modules/governance/report-service.ts:49-101`) does:
1. `getDefinition(code)` — throws 404 if missing.
2. `ReportRun.create({ status: 'running', ... })` — writes a placeholder doc.
3. `def.run(...)` — calls the runner.

There is no current hook between step 1 and step 2 where `authScope` could be inspected against the runner's declared scope-eligibility. The spec must:
1. Move the scope-eligibility check **before** step 2 (the placeholder `ReportRun.create`). Otherwise, every refused NL query persists a stale `running` ReportRun document that never transitions to `failed`/`unimplemented` — orphaned rows in production. (Worse, the `running` state is queried by `report-service.listRuns()` and shown in the admin UI history as "in flight".)
2. Make scope-eligibility a **declarative property** of `ReportDefinition` (e.g., `scopeEligibility: { departmentOnly: 'admin-only' | 'supported'; selfOnly: 'admin-only' | 'supported' }`), so the check is a pure-function test against `authScope` — no runner-specific code paths.
3. Specify the new error class explicitly (`ScopeNotSupportedError`) and how `runReport` propagates it to the NL service (which converts it to a `refused` response).
4. Add a test that fails if a future runner is added without declaring its scope eligibility — TypeScript can enforce this with a discriminated union on `scopeEligibility`.

**Why HIGH not CRITICAL:** The leak happens only when steps 2-3 ran before step "eligibility check" — but the writes happen and the runner executes. If the LLM cap allowed the call and the runner reads the database (some Phase B stubs throw early), the read has already happened and audit logs are written. A non-admin who triggers this gets a refused response, but the underlying query already touched data. The proposed refusal must happen synchronously before `def.run` is invoked.

---

### H-DATA-2 — HIGH — `lead-source-performance` selfOnly via `assignedTo` (string) is brittle AND mis-keyed today

**Where:** Spec §10.1 of the task prompt claims `lead-source-performance` declares `selfOnly: 'supported'` via the `assignedTo` string field.

**Code reality:**
- `Inquiry.assignedTo: String` is the legacy field (`backend/src/models/admissions/Inquiry.ts:37, 162`). Inquiry.ts comment at lines 70-75 + 196-198 declares `assignedOfficerId` as "the canonical Person ref — newly created inquiries should write `assignedOfficerId` exclusively". Seed data writes neither (`backend/src/seed.ts:2174-2178`).
- `AuthScope.userId` is a User._id (24-char hex, e.g. `000000000000000000000099` from `backend/src/middleware/authenticate.ts:20`). `AuthScope.personId` is a Person._id resolved from `User.personId` (`scope-resolver.ts:46`).
- `Inquiry.assignedTo` historically held a string email/username (e.g. seed.ts:3050 has `'admin@jit.edu.in'`; the same string is written to `LeadImportBatch.importedBy` and `LeadInteraction.performedBy`).
- `Inquiry.assignedOfficerId: { type: Schema.Types.ObjectId, ref: 'Person' }` — already indexed at `{ collegeId: 1, assignedOfficerId: 1, status: 1 }` (Inquiry.ts:236).

Issues:
1. **Self-field choice is wrong.** Using `selfField: 'assignedTo'` with `AuthScope.userId` (a 24-char hex User._id) will never match the legacy email-string format. Even setting `selfField: 'assignedTo'` with `personId` would fail because personId is also a hex ObjectId, not an email.
2. **The canonical field exists.** The selfOnly mapping for Inquiry should target `assignedOfficerId` and key on `authScope.personId` (since `assignedOfficerId` is a Person ref). This is also already indexed.
3. **Hybrid problem.** Some live inquiries may have only `assignedTo` populated (pre-Gap 5 data), so a strict `assignedOfficerId` filter would silently miss them. The spec must commit to one of:
   - Backfill rule: run a one-time migration to map `assignedTo` → `assignedOfficerId` by email lookup, then enforce `assignedOfficerId` only.
   - Dual-path filter: `{ $or: [{ assignedOfficerId: personObjId }, { assignedTo: userEmail }] }` — but `userEmail` isn't on `AuthScope`, requires a second lookup, and `assignedTo` isn't indexed, so this would scan.
   - Declare selfOnly `'admin-only'` for `lead-source-performance` in v1 until the migration is done.

The task prompt's §10.1 says "the legacy-string vs canonical-ObjectId uncertainty" is "documented" — confirmed. Recommend the spec choose **option 3** (admin-only for v1, plus a migration ticket) for safety; the dual-path alternative is too fragile.

**Severity:** HIGH — without this clarification, the implementation will pick one and the spec's stated "selfOnly: supported" claim is unenforceable. If implementer picks (1) without migration, every counsellor (the actual self-Only target) sees zero rows. If (2), they get inconsistent data depending on which records were written under Gap 5 vs before. Either way the spec promise breaks.

---

### H-DATA-3 — HIGH — Dedup cache key (§10.4 of prompt) must include `departmentId`/`personId`, not just `(role, scopeFingerprint)`

**Where:** Spec §10.4 (task prompt). Implementation at `backend/src/modules/governance/nl-reports/dedup.ts`.

**Risk:** Cross-persona response cache pollution. The current `nl-report-dedup` key is `nl-report-dedup:${collegeId}:${sha1(maskedQuestion)}` (dedup.ts:16-19). The proposed extension is `(role, scopeFingerprint)`.

Issue: two HODs from the **same role** in **different departments** (CSE HOD vs ECE HOD) typing the same question — e.g., "how many active students" — would have the same `(collegeId, role, maskedQuestion)`. Without `departmentId` in the fingerprint, the cache returns the first HOD's pre-scoped results (which include only their department) to the second HOD.

**Fix:** The fingerprint must include all scope-affecting fields:
```
fingerprint = sha1(`${role}|${personaType}|${departmentId ?? ''}|${personId ?? ''}|${selfOnly ? '1' : '0'}|${departmentOnly ? '1' : '0'}`)
```
and the cached payload must store the scope it was computed under so a hash collision doesn't leak data even theoretically.

Also: the existing dedup.ts caches the matched `results` field which is the report's row payload — that payload is already scope-filtered. So mixing scopes via cache miss is a real (not theoretical) cross-tenant-within-college leak. Treat as HIGH.

**Severity:** HIGH — cross-persona data exposure when two same-role users in different departments type semantically identical questions.

---

### M-DATA-1 — MEDIUM — `admissions-funnel` is correctly declared `departmentOnly: 'admin-only'` but the prompt's question deserves a more permissive answer

**Where:** Spec §3 — `admissions-funnel` declared `departmentOnly: 'admin-only'` because Inquiry has no `departmentId`.

**Question asked:** Could `branchInterest` (string) match against the HOD's branch name?

**Answer: No — too brittle for v1.**
- `Inquiry.branchInterest` is a free-text `String` (`Inquiry.ts:33, 111`). Seed values use `'CSE'`, `'ECE'`, `'MPC'`, etc. (`seed.ts:2175-2177`) — these are NOT FK references to `Branch.code` or `Branch.name`. They're effectively interest-tags written by the inquiry intake form.
- Even where data is well-formed, matching `branchInterest === Branch.code` requires loading the HOD's branch(es) (multi-branch HODs exist where a department owns multiple programmes/branches), then case-folding the comparison. `Branch.code` could be `'CSE'` or `'CS'` depending on the institution.
- `admissions-funnel` is a 3-collection rollup (Inquiry + Applicant + Admission, see `report-registry.ts:124-156`). Of those, only Inquiry has `branchInterest`. Applicant has `branchPreference1` (via spec ref but not verified here) and Admission has no branch field at all. The rollup can't be department-scoped consistently across all three.

Confirm `'admin-only'` for v1. Document that Phase B may add a `branchId` to Inquiry (already proposed in §3 spec discussion?) or compute department scope via the conversion chain (Inquiry → Applicant → Admission → Student.branchId).

**Severity:** MEDIUM — affects feature coverage, not correctness. The spec already gets this right; this finding confirms the choice.

---

### M-DATA-2 — MEDIUM — `student-roster-snapshot` index missing for `(collegeId, branchId, status)`

**Where:** Spec §10.2 — proposes new compound indexes.

**Code reality:** Student model (`backend/src/models/people/Student.ts:181-184`) currently has:
- `{ collegeId: 1 }` (field-level, line 117)
- `{ collegeId: 1, rollNumber: 1 }` unique sparse (line 181)
- `{ 'feePins.feeStructureInstanceId': 1 }` sparse (line 184)

There is **no** index on `(collegeId, branchId, status)`. With ~1k-30k students per college, the `student-roster-snapshot` aggregation will scan-and-group on the only `collegeId` index. For the HOD-scoped case (after C-DATA-1 is fixed), the runner needs `(collegeId, branchId, status)` to be index-friendly.

**Proposed new index (per spec §10.2):**
```typescript
schema.index({ collegeId: 1, branchId: 1, status: 1 });
```
No duplication with existing indexes. Recommend adding.

For Inquiry, `lead-source-performance` benefits from `{ collegeId: 1, createdAt: -1 }` since the runner's first stage is `$match: { collegeId, createdAt: { $gte, $lte } }`. No such index exists today (lines 232-246 list 7 indexes, none on `createdAt`). Adding it would help with both the existing flow and the future HOD-scoped path.

**Severity:** MEDIUM — perf concern, not correctness. The aggregations will produce correct results but at higher scan cost.

---

### M-DATA-3 — MEDIUM — Test seeding plan (§10.8 of prompt) needs more than a multi-persona helper

**Where:** Spec §10.8 — proposes a multi-persona test helper.

For `resolveUserScope` to produce a proper `AuthScope` for a seeded HOD, the test fixture must:
1. Insert a `User` with `role: 'hod'`, `personaType: 'F-HOD-CSE'` (e.g.), and `personId: <person._id>`.
2. Insert a `Person` document for that personId.
3. Insert a `Faculty` document with `{ personId, collegeId, departmentId: <dept._id> }`. **This is the load-bearing step** — `scope-resolver.ts:51-54` is the only thing that resolves `authScope.departmentId`.
4. Insert a `Department` document for departmentId (referential integrity is not enforced at the DB level but a missing Department would silently break downstream branch-by-dept lookups required by C-DATA-1's fix).
5. Insert a `Branch` document with `{ collegeId, departmentId }` so the C-DATA-1 fix's branch-lookup returns non-empty.
6. Insert `Student` documents with `{ collegeId, branchId: <branch._id>, status }` so the aggregation has data.
7. Seed the `Policy` collection with the HOD policies from `defaults.ts:23-27` (or seed default policies and let the engine find them — see `engine.ts:64-98`).
8. Either invalidate the Redis cache (`invalidateUserScope(userId)`) between tests or mock Redis (`backend/src/shared/rbac/__tests__/scope-resolver.test.ts:4-7` for the mock pattern).

A single "multi-persona helper" is the minimum; the spec should call out items 4-5 (the Department + Branch + Student linkage) because that's where most authors trip — they seed the Faculty but forget Branch.departmentId, and then the C-DATA-1 fix returns empty branch IDs and the test passes the wrong way (zero rows look like "scope worked!"). Add an integration test that asserts at least N rows visible to an HOD when the linkage is correct, and zero when departmentId is unresolved.

**Severity:** MEDIUM — fixable by spec elaboration. The risk is that the test suite green-lights C-DATA-1 incorrectly.

---

### M-DATA-4 — MEDIUM — `NlReportQuery` field additions (§10.5 of prompt) — confirm the stats $facet still works

**Where:** Spec §10.5 proposes new optional fields on `NlReportQuery`.

**Code reality:** `backend/src/models/governance/NlReportQuery.ts` and the stats aggregation at `service.ts:249-262`. The stats `$facet` pipeline projects only `status`, `selectedReport`, `costInr`, `generatedAt` — adding optional fields like `scopeApplied`, `departmentId`, `personaType`, `refusalCategory` does not affect the existing pipeline (it ignores fields it doesn't `$group` by).

Two caveats:
1. **If new fields hold ObjectIds and the spec wants to group by them** (e.g., a future "queries by department" facet), the `cidObj` pattern must be repeated for any ObjectId comparison. Document this in §10.5 if planned.
2. **Mixed `Schema.Types.Mixed` for `params`** today is fine; if 004 wants to add a `requestedScope` blob (e.g., a structured copy of the AuthScope at run time), use `Schema.Types.Mixed` again — DON'T introduce `Schema.Types.ObjectId` for `requestedScope.departmentId` because that requires another model registration and breaks the "snapshot at run time" semantics.

**Severity:** MEDIUM — easily addressable, but the spec should be explicit.

---

### L-DATA-1 — LOW — Regression-guard test passes today; 004 doesn't put it at risk

The `aggregate-collegeid-pattern` regression guard at `backend/src/__tests__/regression-guards/aggregate-collegeid-pattern.test.ts` is a **static text scan** for `$match: { collegeId,` shorthand. The current codebase has one explicit-form site (`report-registry.ts:188` post-003 rename to `cidObj`) and zero shorthand offenders. The test currently passes.

The task prompt says the guard was "red across recent runs, fixed in 003 only at one site" — verified accurate. The 003 fix was a local-variable rename so the explicit form (`collegeId: cidObj`) replaced the shorthand at the one offending site in `lead-source-performance`. The 004 spec's `applyAuthScope(match, ...)` pattern would write `match.branchId = ...` (NOT `match.collegeId`) and pass `match` as the first `$match` stage — provided that `match` was initialised with `collegeId: cidObj` (NOT the shorthand `collegeId,`), the guard remains green.

**Recommendation:** The 004 spec should include a one-line note in §3 examples making this explicit so a future author doesn't write:
```typescript
const match: any = { collegeId };  // ← regression-guard trips
applyAuthScope(match, authScope, { departmentField: 'branchId' });
await Student.aggregate([{ $match: match }, ...]);
```
when the correct form is:
```typescript
const cidObj = new Types.ObjectId(ctx.collegeId);
const match: Record<string, unknown> = { collegeId: cidObj };
applyAuthScope(match, authScope, { departmentField: 'branchId' });
```

**Severity:** LOW — won't fail unless an author regresses.

---

### L-DATA-2 — LOW — `applyAuthScope` is safe to mutate the object passed as a `$match` stage

**Where:** Spec §3 assumption — calling `applyAuthScope(match, ...)` and then using `match` as `$match`'s value works.

**Code reality:** `apply-scope.ts:35-56` mutates the passed-in object via assignment (`filter[field] = ...`). The function does **not** wrap values in `Types.ObjectId`. Two sub-claims to verify:

1. **Mutation:** Yes, the mutation form is safe. After the call, `match` carries the added keys. The downstream `$match: match` sees them.
2. **ObjectId wrapping:** The function writes raw strings (e.g., `authScope.departmentId` is a string per `types.ts:24`, set by `scope-resolver.ts:54` via `String(faculty.departmentId)`). Inside `.find({...})` Mongoose auto-casts strings to ObjectIds. Inside `.aggregate([{ $match: {...} }])`, Mongoose **does NOT auto-cast** (the bug the regression-guard exists to prevent). So `match.branchId = '<string>'` inside a `$match` will silently match zero documents.

**Recommended fix:** Either:
- The 004 implementation wraps `authScope.departmentId` in `new Types.ObjectId(...)` before passing it to `applyAuthScope` (clumsy).
- Add an option to `applyAuthScope` like `wrapAsObjectId: true` which calls `new Types.ObjectId(authScope.departmentId)` internally for aggregation callers (cleaner).
- Or: do the wrapping after `applyAuthScope` returns, in the runner:
  ```typescript
  applyAuthScope(match, authScope, { departmentField: 'branchId' });
  if (typeof match.branchId === 'string') {
    match.branchId = new Types.ObjectId(match.branchId);
  }
  ```

The spec should pick one and codify it. Without this, the aggregation will silently return zero rows for HOD queries — looks like "scope working" but is "scope wrongly returning empty". **This compounds C-DATA-1**: even if the spec switches to the Branch-by-Department two-step (`branchIds.map(b => b._id)`), the resulting `$in` array is already ObjectIds; this finding still applies to `authScope.personId` for `selfOnly` aggregations.

**Severity:** LOW — readily fixable, but cannot be skipped. Goes in §10 of the spec.

---

## What's solid

- **Storage model** (`NlReportQuery`): the 003 GATE 2 fixes (`llmModel` rename, `reason` field, `ai_nl_report_query` audit action) are landed and verified at `backend/src/models/governance/NlReportQuery.ts`, `backend/src/shared/types.ts:51`, `backend/src/shared/audit.ts:35`. 004 inherits these cleanly; new optional fields can be added without breaking the stats `$facet`.
- **Index footprint**: Inquiry has an existing `{ collegeId, assignedOfficerId, status }` index that supports the **canonical** selfOnly path for `lead-source-performance` (if H-DATA-2 is resolved by switching to `assignedOfficerId`). Adding `(collegeId, createdAt)` to Inquiry and `(collegeId, branchId, status)` to Student are non-duplicative and correctly scoped.
- **Cap-guard, prompt, parser, validator** modules are untouched by 004 — no integration risk on those surfaces.
- **`runReport` signature change is non-breaking**: the existing callers are `report-controller.ts:48` (5-arg becomes 5-arg with optional `authScope`) and `nl-reports/service.ts:189` (also 4-arg today). Adding an optional 5th positional `authScope?: AuthScope` is backward-compatible with both. Just keep the spec explicit that omitting the 5th arg = admin-equivalent semantics (full scope), to match today's behaviour.
- **Regression-guard health**: the codebase is clean of `$match: { collegeId,` shorthand. The 003 fix held, and the guard is green pre-implementation.
- **Cap-guard and idempotency** are in place at `dedup.ts` and `cap-guard.ts`; only the dedup key needs extension per H-DATA-3.
- **PII flow** is already on the right side of the LLM: `nl-reports/service.ts:117-119` masks before any LLM call and persists masked-only. No 004 work needed here.

---

## Sign-off

**Data-Layer GATE 2 Validation: FAIL** (2 CRITICAL, 3 HIGH).

PASS requires the spec to address C-DATA-1, C-DATA-2, H-DATA-1, H-DATA-2, H-DATA-3 explicitly in §10 (or equivalent remediation section), and to land the index changes in §10.2 with the corrected wrap pattern from L-DATA-2.

**Next action:** Spec author must update §3 and §10 to:
1. Replace the `applyAuthScope(match, authScope, { departmentField: 'branchId' })` pattern with the two-step Branch-by-Department lookup for `student-roster-snapshot` (or formally defer to admin-only in v1).
2. Add the runner-eligibility gate INSIDE `runReport`, BEFORE the placeholder `ReportRun.create()`, with a `ScopeNotSupportedError` propagated to the NL service.
3. Either pick `assignedOfficerId` + `personId` for `lead-source-performance` self-only (with a backfill rule), or declare it admin-only.
4. Extend the dedup-cache key to include `departmentId`/`personId`/`selfOnly`/`departmentOnly` bits, not just `(role, scopeFingerprint)`.
5. Decide on the `applyAuthScope` ObjectId-wrap behaviour for aggregation callers (helper option vs caller responsibility).

Once these land, re-run GATE 2 data-layer. Architecture and API-Sec validators should be re-engaged in parallel.
