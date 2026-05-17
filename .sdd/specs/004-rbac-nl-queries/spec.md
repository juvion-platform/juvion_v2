# Feature Spec — Row-Level RBAC at the Query Layer (NL Reports Persona Unlock)

**Feature ID:** 004-rbac-nl-queries
**Module:** M11 Governance (report-engine surface) + shared/rbac
**Status:** Draft (pre-GATE 2).
**Date:** 2026-05-17

## 1. Problem & Motivation

003-nl-report-queries shipped with a hard `requireRole(['admin', 'super_admin'])` gate on `POST /api/governance/reports/nl-query`. The narrow scoping was deliberate (003 §1): "RBAC gap: row-level scope isn't enforced at the query layer — exposing NL to HOD/student/parent personas would be unsafe today."

This feature closes that gap. It threads the existing `authScope` (`departmentOnly`, `selfOnly`, `departmentId`, `personId`) through the declarative report engine so non-admin personas can run NL queries and see only the rows their policy allows them to see.

**Goal:** Replace the hard role gate on the NL endpoint with `authorize('governance', 'read')` + scope enforcement inside each report runner. HOD asks "show me my department's student roster" → returns ONLY their branch's students. Counsellor asks "how are my leads converting?" → returns ONLY leads where `assignedTo === userId`. Reports whose data shape cannot honor the persona's scope refuse cleanly.

**Why now:** Without this, 003 NL is admin-only. The strategic value of NL is broad-persona self-service — every cluster head, HOD, and counsellor who can't navigate the report picker still understands plain English. This unlock is the highest-leverage extension of 003.

**Scoped narrow because:**
- Only the **3 implemented report runners** in 003 (`admissions-funnel`, `lead-source-performance`, `student-roster-snapshot`) get scope-aware runners in v1. Phase B stubs are unchanged — they still throw `PhaseBStubError`.
- Student / parent personas (`selfOnly` shape, no department) are **out of scope for v1**. Their NL surface looks fundamentally different (personal data, not governance reports) and warrants its own design.

## 2. User Stories & Acceptance Criteria

### Story 1 — HOD scoped NL query

**As** a head-of-department (`personaType: 'ST-ACAD-HOD'`)
**I want** to ask the NL endpoint a question about my department's students
**So that** I get only my branch's roster without manually filtering.

**ACs:**

1. `POST /api/governance/reports/nl-query` succeeds for an HOD user when `RBAC_NL_ENFORCE === 'true'`; returns 403 from `authorize('governance', 'read')` if the policy denies them (existing behavior).
2. When `nlQuery()` matches the question to `student-roster-snapshot`, the resulting `Student.aggregate` pipeline's first `$match` includes `branchId: <HOD's branchId>` (sourced from `req.authScope.departmentId` via `resolveUserScope`). No rows outside the HOD's branch appear in `results`.
3. Audit log entry `ai_nl_report_query` records `performedBy = HOD user id`. The persisted `NlReportQuery` document records the persona's `role` and the applied `authScopeApplied: { departmentOnly: true, departmentId: <branch> }` so stats can break down by persona.
4. If the HOD asks for `admissions-funnel` (a report whose `scopeEligibility.departmentOnly === 'admin-only'`), `nlQuery()` returns `{ status: 'refused', reason: 'report-not-scopable-for-role', supportedReports: [<HOD-eligible reports>], llmModel, costInr }`. Audit + persistence happen as for any refusal.

### Story 2 — Counsellor self-scoped NL query

**As** an admissions counsellor (`personaType: 'ST-ADM-AC'`, `selfOnly: true`)
**I want** to ask "how are my leads doing this month"
**So that** I see only the leads assigned to me, not the whole college.

**ACs:**

1. `nlQuery()` matches the question to `lead-source-performance` (or refuses cleanly if no implemented report fits).
2. The resulting `Inquiry.aggregate` first `$match` stage includes a self-scoping predicate. Spec §10.1 nails which field the predicate uses (legacy string `assignedTo` vs canonical ObjectId `assignedCounsellorId`).
3. Result rows aggregate only over inquiries the counsellor owns.
4. If the counsellor asks for `student-roster-snapshot` (declared `scopeEligibility.selfOnly = 'admin-only'`), `nlQuery()` refuses with `reason: 'report-not-scopable-for-role'`.

### Story 3 — Admin path unchanged

**As** an admin or super_admin
**I want** my existing NL behavior to be unchanged
**So that** the persona unlock is purely additive.

**ACs:**

1. With `RBAC_NL_ENFORCE === 'true'`, admin + super_admin requests pass `authorize('governance', 'read')`; `authScope` shows `departmentOnly: false, selfOnly: false`. Every implemented runner builds its `$match` with no scope predicate added.
2. Every existing 003 test in `nl-reports/__tests__/` passes unchanged. The 5 results an admin saw before, they still see.
3. With `RBAC_NL_ENFORCE !== 'true'` (default until flip), the hard `requireRole(['admin','super_admin'])` gate is restored — identical to today. Lets us merge to main safely behind the flag, then flip per environment.

### Story 4 — Refusal narrows `supportedReports` per persona

**As** the Reports-page user (any persona)
**I want** the refusal banner to show me reports I CAN ask about
**So that** I don't keep retrying with questions my role can't run.

**ACs:**

1. On every `refused` response, `supportedReports` is filtered to the set of report codes whose `scopeEligibility` is `'supported'` (or `undefined` → defaults to admin-only) for the requester's `authScope`.
2. Admin / super_admin still receive the full `ALLOWED_REPORTS` list — unchanged.
3. HOD receives `['student-roster-snapshot']` (the only one whose `departmentOnly === 'supported'`).
4. Counsellor receives `['lead-source-performance']` (the only one whose `selfOnly === 'supported'`).

### Story 5 — Stats endpoint surfaces persona breakdown

**As** a college admin reviewing NL spend
**I want** `/nl-query/stats` to show me which personas are using NL
**So that** I can tell whether the unlock is being adopted.

**ACs:**

1. `GET /api/governance/reports/nl-query/stats` response gains a new field `byRole: Array<{ role: string, count: number, costInr: number }>`.
2. The aggregation pipeline reads from the new `role` field persisted on `NlReportQuery`.
3. Existing fields (`totalQueries`, `matched`, `refused`, `llmCostInr`, `byReport`) are unchanged in shape and value.

## 3. Architecture — Scope Threading

### One central change

`ReportRunContext` extends from `{ collegeId }` to `{ collegeId, authScope? }`. Every runner is free to read `ctx.authScope` and inject the scope into its first `$match` stage via the existing `applyAuthScope` helper.

```
Request → authenticate → authorize('governance','read') → req.authScope
                                                            ↓
controller → nlQuery(collegeId, question, performedBy, { authScope })
                ↓ (mask, dedup, cap, LLM, parse, validate — unchanged from 003)
runReport(collegeId, reportCode, params, performedBy, authScope)
                ↓
                Check ReportDefinition.scopeEligibility vs authScope flags.
                IF mismatch → throw ScopeNotSupportedError(reportCode, dimension).
                ELSE invoke run(ctx={collegeId, authScope}, params).
                ↓
runner.run:
  const match = { collegeId };
  if (ctx.authScope) applyAuthScope(match, ctx.authScope, { departmentField: 'branchId', selfField: 'personId' });
  Model.aggregate([{ $match: match }, ...])
```

### Scope-eligibility declarations (v1)

| Runner | departmentOnly | selfOnly | Notes |
|--------|---------------|----------|-------|
| `admissions-funnel` | `admin-only` | `admin-only` | Inquiry has no clean `departmentId`; `branchInterest` is a free string. Three-collection rollup (Inquiry → Applicant → Admission) is awkward to scope coherently. Admin-only for v1; revisit when Inquiry gains a canonical `departmentId` or `branchId` ObjectId. |
| `lead-source-performance` | `admin-only` | `supported` | Filter `Inquiry` by the self-field configured in §10.1. Same three-collection caveat for departmentOnly. |
| `student-roster-snapshot` | `supported` | `supported` | Filter `Student` by `branchId === authScope.departmentId` for HOD; by `personId === authScope.personId` for selfOnly (student NL is Phase C — not lit up in v1's persona mapping; declaring `supported` is forward-compatible). |

### Persona × Report matrix (v1)

| Persona / role | admissions-funnel | lead-source-performance | student-roster-snapshot |
|---------|-------------------|-------------------------|-------------------------|
| `admin` / `super_admin` | supported | supported | supported |
| `staff` `ST-ACAD-HOD` (departmentOnly) | refused | refused | supported (branch-scoped) |
| `staff` `ST-ADM-AC` (selfOnly counsellor) | refused | supported (own leads) | refused |
| `staff` `ST-FAC` (departmentOnly faculty) | refused | refused | supported (branch-scoped) |
| `staff` `ST-CLUSTER-HEAD` (departmentOnly) | refused | refused | supported (branch-scoped) |
| `student` / `parent` (selfOnly) | OUT OF SCOPE FOR v1 — `authorize('governance','read')` policy denies; existing 403 path |

## 4. Out of Scope (v1)

1. **Student / parent NL access.** Different shape (personal data, not governance reports). Future work.
2. **New report runners.** No Phase B stubs are converted. The 9 stubs still throw `PhaseBStubError`. Each one will declare its `scopeEligibility` when it gains a real runner, but that lands feature-by-feature.
3. **Adding `departmentId` to Inquiry.** A real fix for HOD admissions-funnel access requires a model + migration change; v1 declares it `admin-only` instead and defers.
4. **Per-persona prompt tuning.** The LLM prompt is unchanged from 003. Sending HOD-specific allowlists would save tokens but adds prompt-variant complexity — defer to v1.5.
5. **Replacing 003's `requireRole` everywhere.** Other governance endpoints (e.g., generic `runReport` REST surface) keep their current gating. This spec touches the NL endpoint only.
6. **Multi-dimensional scope** (e.g., department × programme). `applyAuthScope` is one-dimensional today; no extension.

## 5. Constraints & NFRs

| Constraint | Target |
|-----------|--------|
| Backward compatibility | When `RBAC_NL_ENFORCE !== 'true'`, behavior is byte-identical to today. |
| Scope leak | Zero. Every scoped runner is verified by integration test against a 2-tenant fixture. |
| Refusal latency | Pre-LLM refusal (e.g., policy 403 from `authorize()`) returns in <50ms. Post-LLM scope refusal carries one LLM round-trip (~3–8s) before refusing — same as 003 refusal paths. |
| Runner overhead | Adding `applyAuthScope` to a `$match` is a constant-time dictionary merge. Aggregation plan stays index-friendly: `{ collegeId, branchId }` and `{ collegeId, assignedTo }` indexes already exist or will be added in §10.2. |
| Cap-guard | Unchanged. NL queries from non-admin personas count against the same `NL_REPORT_DAILY_LLM_CAP` (30/college/day). |
| Audit | Unchanged action name (`ai_nl_report_query`). New `role` and `authScopeApplied` fields on the persisted document. |

## 6. Dependencies

- **003-nl-report-queries** — must be shipped (it is; PR #62 merged). 004 retrofits 003.
- **shared/rbac/engine** — existing `evaluateAccess` policy DB, `resolveUserScope`, `authorize()` middleware. No changes.
- **shared/rbac/apply-scope.ts** — existing `applyAuthScope(filter, scope, opts?)`. No changes. Used as-is with per-call `departmentField` / `selfField` overrides.
- **report-registry, report-service, nl-reports/service** — modified.
- **Models** — no schema changes. `NlReportQuery` gains two optional fields (`role`, `authScopeApplied`); pre-existing documents have them undefined.

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Scope leak: a runner forgets to call `applyAuthScope` | `ScopeNotSupportedError` is thrown by `runReport` BEFORE invoking the runner if `scopeEligibility` doesn't permit. So an unprotected runner can never be invoked with a non-admin authScope. Plus integration tests cover every (persona, report) cell. |
| `departmentId` semantics drift | Currently HOD's "department" is mapped to a Branch ObjectId by `resolveUserScope`. `applyAuthScope` lets us name the field per-call (`departmentField: 'branchId'`). The mapping is documented at §10.3. |
| `assignedTo` string vs `assignedCounsellorId` ObjectId | Resolved in §10.1. v1 reads whichever field the policy resolution produced — likely `userId` (string form, since `assignedTo` is a string). If `assignedCounsellorId` becomes canonical post-migration, `applyAuthScope` opts get switched in a single line. |
| LLM matches a report the persona can't scope → wasted cost | Tolerated for v1. Post-LLM refusal is the contract. 30s dedup cache + daily cap-guard limit blast radius. Future v1.5: per-persona allowlist in prompt. |
| Cache poisoning between personas | The 003 dedup cache keys on `(collegeId, masked question)`. Two personas asking the same question would hit the same cache entry but get DIFFERENT scoped results. **Fix in §10.4:** extend the dedup key to `(collegeId, role, departmentId-or-personId, masked question)`. |

## 8. Success Metrics (30-day post-launch)

1. Adoption: ≥30% of NL queries originate from non-admin personas.
2. Scope correctness: 0 incidents of cross-tenant or cross-scope leakage (verified by audit log + integration tests + manual spot-check).
3. Refusal-to-match ratio for non-admin personas: stable (≤ 2x admin's ratio). If higher, either prompt or eligibility mapping is wrong.
4. p95 latency for matched NL response: unchanged from 003 baseline.

## 9. Open Questions

- **OQ-1**: Should `student-roster-snapshot` for an HOD also scope by programme (not just branch), or is branch alone sufficient? **Default for v1:** branch alone. Programme can be added per-runner without spec change.
- **OQ-2**: When a non-admin user is mid-flight on an NL query and an admin flips `RBAC_NL_ENFORCE` off, what happens to the in-flight job? **Default for v1:** in-flight requests use the env value at request-start; flag is read once per request.

## 10. Detailed Decisions

### §10.1 Self-scoping field for `lead-source-performance`

`Inquiry.assignedTo` is declared as `String` in the model and the comment notes it's the legacy field being replaced by `assignedCounsellorId` (ObjectId). As of 2026-05-17 the canonical field has NOT been wired through; existing inquiries store the assignee in `assignedTo` as a free string (likely the userId or a name).

**Decision:** v1 scopes by `assignedTo === String(userId)`. `applyAuthScope(filter, scope, { selfField: 'assignedTo' })` plus a fallback to `userId` (the existing `apply-scope.ts` default behavior when `personId` is undefined or `selfField` isn't `personId`-shaped). If `assignedCounsellorId` becomes canonical later, switch the opt in one line — no spec change.

**Risk:** if `assignedTo` historically stored names ("Priya"), not userIds, this returns empty for everyone. Story 2's integration test seeds `assignedTo: userId` explicitly to lock the contract.

### §10.2 Index audit

| Collection | Existing index | Needed for v1 scope |
|------------|---------------|---------------------|
| `Inquiry` | `{ collegeId: 1, createdAt: -1 }` (assumed) | ADD `{ collegeId: 1, assignedTo: 1, createdAt: -1 }` to support counsellor selfOnly + date-range scan. |
| `Student` | `{ collegeId: 1 }` and likely `{ collegeId: 1, branchId: 1 }` per existing roster queries | Verify; if missing, ADD `{ collegeId: 1, branchId: 1, status: 1 }`. |

GATE 2 data-layer validator should call out any missing indexes; spec accepts adding them as part of this feature.

### §10.3 `departmentId` resolution semantics

`resolveUserScope(userId, collegeId, role)` (existing) returns `{ departmentId, personId }`. For HOD personas, `departmentId` is currently populated as a Branch ObjectId (the HOD's branch-of-responsibility). For faculty / cluster-head, same shape.

**Decision:** v1 does NOT change `resolveUserScope`. The runner's `applyAuthScope` call passes `departmentField: 'branchId'` for any runner whose source collection has a `branchId` field (Student). If future runners introduce a true `departmentId` field (e.g., Programme.departmentId), they use `departmentField: 'departmentId'`.

This is a soft semantic (HOD's "department" is overloaded to mean "branch"), documented here and in code comments. Cleaning it up would mean schema-naming work across the codebase — out of scope.

### §10.4 Dedup-cache key extension

`getCachedNlQuery(collegeId, maskedQuestion)` and `setCachedNlQuery(collegeId, maskedQuestion, ...)` (003) hash on `(collegeId, masked question)`. For 004, extend to `(collegeId, role, scopeFingerprint, masked question)` where `scopeFingerprint = ${authScope.departmentId ?? '-'}:${authScope.personId ?? '-'}`. Same Redis key namespace; longer key.

This prevents one persona's cached result leaking to another. Per-college bound stays the same.

### §10.5 Audit + persistence additions

`NlReportQuery` document gains:

```ts
role?: string;              // 'admin', 'staff', etc.
personaType?: string;       // 'ST-ACAD-HOD', etc.
authScopeApplied?: {
  departmentOnly: boolean;
  selfOnly: boolean;
  departmentId?: string;    // stored as string for query simplicity
  personId?: string;
};
```

All optional; existing docs have them undefined. Stats endpoint reads `role` for the new `byRole` facet (Story 5).

### §10.6 Rollout flag

`RBAC_NL_ENFORCE` env var (mirrors `RBAC_ENFORCE` for ABAC rollout).

- Unset / `'false'` (default) → keep the hard `requireRole(['admin','super_admin'])` gate. Identical to today.
- `'true'` → replace with `authorize('governance','read')` + scope enforcement.

The flag is read by the route at request-start. No live reload; restart-to-flip is acceptable.

### §10.7 Refusal taxonomy

Existing 003 refusal reasons (unchanged): `cap_reached`, `timeout`, parser reasons, `report_run_failed`.

New for 004: `report-not-scopable-for-role` — emitted when `runReport` detects an eligibility mismatch.

### §10.8 Test fixtures

Integration tests require multi-persona users. `__tests__/helpers/seedUsersAndPolicy.ts` (new) seeds:

- 1 admin user
- 1 HOD user with `personaType: 'ST-ACAD-HOD'`, resolved `departmentId` = branch B1
- 1 counsellor user with `personaType: 'ST-ADM-AC'`, `selfOnly: true`
- 1 faculty user with `personaType: 'ST-FAC'`, `departmentId` = branch B2
- Plus seeded inquiries / students split across branches B1, B2, and assignees.

This helper is shared with future RBAC-related test work.

## 11. SDD Workflow Notes

- Complexity score: ~5 (auth touch +2, multi-component +1, integration test +1, RBAC sensitivity +1). Standard 3-validator team appropriate. No enhanced team needed.
- GATE 2 validators expected: `sdd-api-validator` (route + refusal contract), `sdd-data-layer-validator` (scope-injection on aggregations, index audit), `sdd-architecture-validator` (rollout flag, audit/dedup extensions).
- GATE 3 audit: row-level scope is a security-sensitive change. Audit should explicitly verify (a) no runner reads ctx.authScope and silently ignores it, (b) `runReport` enforces eligibility before invoking, (c) test coverage hits every persona × report cell.
