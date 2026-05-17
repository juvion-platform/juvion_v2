# GATE 2 — API & Security Validation (004-rbac-nl-queries)

**Validator**: api-security
**Date**: 2026-05-17

## Verdict
FAIL — 2 CRITICAL, 3 HIGH, 4 MEDIUM, 3 LOW

The spec's core idea (replace hard `requireRole` with `authorize('governance','read')` + scope-aware runners) is sound, but it ships on top of a policy DB that does not currently grant the personas it claims to unlock — and grants OTHER personas more than the spec assumes. The persona × report matrix is presented as if it falls out of the existing policy seed; it does not. Without the explicit policy-seed work called out below, flipping `RBAC_NL_ENFORCE='true'` would either (a) 403 the very personas it claims to enable (HOD, faculty) or (b) silently produce **unscoped** results for staff personas (counsellor, cluster head, warden, librarian, TPO, accountant, registrar, …) because the staff base fallback policy at priority 600 grants `module: '*', action: 'read'` with no scope.

GATE 2 should not pass until C-1 is resolved in the spec.

## Findings

### [CRITICAL] F-1: Persona × report matrix is unsatisfiable against the current policy DB
**Location**: spec §3 (Persona × Report matrix, lines 118–127), §6 (Dependencies, line 152)
**Issue**: The spec claims `ST-ACAD-HOD` gets `departmentOnly`, `ST-ADM-AC` (counsellor) gets `selfOnly`, `ST-FAC` gets `departmentOnly`, `ST-CLUSTER-HEAD` gets `departmentOnly` — but none of these are actually represented in `backend/src/shared/rbac/defaults.ts`. Concretely: (a) `role: 'hod'` has zero `governance:*` policies — `evaluateAccess` returns null → `authorize` 403s every HOD. Same for `role: 'faculty'`. (b) Counsellor/cluster-head/warden/TPO/librarian are all `role: 'staff'`; the only `governance:read` policy that matches them is the base staff fallback `{ role: 'staff', module: '*', action: 'read', priority: 600 }` which has NO `scope` field, so `authorize` produces `authScope.departmentOnly=false, selfOnly=false` and the runner runs UNSCOPED. A counsellor asking "show me the student roster" gets every student in the college. Spec §6 explicitly excludes `shared/rbac/engine` changes; without seed additions, the matrix cannot be honored.
**Recommendation**: Add a new §10.9 that enumerates the exact policy rows to seed before `RBAC_NL_ENFORCE='true'` flips per-environment: at minimum `hod/governance/read { departmentOnly: true }`, `faculty/governance/read { departmentOnly: true }`, `staff ST-ADM-AC/governance/read { selfOnly: true }`, `staff ST-ADM-AO-CH/governance/read { departmentOnly: true }`, and either deny or scope the staff base fallback against governance (e.g., a `staff/governance/read` deny at higher priority than 600, or an explicit allow with `selfOnly: true` for personas the spec wants to gate out). Also explicitly state that the flag flip is gated on a "policy seed verified" check.
**Severity reasoning**: Without this, the contract in spec §Story 1–2 (HOD/counsellor scoped queries) is impossible to satisfy, and worse, the implicit contract for unlisted staff personas (TPO, warden, accountant, registrar, librarian) collapses to "unscoped governance reads" — a real information-disclosure regression vs. today's `requireRole(['admin','super_admin'])`.

### [CRITICAL] F-2: Dedup cache scope-fingerprint collapses to a shared bucket when `personId` is undefined
**Location**: spec §10.4
**Issue**: §10.4 defines `scopeFingerprint = ${authScope.departmentId ?? '-'}:${authScope.personId ?? '-'}`. But the actual scope filter for `lead-source-performance` per §10.1 uses `assignedTo === String(authScope.userId)` — i.e., it discriminates on `userId`, not `personId`. `resolveUserScope` (`scope-resolver.ts:46`) returns `personId` only if `User.personId` is populated; for a staff user without a Faculty/Staff link, it returns `undefined`. Two counsellors in the same college both with `personId=undefined` will share the bucket `-:-` while their actual scoped results differ by `userId`. Counsellor A's cached "my leads" result will be served to counsellor B within the 30s TTL.
**Recommendation**: Change the fingerprint to include `userId` whenever `selfOnly` is true (or unconditionally). Suggested form: `scopeFingerprint = ${authScope.departmentId ?? '-'}:${authScope.selfOnly ? authScope.userId : '-'}` — userId is always present in `AuthScope` per `types.ts:25`. Document explicitly that "no scope-bearing field may be undefined in the fingerprint when the corresponding scope flag is true".
**Severity reasoning**: Cross-persona scoped-result leakage inside the dedup cache is exactly the failure mode §10.4 was added to prevent; the proposed fingerprint mis-targets the right discriminator.

### [HIGH] F-3: `RBAC_NL_ENFORCE` rollout semantics are internally inconsistent
**Location**: spec §10.6, §Story 3 AC-3, §OQ-2
**Issue**: §10.6 says the flag is "read by the route at request-start" and §OQ-2 says "flag is read once per request." But §Story 3 AC-3 says "the hard `requireRole(['admin','super_admin'])` gate is restored" — `requireRole` is a different Express middleware than `authorize`; switching between them after the router is mounted requires either (a) registering both middleware stacks at module load with an env-conditional, or (b) a wrapper middleware that picks at runtime. The existing `RBAC_ENFORCE` precedent at `authorize.ts:21` reads the env **inside the middleware itself on every request** — which is the per-request semantic. Spec §10.6 does not say which pattern 004 follows; the two ACs imply different patterns.
**Recommendation**: Pick one and write it down: either (i) "module-load conditional registration" (restart-to-flip, simple), or (ii) "wrapper middleware reads env at request-start and delegates to `authorize+scope` OR `requireRole` accordingly" (live-flip per-request, matches RBAC_ENFORCE pattern). The latter is the precedent and the prompt's example asks for parity with RBAC_ENFORCE. Update §10.6 to spell out the chosen approach and update §Story 3 AC-3 to reference it.
**Severity reasoning**: Implementation ambiguity in an auth-flip path is the kind of "I thought you meant the other one" that causes a half-flipped rollout. Not data-breach-grade, but high enough to fix before code.

### [HIGH] F-4: `authorize()` 403 path returns a different response shape than NL refusals, breaking FE UX
**Location**: `backend/src/middleware/authorize.ts:39`, `admin-portal/src/components/governance/NlQueryPanel.tsx:99-141`, spec §Story 1 AC-1
**Issue**: When `authorize('governance','read')` denies (e.g., student/parent under the existing default policies), the response is HTTP 403 with `{error: 'Access denied'}`. The FE `NlQueryPanel` mutation `onError` handler at line 38 just calls `setResponse(null)` — the panel clears with no error displayed. Today's hard `requireRole` returns 403 too, but today's UI scope was "admin only" so the FE never renders the panel for denied personas. After 004, the panel will be rendered for non-admin personas (per Story 1) and silent-clear-on-403 becomes a real UX dead-end (user clicks "Ask" repeatedly, sees nothing).
**Recommendation**: Either (a) spec a small FE change to render an inline policy-denied banner on 403 (preferred; matches the §10.7 refusal-taxonomy goal), or (b) translate `authorize`-403 into a 200 with `{status: 'refused', reason: 'policy-denied'}` at the controller layer so the existing refused-banner path handles it. Document the chosen path in spec §10.7. Either way the existing test `NlQueryPanel.test.tsx` needs a new case.
**Severity reasoning**: Visible UX dead-end for the personas the feature is specifically designed to unlock. Recoverable post-ship, but a poor first impression for the rollout.

### [HIGH] F-5: `byRole` stats facet does not handle pre-004 docs where `role` is undefined
**Location**: spec §Story 5 AC-1 + AC-2, §10.5
**Issue**: §10.5 makes `role` optional on `NlReportQuery` (so pre-existing 003 docs survive). §Story 5 AC-1 declares the response shape as `byRole: Array<{ role: string, count: number, costInr: number }>` — `role` typed as `string`. A `$group` by `$role` over a collection that contains 003 docs (where `role` is undefined) emits a group with `_id: null`. That maps to `{role: null, ...}` in the response, violating the declared type. Spec says nothing about pre-004 docs.
**Recommendation**: Add to §10.5 (or new §10.5b) an explicit decision: either (a) `$match: { role: { $exists: true } }` upstream of the `byRole` facet so legacy docs are excluded (and document that legacy queries don't appear in `byRole`), or (b) coerce `null → 'legacy'` in the response builder, or (c) make `role` required in the schema and backfill legacy docs with `'admin'` (since 003 was admin-only). Each is fine; pick one.
**Severity reasoning**: TypeScript strict-mode response typing will accept this only via implicit `null`-as-`string` lying. Easy fix but the spec must say which.

### [MEDIUM] F-6: `supportedReports` persona-filter on `cap_reached` refusals is not explicit
**Location**: spec §Story 4 AC-1
**Issue**: §Story 4 AC-1 says "On every `refused` response, `supportedReports` is filtered" — the word "every" implies cap_reached and parser/timeout refusals too. But §Story 1 only describes the scope-refusal path. Current 003 code at `service.ts:133, 147, 157, 166, 181, 199` uses `ALLOWED_REPORTS` for every refusal. Implementer might reasonably read the spec as "only scope refusals get filtered". The cost is small (no functional risk) but consistency matters and admins legitimately want a stable list shape.
**Recommendation**: Explicitly add to §Story 4: "applies to all refusal taxonomies, including `cap_reached`, `timeout`, parser reasons, `report_run_failed`, and `report-not-scopable-for-role`. The persona's eligible list is computed from `authScope` regardless of which refusal branch fired." Add a sentence noting that on cap_reached, the helpful list narrows their retry options too.
**Severity reasoning**: Quality-of-implementation rather than a correctness bug, but ambiguity here will cost a follow-up PR.

### [MEDIUM] F-7: `authorize()` 403 denials are not counted in `byRole` stats
**Location**: spec §Story 5, §10.5
**Issue**: When `authorize` denies a request (e.g., a student attempting NL), the response is 403 from middleware. `nlSvc.nlQuery` is never invoked, no `NlReportQuery` doc is created, and the new `byRole` facet will never see "students who tried and were denied". §Story 5's goal ("show me which personas are using NL") therefore systematically under-counts denial pressure. This matters because the 30-day success metric §8.1 ("≥30% of NL queries from non-admin personas") is measured against the same NlReportQuery collection.
**Recommendation**: Either (a) lower the bar — spec explicitly notes denials are not counted, OR (b) add a pre-handler micro-write (lightweight `NlReportAttempt` log row) for 403s so the stats facet sees them; flag spam-resistance via rate-limit, OR (c) emit an audit log entry on 403 via a thin `authorizeWithAudit` wrapper and run `byRole` over audit logs instead. Each has costs; (a) is cheapest, (b) is most informative.
**Severity reasoning**: A measurement gap, not a security gap. Decisive for §8 success-metric interpretation though.

### [MEDIUM] F-8: New `report-not-scopable-for-role` reason rendered raw in the FE refused-banner
**Location**: `admin-portal/src/components/governance/NlQueryPanel.tsx:123`, spec §10.7
**Issue**: The FE's refused-banner currently displays `response.reason` as raw text (line 123: `{response.reason}`). Existing 003 reasons are short tokens (`cap_reached`, `timeout`) that read OK as fallback labels; the new `report-not-scopable-for-role` will display literally as that kebab-cased string. The FE TypeScript already accepts unknown reasons (`reason: string` in `governance.ts:150`), so this is purely a UX nit, not a contract break.
**Recommendation**: Add to §10.7 a one-line note that an FE change is part of 004 scope: friendlier rendering for `report-not-scopable-for-role` (e.g., "Your role can't run that report. Try one of the supported reports below."). The persona-filtered `supportedReports` chip list is already there to support this. Without this note, the FE change might be missed.
**Severity reasoning**: Polish, but trivially in scope and easily skipped.

### [MEDIUM] F-9: Spec does not document how `role` and `personaType` flow from `req.user` to `nlQuery`
**Location**: spec §10.5, §3 (architecture sketch)
**Issue**: §10.5 adds `role`, `personaType`, `authScopeApplied` to `NlReportQuery`. The architecture sketch in §3 shows `nlQuery(collegeId, question, performedBy, { authScope })` taking only `authScope`. `authScope` doesn't include `role` or `personaType` — those are on `req.user` (per `authenticate.ts:7`). Without naming this in the spec, two implementations are equally consistent: pass `req.user.role/personaType` as new opts, or thread them inside `authScope`. The current `AuthScope` type in `types.ts:21-29` does not have a role field.
**Recommendation**: Either (a) extend the `nlQuery` signature in §3 to `nlQuery(collegeId, q, performedBy, { authScope, role, personaType })`, or (b) thread `role` and `personaType` into `AuthScope` (more invasive, touches the RBAC type — out of stated scope per §6). Recommend (a) and document it in §3.
**Severity reasoning**: Implementation will reach a fork in the road; spec should pick the side.

### [LOW] F-10: `assignedTo` legacy-string fallback could match across colleges
**Location**: spec §10.1, `apply-scope.ts:46-55`
**Issue**: §10.1 says v1 scopes by `assignedTo === String(userId)`. `apply-scope.ts` just adds `filter['assignedTo'] = authScope.userId` — but `userId` is a string in the JWT and `assignedTo` historically may contain free-text names. If two colleges both have inquiries with `assignedTo: 'Priya'` and a counsellor's `userId === 'Priya'` (unlikely but not impossible in dev seed), the `$match` on `assignedTo` would still be safe because `collegeId` is the first match-key — so this is technically OK. Worth restating in the spec that `collegeId` filters first and `applyAuthScope` is layered on top.
**Recommendation**: Add to §10.1 a one-line "collegeId remains the first match-key; the assignedTo predicate is additive" assertion so reviewers don't have to re-derive it.
**Severity reasoning**: Belt-and-braces clarity.

### [LOW] F-11: `OQ-2` is answered twice with the same default but no clear binding
**Location**: spec §9 OQ-2, §10.6
**Issue**: OQ-2 says "Default for v1: in-flight requests use the env value at request-start; flag is read once per request." §10.6 says the flag "is read by the route at request-start." Both arrive at the same operational behavior but use slightly different language ("once per request" vs. "at request-start" — the former is per-request, the latter could be parsed as "at route load" given Express's middleware-registration model). Combined with F-3, this is a wording cleanup.
**Recommendation**: Consolidate to one place: pick §10.6, delete the OQ-2 redundant restatement, or convert OQ-2 to a closed decision.
**Severity reasoning**: Spec-hygiene; no implementation risk.

### [LOW] F-12: Test-fixture helper `seedUsersAndPolicy.ts` (§10.8) is named like it seeds policies, but spec §6 forbids policy changes
**Location**: spec §10.8 vs. §6
**Issue**: §10.8 lists a new helper `__tests__/helpers/seedUsersAndPolicy.ts`. The name suggests it seeds policies. §6 says "shared/rbac/engine — existing… No changes." If the helper is seeding TEST policies into a per-test policy collection, that's fine and not a code change to engine. But the name will confuse readers.
**Recommendation**: Rename to `seedRbacTestFixtures.ts` (or similar) and clarify in §10.8 that the helper seeds test-only Policy documents into Mongo for integration tests, not the runtime policy seed.
**Severity reasoning**: Naming nit.

## What's solid (worth keeping)
- §10.4 correctly identifies the cross-persona dedup-cache leakage risk and proposes a key extension (just needs the fingerprint fix in F-2).
- The decision to leave `assignedTo` vs `assignedCounsellorId` as a one-line `applyAuthScope` opt-flip (§10.1) is appropriately humble about the schema's legacy state.
- The `scopeEligibility` gate runs in `runReport` BEFORE invoking the runner — §7 calls this out as the structural protection that an unprotected runner can never be invoked with a non-admin scope. That's the right load-bearing invariant.
- The decision to keep `applyAuthScope` unchanged and pass `departmentField`/`selfField` per call (§10.3) is in keeping with how the rest of the codebase uses it (e.g., `fee-line-items` uses `studentId`, this feature uses `branchId`/`assignedTo`).
- §10.7 cleanly extends the existing refused-reason taxonomy without renaming anything; the FE `reason: string` typing already absorbs the new value (no break in the wire contract).
- The §10.6 rollout flag mirrors `RBAC_ENFORCE` precedent in name and "default off" semantics — safe-by-default until per-environment flip.
- Constraint table (§5) correctly identifies that the runner overhead is a constant-time dictionary merge and that index-friendliness is preserved.
- The 30-day success metrics in §8 are measurable (audit-log-derivable) and reasonable (adoption %, scope-leak incidents, refusal ratio drift, p95 latency).
- §11 correctly anticipates this is a security-sensitive change and reserves GATE 3 audit time to verify (a) every runner consumes `ctx.authScope` and (b) `runReport` enforces eligibility before invoking the runner.
