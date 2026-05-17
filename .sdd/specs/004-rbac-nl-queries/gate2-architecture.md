# GATE 2 Architecture Validation — 004-rbac-nl-queries

**Validator:** Architecture (004)
**Date:** 2026-05-17
**Status:** **FAIL** — 1 CRITICAL, 2 HIGH, 4 MEDIUM, 3 LOW

GATE 2 passes only when CRITICAL=0 and HIGH=0. The spec is largely sound but has one accuracy defect that will break the implementation if not fixed, plus two design choices (rollout-flag pattern and optional-arg threading) that warrant explicit hardening in the spec before Phase 8.

---

## Verdict

The core architectural decisions are defensible:

- Extending `ReportRunContext` (one central change) is the right place to plumb scope — the alternative (passing scope as a second arg to every runner) would touch the same 12 surfaces with more churn.
- The "check eligibility in `runReport` BEFORE invoking the runner" gate is the **right design** for catching forget-to-call-applyAuthScope bugs (Finding 2).
- Colocating `scopeEligibility` with each `ReportDefinition` beats a top-level matrix (Finding 3).
- Cache-key extension semantics are correct (Finding 5).
- 12 reports, 4 RBAC personas in scope, 1 endpoint touched — complexity-5 self-assessment is accurate (Finding 8).

The blocker is **Finding 1**: the spec references persona codes (`ST-ACAD-HOD`, `ST-FAC`, `ST-CLUSTER-HEAD`) that do not exist in `backend/src/shared/rbac/personas.ts`. The actual codes are `F-HOD`, `F-FAC`, and `ST-ADM-AO-CH`. This is not a polish issue — the Persona × Report matrix (§3) and ACs (Stories 1, 2, 4) are written against non-existent codes, so any test harness or seeded user built from the spec will use wrong identifiers. The defect must be corrected before implementation begins.

The two HIGH items (rollout-flag proliferation, optional-arg vs sentinel) are architecturally salvageable as-is, but the spec should explicitly document the chosen pattern as a precedent for future RBAC-enables.

---

## Findings by Severity

### [CRITICAL-1] Persona codes in the spec do not exist in `personas.ts`

**Location:** `spec.md` §2 Story 1, Story 2, §3 Persona × Report matrix.

**Status:** Defect — must fix before Phase 8.

**Evidence:**
- Spec §2 Story 1: "personaType: 'ST-ACAD-HOD'".
- Spec §2 Story 2: "personaType: 'ST-ADM-AC', selfOnly: true". This one is real.
- Spec §3 matrix rows: `ST-ACAD-HOD`, `ST-ADM-AC`, `ST-FAC`, `ST-CLUSTER-HEAD`.
- Actual codes in `backend/src/shared/rbac/personas.ts`:
  - HOD → `F-HOD` (line 65). `defaultRole: 'hod'`.
  - Faculty → `F-FAC` (line 66). `defaultRole: 'faculty'`.
  - Admissions counsellor → `ST-ADM-AC` (line 96). `defaultRole: 'staff'`. **This one matches.**
  - Cluster head → `ST-ADM-AO-CH` (line 110). `defaultRole: 'staff'`. (There is no generic `ST-CLUSTER-HEAD` — `ST-ADM-AO-CH` is the admissions-officer cluster head; academic-side cluster headship is `ST-ACOPS-AC` per Strategic Gap 7.)
- The 003 test fixture `nl-report-routes.test.ts:56` already uses `'ST-ACAD-HOD'` — but this is a test-side fiction, not a registered persona. It works there only because the test asserts a 403; the persona type is never resolved against the policy DB.

**Why this is CRITICAL not MEDIUM:**
- §3 matrix's whole purpose is to declare which `(role, personaType, report)` cells map to `supported` vs `refused`. If the personaType strings don't exist, the eligibility-check codepath has no users to evaluate against — every Phase 8 integration test built off the matrix will reference a phantom code.
- The `seedUsersAndPolicy.ts` helper described in §10.8 must seed real persona codes that `evaluateAccess()` will match, otherwise the `authorize('governance', 'read')` middleware can't grant access to non-admins at all and Stories 1/4 collapse to 403s.
- The `resolveUserScope()` function (lines 51–61) keys on `role === 'hod'` or `role === 'faculty'`, **not** on personaType. So an HOD user has `{ role: 'hod', personaType: 'F-HOD' }`. The spec's `personaType: 'ST-ACAD-HOD'` would not even trigger department resolution.

**Remediation:**

Update §2 + §3:

| Spec code | Real code | defaultRole | Notes |
|-----------|-----------|-------------|-------|
| `ST-ACAD-HOD` | `F-HOD` | `'hod'` | Department-scoped academic head. |
| `ST-ADM-AC` | `ST-ADM-AC` ✓ | `'staff'` | Admissions counsellor; the only correctly-named code in the spec. |
| `ST-FAC` | `F-FAC` | `'faculty'` | Teaching faculty. |
| `ST-CLUSTER-HEAD` | `ST-ADM-AO-CH` (and/or `ST-ACOPS-AC` for academic cluster head) | `'staff'` | Spec should pick one; admissions cluster head is the cleaner v1 example. |

Also: §3 row 1 should add `principal` / `L-PRIN` to the admin-equivalent bucket. Today the dev token uses `role: 'super_admin', personaType: 'L-PRIN'` (see `authenticate.ts:20`). If the spec treats `principal` as scoped (it shouldn't be — principal is full-college read), that's a second-order surprise.

---

### [HIGH-1] Rollout flag pattern: `RBAC_NL_ENFORCE` invents a new flag namespace per endpoint with no governance

**Location:** spec.md §10.6.

**Status:** Architecturally defensible but unrescriptive.

**The claim:** `RBAC_NL_ENFORCE` mirrors `RBAC_ENFORCE` for ABAC rollout — same env-var pattern, restart-to-flip.

**The risk this hides:**

`RBAC_ENFORCE` is the master switch on `authorize()` middleware (line 21). It already gates whether non-admin paths see policy-based access at all. 004 introduces a second flag layered on top — the route goes through `authorize()` (governed by `RBAC_ENFORCE`) and **then** through an additional gate (governed by `RBAC_NL_ENFORCE`). Two failure modes follow:

1. **State explosion.** The four (RBAC_ENFORCE, RBAC_NL_ENFORCE) combinations have different semantics:
   - `(false, *)` — pass-through on authorize, dev mode default. NL endpoint still gated by `requireRole`. Today's behavior.
   - `(true, false)` — production with ABAC but NL hard-gated to admin. Today's intended production posture once 003 rolls out.
   - `(true, true)` — production with NL open to scoped personas. The 004 target state.
   - `(false, true)` — non-sensible: authorize is a pass-through, so any persona reaches NL without any policy check. The spec needs to call this out and either disable the combo or document it.

2. **Precedent.** Strategic Gap 4 Phase B is going to introduce 9 more report runners (defaulter-list, attendance, faculty workload, …) — each of which may want non-admin access. If each gets its own `RBAC_<X>_ENFORCE` flag, the platform accumulates dead env vars indefinitely. Worse: the next contributor will copy the 004 pattern and create `RBAC_DEFAULTER_ENFORCE`, `RBAC_ATTENDANCE_ENFORCE` etc. — no central place to track which are live.

**Why HIGH not MEDIUM:**

The spec presents this as "mirrors `RBAC_ENFORCE` for ABAC rollout" — implying the precedent already exists. But `RBAC_ENFORCE` is the master switch (one flag governs the whole authorize middleware). 004 is the first **per-endpoint** flag. That's a new pattern, and the spec should either:
- (a) Defend the per-endpoint approach explicitly. "Yes, future endpoints will each get their own flag because rollout risk profiles differ; flags will be removed via a cleanup ticket after 60 days production-stable." This is a perfectly fine answer but it has to be stated.
- (b) Use a generic flag like `RBAC_NON_ADMIN_REPORTS_ENFORCE` or `RBAC_SCOPED_QUERIES_ENFORCE` that future endpoints inherit. Cheaper long-term.
- (c) Piggyback on `RBAC_ENFORCE` — if it's already on, NL is open to scoped personas. This is the **tightest** option but loses the ability to roll back NL independently if a scope-leak bug ships.

Without picking, the spec lets each future RBAC-enable invent its own naming convention. That's a future-debt mistake.

**Remediation:**

Add to §10.6:

> "Per-endpoint flag rationale: NL is the only endpoint where mistaken scope-leak is high-blast-radius (LLM-generated aggregation = unbounded query shape). Existing module endpoints already use `applyAuthScope()` in service-layer list functions and are governed solely by `RBAC_ENFORCE`. 004 is therefore a one-off; future scoped-aggregation endpoints (NL or otherwise) will reuse `RBAC_NL_ENFORCE`, not invent new flags. Cleanup ticket J-XXX schedules removal of `RBAC_NL_ENFORCE` 60 days post-rollout once production is stable, after which scope enforcement is permanent."

This pins the precedent (one flag, not many) and gives the flag a sunset.

---

### [HIGH-2] `authScope` optional-arg threading: silent-miss risk is mitigated but not provably eliminated

**Location:** spec.md §3 ("Scope Threading"), §7 risk row 1.

**Status:** Design is OK in principle; spec's mitigation is necessary but not sufficient.

**The claim:**

`ReportRunContext` extends from `{ collegeId }` to `{ collegeId, authScope? }`. A runner that forgets `applyAuthScope` can never be invoked with a non-admin scope, because `runReport` checks `scopeEligibility` BEFORE invoking and throws `ScopeNotSupportedError` on mismatch.

**Why this is right (the mitigation works):**

If `student-roster-snapshot.scopeEligibility = { departmentOnly: 'supported' }` and the HOD's `authScope.departmentOnly === true`, `runReport` admits the call. The runner now MUST honor it. But: the eligibility check is binary — "this report supports `departmentOnly`". It does not verify the runner actually merged the scope into its `$match`. A runner that declares `supported` and forgets the helper call returns the WHOLE college's roster. Silent scope leak.

**Why it's still a risk (the gap):**

- The integration tests in §10.8 are the only line of defense against silent forgetting. If a future Phase B runner declares `departmentOnly: 'supported'` but is launched without an integration test for the HOD path, the gap reopens.
- The optional `?` on `authScope?: AuthScope` means runners can ignore it and TypeScript won't complain. No compile-time guard.

**Spec mitigation that exists (and works):**

- Section 11 GATE 3 audit explicitly verifies "no runner reads ctx.authScope and silently ignores it." Good, but this is an audit checkpoint, not a code-level guard.

**What would harden this:**

Option (a): make `authScope` required in the type, use a sentinel `ADMIN_FULL_SCOPE = { departmentOnly: false, selfOnly: false, … }` for admin paths. Every runner is forced to consult it (even if the consultation is a no-op for admin).

Option (b): keep `authScope` optional but require runners that declare `scopeEligibility.<dim> = 'supported'` to import a `MUST_HONOR_SCOPE` brand type that wraps their match dict. Compile-time enforcement.

Option (c): the spec's pragmatic answer — leave it optional, rely on `runReport` eligibility gate + integration tests. This is what 004 ships.

**Verdict on the chosen design:**

(c) is defensible **for v1's 3-runner footprint** because Phase 8 implements them all in one PR with their tests. The risk activates in Phase B as new runners land one-at-a-time. The spec should make the Phase B contract explicit:

> "Every runner that declares `scopeEligibility.departmentOnly !== 'admin-only'` or `scopeEligibility.selfOnly !== 'admin-only'` MUST ship with an integration test in `__tests__/<runner>-rbac.test.ts` that seeds 2 tenants × 2 personas and asserts the persona sees only their authorized rows. This is enforced by CI test-pattern check (TODO: spec the regression guard)."

Without this, Phase B drift is inevitable.

**Why HIGH:**

The spec frames this as the central architectural commitment (§3, "One central change") but understates the contract Phase B authors will live under. A small additional clause in §4 ("Out of Scope") or §10 closes the gap.

---

### [MEDIUM-1] `scopeEligibility` map placement: spec's choice is right, but the matrix readability cost grows

**Location:** spec.md §3 "Scope-eligibility declarations (v1)".

**The choice:** colocate `scopeEligibility: { departmentOnly: 'supported'|'admin-only', selfOnly: 'supported'|'admin-only' }` on each `ReportDefinition` in `report-registry.ts`.

**The alternative:** a top-level `PERSONA_REPORT_MATRIX` config — a 2-D matrix of `{ persona × reportCode → 'supported' | 'refused' | 'admin-only' }`.

**Why colocation is right:**

- The eligibility judgement is **a property of the report's data shape** (does Inquiry have a clean `departmentId`? — no, so `admissions-funnel.departmentOnly = 'admin-only'`). It's not a property of the persona. The matrix-style alternative invites the wrong question ("which reports can an HOD see?") when the right question is ("does this report's collection have the right scope-friendly field?").
- Adding a new report = adding one declaration on the new definition. Adding to a matrix = touching a separate config file that's already crowded.
- The frontend's per-persona `supportedReports` list can be computed from the colocated declarations (Story 4 AC#1) — no separate config needed.

**The cost (where it becomes uncomfortable):**

The eligibility cells are 2-D today (`departmentOnly × selfOnly`). The spec already hints at a future programme dimension (OQ-1) and at multi-dimensional scope (§4 item 6 explicitly defers it). If `scopeEligibility` later grows to 4–6 dimensions per report × 12 reports = 48–72 cells, the colocated form gets noisy. The matrix-style form would centralize the noise.

**Recommendation:**

Keep the colocated form for v1. Add a §10 note:

> "If `scopeEligibility` ever grows past 3 dimensions, evaluate moving to a `PERSONA_REPORT_MATRIX` config keyed by `(scopeDimension, reportCode)`. v1's 2 dimensions × 12 reports = 24 cells is well below that threshold."

This anchors the trigger condition.

---

### [MEDIUM-2] Refusal taxonomy `report-not-scopable-for-role` may collide with `policy-denied`

**Location:** spec.md §10.7.

**Status:** Definitional ambiguity, defensible but fix in spec.

**Three refusal modes the user can experience (after 004 lands):**

1. **`authorize('governance', 'read')` returns 403.** Policy DB denies module access. Pre-LLM, no NL cost. (Today's behavior for non-admin; will be the new behavior for student/parent.)
2. **`runReport` throws `ScopeNotSupportedError` → refused: `report-not-scopable-for-role`.** LLM matched a report whose `scopeEligibility` doesn't admit the persona's scope. Post-LLM cost charged.
3. **Phase B unimplemented → refused: `report_run_failed`** (existing).

The spec's new reason (`report-not-scopable-for-role`) is distinct from `policy-denied` (which today doesn't exist as a named reason — it's an HTTP 403, not an in-band refusal). The naming is fine, but two adjacent concepts could confuse users:

- **A) "Your role can't read this dimension"** (your authScope says departmentOnly, but the report has no scope-friendly field) → `report-not-scopable-for-role`. This is what 004 emits.
- **B) "This report doesn't expose any data your role is authorized to query"** (your authScope says selfOnly, but the report aggregates over data that has no `assignedTo`-style field) → same `report-not-scopable-for-role` today.

The spec conflates these. A counsellor asks "show me admissions funnel" and gets refused for reason A; an HOD asks the same question and gets refused for reason B. Both report `report-not-scopable-for-role`. The UI cannot distinguish.

**Why MEDIUM not LOW:**

The end-user-facing copy needs different language for "you personally don't have access" vs "no one in your role would have meaningful access". A future Story 4 follow-up will discover this.

**Remediation:**

Split into two reasons (or add a `dimension` field):

```
report-not-scopable-for-role: {
  dimension: 'department' | 'self',
  reason: 'no-scope-field' | 'role-not-eligible'
}
```

Or just two reason codes: `report-no-scope-field` and `role-not-eligible-for-report`. The current `report-not-scopable-for-role` becomes a union of both.

Defer to v1.5 is acceptable if §10.7 documents the conflation explicitly.

---

### [MEDIUM-3] Cache key extension semantics are correct but the spec under-specifies cross-tenant boundary

**Location:** spec.md §10.4, §7 risk row 5.

**The chosen key:** `(collegeId, role, scopeFingerprint, masked question)` where `scopeFingerprint = ${departmentId ?? '-'}:${personId ?? '-'}`.

**Verifying the cache-semantic claims:**

- **Two HODs in the same department, same question:** they share `(collegeId, 'hod', '<deptB1>:-', 'who is in my department?')`. Same authorized row-set, same scope, same result. **Sharing is correct.** ✓
- **Two HODs in different departments, same question:** different `scopeFingerprint` → different cache keys. **Correct.** ✓
- **Two counsellors with different `selfOnly.userId`, same question:** their scopeFingerprints have different `personId` segments → different cache keys → different cached results. **Correct.** ✓
- **HOD and counsellor in the same college, same question:** different `role` segment → different cache keys. **Correct.** ✓
- **Admin and HOD in the same college, same question:** admin has `scopeFingerprint = '-:-'`, HOD has `'<deptB1>:-'` → different keys → admin sees full result, HOD sees scoped result. **Correct.** ✓

The semantics work.

**The under-spec:**

- The fingerprint key uses `personId` for selfOnly, not `userId`. But `applyAuthScope` falls back to `userId` if `personId` is undefined (line 53–54 of `apply-scope.ts`). Some personas (counsellor in particular) may have `personId === undefined` because they're staff with no Faculty/Staff record matching. Their scopeFingerprint becomes `-:-` → same as admin → **cache collision possible.**
- Spec §10.4 hardcodes `personId` but the actual scope query uses `userId` when `personId` is undefined. The fingerprint must mirror what `applyAuthScope` does to be correct.

**Remediation:**

Spec §10.4 should clarify:

```
scopeFingerprint =
  `${authScope.departmentId ?? '-'}:${authScope.personId ?? authScope.userId}`
```

This way the fingerprint mirrors the actual filter predicate.

---

### [MEDIUM-4] `runReport` mandatory vs optional `authScope` — there are no non-route callers, so mandatory would be cleaner

**Location:** spec.md §3 (call chain), runReport signature change.

**Audit result:**

I checked all callers of `runReport`:

- `backend/src/modules/governance/nl-reports/service.ts:189` — request-context, has `req.authScope`.
- `backend/src/modules/governance/report-controller.ts:48` — request-context, has `req.authScope`.
- No worker / cron / scheduled-job invocation. `backend/src/workers/` has 8 workers (fee-commitment, sms-stub, fee-pin-audit, llm-usage-weekly, email-stub, fee-alerts-cron, whatsapp-stub, lead-scoring) — none of them invoke `runReport`.

So there is no path where `runReport` is invoked without a request and hence without an `authScope`.

**Implication:**

Making `authScope` **required** in the signature would be marginally cleaner — it forces the caller to pass `req.authScope!` or a sentinel, and TypeScript catches future workers that try to invoke `runReport` without thinking about scope. But the spec's optional design works because:

- Both existing callers thread `req.authScope` (post-`authorize()` middleware, this is always defined).
- The 003 report-controller direct REST endpoint (`POST /reports/run/:code`) is already gated by `authorize('governance', 'create')` — it'll get an `authScope` for free in 004's wave, though the spec doesn't actually upgrade that endpoint (out of scope per §4 item 5).

**Why MEDIUM not LOW:**

The decision affects 12 runner signatures plus `runReport`. Changing later is touch-many-files. Choosing now matters.

**Recommendation:**

Make `authScope` **required** on `runReport`. The 003 REST endpoint passes `req.authScope!` (post-authorize, always defined). The NL service-layer call passes `authScope` from `nlQuery` opts (which becomes required as well). For tests, helpers pass an `ADMIN_FULL_SCOPE` sentinel.

This is cheap to do in v1's wave and locks the contract for Phase B.

If the spec keeps `authScope` optional, §4 should add:

> "Optional-arg on `runReport.authScope` is permitted only for backward compatibility with the existing `POST /reports/run/:code` REST endpoint (which retains its admin-only `requireRole` gate). All new callers MUST pass an `authScope`."

---

### [MEDIUM-5] Phase B compatibility for `scopeEligibility` declaration

**Location:** spec.md §3 last column "Notes", §4 item 2.

**The pattern:**

Each Phase B stub has `implementationStatus: 'phase_b'` and `run: phaseBStub`. The runners throw `PhaseBStubError`. Today they have no `scopeEligibility` declaration.

**For 004:**

Spec adds `scopeEligibility` to `admissions-funnel`, `lead-source-performance`, `student-roster-snapshot` only. The 9 Phase B stubs don't get one.

**The forward-compat question:**

When a Phase B stub gains a real runner, the developer must:

1. Replace `phaseBStub` with the real implementation.
2. Set `implementationStatus: 'implemented'`.
3. **Decide** the `scopeEligibility` and add it.

Step 3 is the easy-to-forget one. If the runner ships without `scopeEligibility`, the `runReport` eligibility check needs a default. Spec §3 implies the default is "admin-only" (via "or `undefined` → defaults to admin-only" in Story 4 AC#1). This is **safe-by-default** ✓.

**The opportunity:**

The spec could go further and require Phase B stubs to declare `scopeEligibility` at the **stub stage** (set to `admin-only` for both dims, since they always throw). This forces Phase B authors to confront the question when they un-stub: "do I keep this admin-only or open it?" — rather than having to remember to add the declaration.

**Why MEDIUM not LOW:**

Forgetting the declaration on a Phase B un-stub is exactly the silent-failure mode that 004 is designed to prevent. The default-to-admin-only fallback catches the leak, but it also defeats the unlock for the legitimate use case.

**Recommendation:**

Add to §3:

> "All Phase B stubs gain `scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' }` in 004 (placeholder values). When a stub becomes implemented, the author MUST re-evaluate these declarations as part of the implementation PR. The default-to-admin-only fallback in `runReport` is a defense-in-depth, not the primary contract."

---

### [LOW-1] Complexity score 5 — verified

**Self-assessment:** `~5 (auth touch +2, multi-component +1, integration test +1, RBAC sensitivity +1)`.

**My check:**

- Auth touch: yes, replaces `requireRole` with `authorize` + adds scope plumbing. (+2)
- Multi-component: registry + service + nl-service + controller + routes + 12 runner types. (+1)
- Integration tests: §10.8 specifies multi-persona fixtures, $match assertions, persona × report cells. (+1)
- RBAC sensitivity: row-level scope, audit, GATE 3 explicit security audit. (+1)

Total = 5. ✓ Standard 3-validator team is appropriate. No enhanced team needed.

The spec is right here.

---

### [LOW-2] Story decomposition — Story 1 cannot ship without Story 2 (they share `runReport`)

**Stories:**

1. HOD scoped NL query
2. Counsellor self-scoped NL query
3. Admin path unchanged
4. Refusal narrows `supportedReports` per persona
5. Stats endpoint persona breakdown

**Are they independently shippable?**

- Stories 1 and 2 share the same `runReport.scopeEligibility` gate. Story 1 needs `departmentOnly: 'supported'` on `student-roster-snapshot`. Story 2 needs `selfOnly: 'supported'` on `lead-source-performance`. They depend on the same `runReport`-side enforcement code, so the **infrastructure** (eligibility check + `ScopeNotSupportedError`) ships once. The **per-runner declarations** are independent — Story 1 could ship with HOD-only scope, then Story 2 adds counsellor later.
- Story 3 (admin unchanged) is a passive AC — it gates the rollout flag. Naturally ships with whichever story flips RBAC_NL_ENFORCE.
- Story 4 (refusal narrowing) depends on stories 1+2 having declared `scopeEligibility` on at least some reports, so it can't ship alone.
- Story 5 (stats `byRole`) depends on the NlReportQuery model gaining `role` + `personaType` fields. Can ship independently if those fields are added in a no-op migration — but the stats are uninteresting until 1+2 are live.

**Verdict:** Stories 1 and 2 are **co-dependent on infrastructure** but **independent on enablement**. Story 1 alone could ship if `lead-source-performance.scopeEligibility.selfOnly = 'admin-only'` (Story 2 deferred).

The spec scopes them as a v1 wave, which is the right call (less integration risk than two PRs). But the spec should note in §11 that Stories 1 and 2 are **commutable** — either can land first, the other follows in the same wave.

---

### [LOW-3] OQ-1 and OQ-2 are correctly out-of-scope

**OQ-1:** Programme as an additional scope dimension for HOD `student-roster-snapshot`. Default for v1: branch alone. ✓
- Programme would require a 3-D scope dimension that `applyAuthScope` doesn't support today (§4 item 6).
- Branch-alone is the correct minimal v1 answer.
- Defer is fine.

**OQ-2:** Behavior of in-flight requests when `RBAC_NL_ENFORCE` flips mid-flight. Default for v1: flag read once per request at request-start. ✓
- This is the natural Express-middleware behavior; no special handling needed.
- The spec's call-out is appropriate.

**Recommendation:** Move both OQs to §4 Out of Scope explicitly, or §10 Detailed Decisions with the defaults locked in. The current §9 framing as "open" misleads — they're decided.

---

## Confirmed Architecture Decisions

### 1. `ReportRunContext` extension is the right place to thread scope

The single-arg-shape change in §3 covers all 12 runners (and any future ones) with one type-system update. The alternative — adding `authScope` as a second positional arg to every `run()` — would also work but creates 12 ripple-edit points instead of 1.

### 2. `runReport` eligibility gate BEFORE invocation is the correct defense

`runReport` checks `scopeEligibility` against the persona's `authScope` flags and throws `ScopeNotSupportedError` before invoking the runner. This means:

- A runner that **forgot** `applyAuthScope` but declared `scopeEligibility = 'admin-only'` is never invoked with a non-admin scope. ✓
- A runner that declared `scopeEligibility = 'supported'` and **forgot** the helper call is still vulnerable. The integration tests in §10.8 are the line of defense — see HIGH-2.

The eligibility-check-first design closes the most common error mode. The spec's framing is correct.

### 3. Colocated `scopeEligibility` is correct for 2-dim, 12-report scale

Eligibility is fundamentally a property of the report's data shape, not the persona. Colocation with `ReportDefinition` is the right home.

### 4. Cache key extension with `(role, scopeFingerprint)` is semantically correct

Two HODs in the same department sharing a cache hit is the right behavior (same row authorization → same result). The fingerprint shape needs a tweak (MEDIUM-3) but the principle holds.

### 5. Audit + persistence additions (§10.5) are minimal and correct

Adding `role`, `personaType`, `authScopeApplied` as optional fields on `NlReportQuery` is backward-compatible (existing docs have them undefined) and gives Story 5 (`byRole` facet) the data it needs without migration.

---

## Test Coverage Notes

1. **Persona codes in fixtures must match registry.** Critical-1's remediation must propagate to §10.8's `seedUsersAndPolicy.ts` — every seeded user gets a real persona code (`F-HOD`, `F-FAC`, `ST-ADM-AC`, `ST-ADM-AO-CH`).
2. **Multi-tenancy integration tests.** §5 NFR claims "verified by integration test against a 2-tenant fixture." The fixture should explicitly include rows in tenant A that the persona in tenant B would otherwise be authorized to see — proving the `collegeId` filter still bounds before scope filter applies.
3. **Cache-collision tests.** Add an explicit test that two HODs in the same department hit the same cache entry, and that an HOD and a counsellor (same college) do NOT.
4. **Phase B leak guard.** Add a regression-guard test that walks all `ReportDefinition`s with `implementationStatus: 'implemented'` and asserts each has a `scopeEligibility` declared (rejects undefined). This prevents the silent default-to-admin-only trap.
5. **Refusal-reason coverage.** Test that `report-not-scopable-for-role` fires for both (a) `departmentOnly` mismatch and (b) `selfOnly` mismatch — to validate MEDIUM-2's recommendation if it's deferred.

---

## Sign-off

**Status:** FAIL.

**Blockers:** 1 CRITICAL (persona-code accuracy), 2 HIGH (rollout-flag governance, optional-arg contract).

**Required before Phase 8:**

1. Fix Critical-1: replace persona codes throughout §2, §3, §10.8 with real codes from `personas.ts`. Confirm the matrix is internally consistent with `resolveUserScope` (which keys on `role`, not `personaType`).
2. Address High-1: add a §10.6 paragraph defending the per-endpoint flag pattern AND specify the flag's sunset / cleanup ticket. Or pick a generic flag name to inherit for future scoped-aggregation endpoints.
3. Address High-2: add a paragraph in §3 or §4 making the "every `scopeEligibility !== 'admin-only'` runner ships with an RBAC integration test" contract explicit for Phase B.

**Recommended (defer-able):**

- Medium-1: 2-D matrix is fine at 12 reports; note the trigger condition for re-evaluation.
- Medium-2: split or sub-categorize `report-not-scopable-for-role` so UI can differentiate dimension-not-exposed vs role-not-eligible.
- Medium-3: tweak `scopeFingerprint` to use `personId ?? userId` to mirror `applyAuthScope`.
- Medium-4: consider making `authScope` required on `runReport` — there are no non-route callers today, so this is cheap and locks the contract.
- Medium-5: have Phase B stubs declare placeholder `scopeEligibility: admin-only` rather than rely on the default-fallback.
- Low-3: move OQ-1 / OQ-2 to §4 or §10 with locked defaults.

Once Critical-1 and the two HIGHs are resolved, this spec is ready for GATE 2 PASS and Phase 8 implementation.

---

**Next:** Spec author addresses blockers → re-validate (single re-read, no new audit needed for the 3 must-fix items) → Phase 8 starts.
