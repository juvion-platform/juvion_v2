# Feature Spec — Row-Level RBAC at the Query Layer (NL Reports Persona Unlock)

**Feature ID:** 004-rbac-nl-queries
**Module:** M11 Governance (report-engine surface) + shared/rbac (policy seed + runReport gate)
**Status:** Draft (post-GATE 2 amendment; see `gate2-resolution.md`).
**Date:** 2026-05-17

## 1. Problem & Motivation

003-nl-report-queries shipped with a hard `requireRole(['admin', 'super_admin'])` gate on `POST /api/governance/reports/nl-query`. The narrow scoping was deliberate (003 §1): "RBAC gap: row-level scope isn't enforced at the query layer — exposing NL to HOD/student/parent personas would be unsafe today."

This feature closes that gap. It threads the existing `authScope` (`departmentOnly`, `selfOnly`, `departmentId`, `personId`, `userId`) through the declarative report engine so non-admin personas can run NL queries and see only the rows their policy allows them to see.

**Goal (v1):** Replace the hard role gate on the NL endpoint with `authorize('governance', 'read')` + scope enforcement inside `runReport` and each scope-aware runner. **HOD and faculty** ask "show me the student roster" → returns ONLY students in their department's branches (via Department → Branch → Student join). All other non-admin personas remain admin-only for NL — either by policy DB denial or by per-report eligibility refusal.

**Why now:** Without this, 003 NL is admin-only. The strategic value of NL is broad-persona self-service. HOD and faculty are the first beneficiaries today because their `Faculty.departmentId` is reliably populated by existing flows; counsellor and cluster-head selfOnly support requires a data backfill (legacy `Inquiry.assignedTo` strings → canonical `assignedOfficerId` ObjectIds) that lands in v1.5 as a separate feature.

**Scoped narrow because:**

- Only the **3 implemented report runners** in 003 (`admissions-funnel`, `lead-source-performance`, `student-roster-snapshot`) get scope-aware runners in v1.
- Of those, only `student-roster-snapshot` accepts a non-admin scope in v1; the other two stay admin-only because their source data lacks a clean department or self field.
- Phase B stubs are unchanged at runtime (still throw `PhaseBStubError`) but gain placeholder `scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' }` declarations so Phase B authors re-confront the question when they un-stub.
- Student / parent / staff personas (incl. counsellor, warden, TPO, etc.) are **out of scope for v1**. See §4.

## 2. User Stories & Acceptance Criteria

> **Persona-code key (verified against `backend/src/shared/rbac/personas.ts` 2026-05-17):**
> HOD → `personaType: 'F-HOD'`, `role: 'hod'`.
> Faculty → `personaType: 'F-FAC'`, `role: 'faculty'`.
> Admin → `personaType: 'L-ADM'`, `role: 'admin'`. Super-admin → `L-SADM`/`super_admin`. Principal → `L-PRIN`/`principal`.
> Admissions counsellor → `personaType: 'ST-ADM-AC'`, `role: 'staff'`. **(Out-of-scope for v1; included only to lock the persona-code list.)**
> `resolveUserScope` dispatches on `role`, NOT `personaType`. `personaType` is informational on `NlReportQuery`.

### Story 1 — HOD scoped NL query

**As** an HOD (`role: 'hod'`, `personaType: 'F-HOD'`)
**I want** to ask the NL endpoint a question about my department's students
**So that** I get only my department's roster without manually filtering.

**ACs:**

1. `POST /api/governance/reports/nl-query` succeeds for the HOD user when `RBAC_NL_ENFORCE === 'true'` AND the §10.9 policy seed has run. Returns 403 from `authorize('governance', 'read')` if the seed has not run yet (existing 403 behavior, since defaults.ts has no `hod/governance/read` policy today).
2. When `nlQuery()` matches the question to `student-roster-snapshot`, the resulting `Student.aggregate` pipeline's first `$match` filters by `branchId: { $in: branchIdsForDepartment }`. `branchIdsForDepartment` is computed at runtime by `Branch.find({ collegeId, departmentId: authScope.departmentId })` (§10.3 details the two-step lookup). No rows outside the HOD's department-of-record appear in `results`.
3. Audit log entry `ai_nl_report_query` records `performedBy = HOD user id`. The persisted `NlReportQuery` document records `role: 'hod'`, `personaType: 'F-HOD'`, and `authScopeApplied: { departmentOnly: true, selfOnly: false, departmentId: <Department._id as string>, personId: <Person._id as string> }`.
4. If the HOD asks for `admissions-funnel` or `lead-source-performance` (both declared `scopeEligibility.departmentOnly = 'admin-only'`), `nlQuery()` returns `{ status: 'refused', reason: 'report-not-scopable-for-role', supportedReports: ['student-roster-snapshot'], llmModel, costInr }`. Audit + persistence happen as for any refusal.
5. If `authScope.departmentOnly === true` but `authScope.departmentId` is `undefined` (HOD whose `Faculty` record lacks `departmentId` — a data-quality problem), `runReport` refuses with `reason: 'scope-unresolved'` before invoking the runner. The HOD does NOT see unscoped data. See §10.10.

### Story 2 — Faculty scoped NL query

**As** a faculty member (`role: 'faculty'`, `personaType: 'F-FAC'`)
**I want** to ask the NL endpoint a question about my department's students
**So that** I get only my department's roster without manually filtering.

**ACs:** Identical to Story 1 ACs 1–5 but with `role: 'faculty'` policy at priority 700 (per §10.9). The scope mechanics are the same — Department → Branch → Student two-step lookup. No `personaType: 'F-FAC'` distinction at the policy or runtime layer; faculty and HOD share the runtime path.

### Story 3 — Admin path unchanged

**As** an admin, super_admin, or principal
**I want** my existing NL behavior to be unchanged
**So that** the persona unlock is purely additive.

**ACs:**

1. With `RBAC_NL_ENFORCE === 'true'`, admin / super_admin / principal requests pass `authorize('governance', 'read')`; `authScope` shows `departmentOnly: false, selfOnly: false`. Every implemented runner builds its `$match` with no scope predicate added.
2. Every existing 003 test in `nl-reports/__tests__/` passes unchanged. Whatever an admin saw before, they still see.
3. With `RBAC_NL_ENFORCE !== 'true'` (default until flip), the hard `requireRole(['admin','super_admin'])` gate is restored — identical to today. Lets us merge to main safely behind the flag, then flip per environment.

### Story 4 — Refusal narrows `supportedReports` per persona

**As** the Reports-page user (any persona)
**I want** the refusal banner to show me reports I CAN ask about
**So that** I don't keep retrying with questions my role can't run.

**ACs:**

1. On **every** refused response (including `cap_reached`, `timeout`, parser reasons, `report_run_failed`, `report-not-scopable-for-role`, and the new `scope-unresolved`), `supportedReports` is computed as the subset of `ALLOWED_REPORTS` whose `scopeEligibility` admits the requester's `authScope` flags.
2. Admin / super_admin / principal (no scope flags set) receive the full `ALLOWED_REPORTS` list — unchanged.
3. HOD / faculty (departmentOnly) receive `['student-roster-snapshot']` (the only one declaring `departmentOnly: 'supported'`).
4. Any persona whose scope produces an empty `supportedReports` (e.g., a hypothetical counsellor in v1 — though v1 staff is denied at the policy layer and never reaches refusal) receives `[]`. The FE renders this as "no reports your role can ask about; contact admin".

### Story 5 — Stats endpoint surfaces persona breakdown

**As** a college admin reviewing NL spend
**I want** `/nl-query/stats` to show me which personas are using NL
**So that** I can tell whether the unlock is being adopted.

**ACs:**

1. `GET /api/governance/reports/nl-query/stats` response gains a new field `byRole: Array<{ role: string, count: number, costInr: number }>`.
2. The stats aggregation adds an upstream `$match: { role: { $exists: true } }` for the `byRole` facet so pre-004 docs (where `role` is `undefined`) are excluded. The byReport / total / byStatus facets are unchanged and continue to count pre-004 docs.
3. Existing fields (`totalQueries`, `matched`, `refused`, `llmCostInr`, `byReport`) are unchanged in shape and value.

### Story 6 — UX dead-end on policy denial

**As** any user who reaches the NL panel without governance:read
**I want** a clear inline banner explaining why my question isn't answered
**So that** I don't repeatedly retry against a silent panel.

**ACs:**

1. When `authorize('governance', 'read')` returns 403 (e.g., for student / parent / unauthorized staff), the FE `NlQueryPanel` renders an inline banner: "Your role can't run governance reports. Ask your administrator if this is incorrect." (Banner text in copy doc; spec just commits to the existence of the banner.)
2. The FE distinguishes 403 (policy denial) from 200-refused (in-band refusal) — different banner copy.
3. Existing `NlQueryPanel.test.tsx` gains a test case for the 403 path.

## 3. Architecture — Scope Threading

### One central change

`ReportRunContext` extends from `{ collegeId }` to `{ collegeId, authScope }`. `authScope` is **required** (no longer optional) — every runner consults it on every call. For admin paths, `authScope` carries `departmentOnly: false, selfOnly: false` which makes `applyAuthScope` a no-op. This locks the contract: a runner can never be invoked with an undefined authScope.

`ReportDefinition` gains a required `scopeEligibility: { departmentOnly: 'supported' | 'admin-only', selfOnly: 'supported' | 'admin-only' }`. Phase B stubs declare `{ departmentOnly: 'admin-only', selfOnly: 'admin-only' }` (placeholder; Phase B authors re-decide when they un-stub).

### Call flow

```
Request → authenticate → authorize('governance','read') → req.authScope
                                                            ↓
controller → nlQuery(collegeId, question, performedBy, { authScope, role, personaType })
                ↓ (mask, dedup, cap, LLM, parse, validate — unchanged from 003)
runReport(collegeId, reportCode, params, performedBy, authScope)
                ↓
                §10.10 eligibility gate (pre-side-effects):
                  IF def.scopeEligibility.departmentOnly === 'admin-only' AND authScope.departmentOnly:
                    throw ScopeNotSupportedError(reportCode, 'department', 'role-not-eligible')
                  IF def.scopeEligibility.selfOnly === 'admin-only' AND authScope.selfOnly:
                    throw ScopeNotSupportedError(reportCode, 'self', 'role-not-eligible')
                  IF authScope.departmentOnly AND !authScope.departmentId:
                    throw ScopeNotSupportedError(reportCode, 'department', 'scope-unresolved')
                  IF authScope.selfOnly AND !authScope.userId:
                    throw ScopeNotSupportedError(reportCode, 'self', 'scope-unresolved')
                ↓
                ReportRun.create({ status: 'running', ... })  // only after gate passes
                ↓
                invoke def.run(ctx={collegeId, authScope}, params)
                ↓
runner.run (example: student-roster-snapshot):
  const cidObj = new Types.ObjectId(ctx.collegeId);
  const match: Record<string, unknown> = { collegeId: cidObj };
  if (ctx.authScope.departmentOnly && ctx.authScope.departmentId) {
    const branches = await Branch.find(
      { collegeId: cidObj, departmentId: new Types.ObjectId(ctx.authScope.departmentId) },
      { _id: 1 }
    ).lean();
    match.branchId = { $in: branches.map(b => b._id) };
  }
  // selfOnly path uses applyAuthScope with explicit ObjectId wrap; see §10.3.
  Student.aggregate([{ $match: match }, ...])
```

### Scope-eligibility declarations (v1)

| Runner | `departmentOnly` | `selfOnly` | Notes |
|--------|------------------|------------|-------|
| `admissions-funnel` | `admin-only` | `admin-only` | `Inquiry` has no `departmentId`; `branchInterest` is a free string. Three-collection rollup. Defer to v1.5 with a model change. |
| `lead-source-performance` | `admin-only` | `admin-only` | **Changed from earlier draft.** `Inquiry.assignedTo` holds emails not userIds; canonical `assignedOfficerId` is unpopulated in pre-Gap-5 data. Counsellor selfOnly support requires a data backfill — defer to v1.5. See §10.1. |
| `student-roster-snapshot` | `supported` | `admin-only` | Filter `Student` by `branchId ∈ Branches[departmentId = authScope.departmentId]` for HOD/faculty (§10.3 two-step lookup). `selfOnly` is `admin-only` for v1 because there is no "my own student record" use case for HOD/faculty; student NL is a separate Phase C feature. |
| 9 Phase B stubs | `admin-only` | `admin-only` | Placeholder. Phase B authors override when they un-stub. |

### Persona × Report matrix (v1, after §10.9 policy seed)

| Persona / role | `admissions-funnel` | `lead-source-performance` | `student-roster-snapshot` |
|----------------|---------------------|---------------------------|---------------------------|
| `admin` / `super_admin` / `principal` (L-ADM / L-SADM / L-PRIN) | ✓ matched | ✓ matched | ✓ matched (full college) |
| `hod` (F-HOD) | ✗ refused (role-not-eligible) | ✗ refused (role-not-eligible) | ✓ matched (dept-scoped via Branch join) |
| `faculty` (F-FAC) | ✗ refused (role-not-eligible) | ✗ refused (role-not-eligible) | ✓ matched (dept-scoped via Branch join) |
| `staff` (any persona) | ✗ 403 from authorize (§10.9 deny at priority 700 overrides 600 fallback) |
| `student` (L-STU) / `parent` | ✗ 403 from authorize (no governance policies; existing behavior unchanged) |

## 4. Out of Scope (v1)

1. **Student / parent NL access.** Different shape (personal data, not governance reports). Future Phase C feature.
2. **Counsellor (`ST-ADM-AC`) selfOnly support.** Requires `Inquiry.assignedTo` → `assignedOfficerId` backfill (legacy field stores emails). Tracked as v1.5 follow-up.
3. **Cluster head (`ST-ADM-AO-CH`) departmentOnly support.** Requires either a `Staff.departmentId` seed for cluster-head users (not currently populated) or a different scope model. Tracked as v1.5 follow-up.
4. **All other staff personas (`ST-WARDEN`, `ST-TPO`, `ST-LIB`, `ST-EXAM`, `ST-IQAC`, `ST-REG`, `ST-ACOPS-*`, etc.).** Each has a domain-specific use case for governance reports, not NL of student rosters. Out of scope for v1; explicitly denied at the policy layer (§10.9).
5. **New report runners.** No Phase B stubs are converted. Each gets a placeholder `scopeEligibility: 'admin-only'` declaration but its `run` still throws `PhaseBStubError`.
6. **Adding `departmentId` to `Inquiry`.** Would unlock HOD `admissions-funnel`. Deferred — model + migration change.
7. **Per-persona prompt tuning.** The LLM prompt is unchanged from 003. Sending HOD-specific allowlists would save tokens but adds prompt-variant complexity — defer to v1.5.
8. **Replacing 003's `requireRole` elsewhere.** Other governance endpoints (e.g., generic `runReport` REST surface at `POST /reports/run/:code`) keep their current gating. This spec touches the NL endpoint only.
9. **Multi-dimensional scope** (e.g., department × programme, or batch × section). `applyAuthScope` is one-dimensional today; no extension.
10. **Changes to `applyAuthScope` semantics.** The shared helper is used by 9+ call sites across academics/welfare/finance. 004 does NOT change its fail-open-when-missing-discriminator behavior; instead the eligibility gate in `runReport` (§10.10) catches the unresolved case BEFORE the helper is called. This keeps the shared primitive's contract stable.

## 5. Constraints & NFRs

| Constraint | Target |
|-----------|--------|
| Backward compatibility | When `RBAC_NL_ENFORCE !== 'true'`, behavior is byte-identical to today. |
| Scope leak | Zero. Every scope-eligible runner is verified by integration test against a 2-tenant fixture with cross-tenant data planted to prove non-leakage. |
| Fail-closed on unresolved scope | When a scope flag is set but its discriminator is undefined (`departmentOnly: true` + `departmentId: undefined`, OR `selfOnly: true` + `userId: undefined`), `runReport` refuses with `reason: 'scope-unresolved'` BEFORE any side effects (no ReportRun row, no runner invocation, no audit). See §10.10. |
| ObjectId wrap | The runner constructs all $match values as `Types.ObjectId(...)` — Mongoose does NOT auto-cast strings to ObjectIds inside `$match` (unlike `find()`). String-form scope values silently match zero rows. See §10.3, §10.11. |
| Refusal latency | Pre-LLM 403 from `authorize()`: <50ms. Pre-LLM scope-unresolved refusal: <100ms (one DB query for policy resolution; gate fires before LLM). Post-LLM eligibility refusal: ~3–8s (one LLM round trip before refusing). |
| Runner overhead | Two-step Branch lookup for HOD/faculty `student-roster-snapshot` is one extra `Branch.find` per call (1–10 rows; sub-ms with `(collegeId, departmentId)` index). Per-call cost negligible vs. the LLM call. |
| Cap-guard | Unchanged. NL queries from non-admin personas count against `NL_REPORT_DAILY_LLM_CAP` (30/college/day). |
| Audit | Action name unchanged (`ai_nl_report_query`). New fields `role`, `personaType`, `authScopeApplied` on the persisted `NlReportQuery` document. |

## 6. Dependencies

- **003-nl-report-queries** — must be shipped (it is; PR #62 merged). 004 retrofits 003.
- **shared/rbac/engine** — existing `evaluateAccess` policy DB, `resolveUserScope`, `authorize()` middleware. **No engine logic changes.** Policy DATA additions only (§10.9).
- **shared/rbac/apply-scope.ts** — existing `applyAuthScope(filter, scope, opts?)`. **No changes** to the helper itself; 004 calls it with explicit `Types.ObjectId(...)` wrap done by the caller (see §10.3, §10.11).
- **shared/rbac/defaults.ts** — **gains 3 new policy rows** (§10.9): `hod/governance/read` allow + departmentOnly, `faculty/governance/read` allow + departmentOnly, `staff/governance/read` deny. The seed migration that loads `DEFAULT_POLICIES` into the `Policy` collection must re-run per environment before `RBAC_NL_ENFORCE='true'` flips.
- **report-registry, report-service, nl-reports/service, nl-reports/dedup, nl-reports/controller, governance/routes** — modified.
- **Models** — no schema changes. `NlReportQuery` gains three optional fields (`role`, `personaType`, `authScopeApplied`); pre-existing documents have them undefined.

## 7. Risks

| Risk | Mitigation |
|------|-----------|
| Scope leak: runner declares `'supported'` but forgets `applyAuthScope` / Branch lookup | (a) `runReport` eligibility gate refuses when discriminator is unresolved, catching the most common misconfiguration. (b) Integration test for every (persona, report) cell. (c) Phase B contract: any runner upgrading from `'admin-only'` to `'supported'` MUST ship with a matching RBAC integration test in `__tests__/<runner>-rbac.test.ts` (verified by a regression-guard that scans the registry for `'supported'` declarations without paired tests — Phase B follow-on work). |
| `Faculty.departmentId` is unresolved for an HOD/faculty user (data quality) | §10.10 fail-closed gate refuses with `scope-unresolved`. HOD sees a refusal banner, NOT unscoped data. Operations can then fix the Faculty record. |
| Cross-persona dedup-cache leakage | §10.4 dedup fingerprint includes `(role, personaType, departmentId, personId, userId, selfOnly, departmentOnly)` — every field that discriminates the query result. Two same-role same-department users share the cache (correct: same authorized rows); any difference in scope-discriminator → different cache entry. |
| Staff fallback (priority 600, `module: '*', action: 'read'`) accidentally grants governance:read to all staff | §10.9 adds an explicit `{ role: 'staff', module: 'governance', action: 'read', effect: 'deny', priority: 700 }` that wins over the 600-priority fallback. v1 explicitly denies all staff for governance. v1.5 introduces narrow allows per persona. |
| LLM matches a report the persona can't scope → wasted cost | Tolerated for v1. Post-LLM eligibility refusal is the contract; 30s dedup cache + daily cap-guard limit blast radius. Future v1.5: per-persona allowlist in prompt. |
| Authorize 403 silent-clears the FE panel | Story 6 + §10.12 spec inline banner. |
| `byRole` stats emits `{ role: null }` on legacy 003 docs | §10.5 / Story 5 AC-2: stats facet adds upstream `$match: { role: { $exists: true } }`. Legacy docs excluded from byRole but counted in totalQueries / byReport. |

## 8. Success Metrics (30-day post-launch)

1. Adoption: ≥30% of NL queries originate from HOD or faculty role (per `byRole` stats).
2. Scope correctness: 0 incidents of cross-department or cross-tenant leakage (verified by audit log diff per HOD vs. expected branch set + integration tests + manual spot-check).
3. Refusal-to-match ratio for HOD/faculty: stable (≤ 2× admin's ratio). If higher, either prompt or eligibility mapping is wrong.
4. p95 latency for matched NL response: unchanged from 003 baseline.

## 9. Open Questions

- **OQ-1**: Should `student-roster-snapshot` for an HOD/faculty also scope by programme (not just branch), or is the department→branch set sufficient? **Default for v1:** branch set alone (every branch in their department). Programme refinement is a v1.5 add.

(Note: prior draft's OQ-2 about flag-flip semantics is now closed and lifted into §10.6.)

## 10. Detailed Decisions

### §10.1 Self-scoping for `lead-source-performance` — DEFERRED to v1.5

`Inquiry.assignedTo` is declared as `String` in the model. Inspection of `backend/src/seed.ts` (line 3050 and surrounding) and the model comments at `Inquiry.ts:70-75, 196-198` shows:

- `assignedTo` historically holds **emails** (e.g., `'admin@jit.edu.in'`), not 24-char hex User._ids.
- `assignedOfficerId: ObjectId, ref: 'Person'` is declared as the canonical replacement (model comment: "newly created inquiries should write `assignedOfficerId` exclusively"), and is already indexed at `{ collegeId, assignedOfficerId, status }`.
- Existing inquiries written before Strategic Gap 5 have ONLY `assignedTo` populated; new inquiries may write both or just `assignedOfficerId`.

`AuthScope.userId` is a User._id (24-char hex), `AuthScope.personId` is a Person._id (also hex). Neither matches the legacy email format. A self-scope filter against `assignedTo` would return zero rows for every counsellor in production data; a filter against `assignedOfficerId` would silently miss legacy inquiries.

**Decision:** `lead-source-performance.scopeEligibility.selfOnly = 'admin-only'` for v1. Counsellor (`ST-ADM-AC`) NL access is deferred to v1.5, which lands a one-time backfill migration mapping `assignedTo` emails → `assignedOfficerId` Person ObjectIds via email lookup. After the backfill, switching `selfOnly: 'supported'` is a one-line registry change.

### §10.2 Index audit

| Collection | Existing relevant index | Action for v1 |
|------------|------------------------|---------------|
| `Branch` | `{ collegeId }` (verify) | ADD `{ collegeId: 1, departmentId: 1 }` — supports the Branch lookup for HOD scope. Sub-ms cost since `Branch` is small (10s–100s of rows per college). |
| `Student` | `{ collegeId: 1 }`, `{ collegeId: 1, rollNumber: 1 }` unique-sparse | ADD `{ collegeId: 1, branchId: 1, status: 1 }` — supports `student-roster-snapshot` aggregation $match. |
| `Inquiry` | `{ collegeId: 1, assignedOfficerId: 1, status: 1 }` exists | No action for v1 (selfOnly is deferred). |

Plan.md will spell out the model-file edits.

### §10.3 HOD/faculty department scope — two-step Branch lookup

**Why not `applyAuthScope({ departmentField: 'branchId' })`:** `AuthScope.departmentId` resolves to `Faculty.departmentId`, which is a `ref: 'Department'` (a Department._id). `Student.branchId` is a `ref: 'Branch'` (a Branch._id). These are different collections; assigning `match.branchId = authScope.departmentId` compares mismatched ObjectId values and matches zero documents (best case) or — if `departmentId` is undefined — adds no filter and silently returns the entire college's data (worst case; see §10.10 fail-closed gate).

**v1 approach (inside `student-roster-snapshot.run`):**

```typescript
const cidObj = new Types.ObjectId(ctx.collegeId);
const match: Record<string, unknown> = { collegeId: cidObj };

if (ctx.authScope.departmentOnly && ctx.authScope.departmentId) {
  const branches = await Branch.find(
    { collegeId: cidObj, departmentId: new Types.ObjectId(ctx.authScope.departmentId) },
    { _id: 1 }
  ).lean();
  match.branchId = { $in: branches.map(b => b._id) };
}
// (params.status etc. layered on after scope)
return Student.aggregate([{ $match: match }, ...rest]);
```

**Long-term cleanup (out of scope for 004):** denormalize `departmentId` onto `Student` so a single `$match: { collegeId, departmentId: authScope.departmentId }` works. Saves the Branch lookup. Requires a Student schema field + backfill migration. Tracked as a v2 cleanup.

### §10.4 Dedup-cache key extension — full scope fingerprint

003's dedup cache keys on `nl-report-dedup:${collegeId}:${sha1(maskedQuestion)}` (TTL 30s). 004 extends to include every scope-discriminating field.

```typescript
const scopeFingerprint = sha1(
  `${role}|${personaType ?? '-'}|` +
  `${authScope.departmentOnly ? '1' : '0'}|${authScope.departmentId ?? '-'}|` +
  `${authScope.selfOnly ? '1' : '0'}|${authScope.personId ?? '-'}|${authScope.userId ?? '-'}`
);
const cacheKey = `nl-report-dedup:${collegeId}:${scopeFingerprint}:${sha1(maskedQuestion)}`;
```

Properties this guarantees:

- Two HODs in the same department, same question → same key → shared cached scope-correct result. ✓
- Two HODs in different departments → different `departmentId` segment → different keys. ✓
- An HOD and a counsellor → different `role` and different `departmentId`/`personId`/`userId` segments → different keys. ✓
- Two staff users with `personId: undefined` → still differentiated by `userId`. ✓
- Admin vs. non-admin → different `role` (and different scope flags) → different keys. ✓

### §10.5 Audit + persistence additions

`NlReportQuery` document gains three optional fields:

```ts
role?: string;             // 'admin' | 'super_admin' | 'principal' | 'hod' | 'faculty' | 'staff'
personaType?: string;      // 'L-ADM' | 'F-HOD' | 'F-FAC' | 'ST-ADM-AC' | ... (informational)
authScopeApplied?: {
  departmentOnly: boolean;
  selfOnly: boolean;
  departmentId?: string;   // String form for storage; rehydrate as ObjectId on read
  personId?: string;
  userId?: string;
};
```

All optional; pre-004 (003-era) docs have them undefined. The stats `$facet` `byRole` sub-pipeline adds an upstream `$match: { role: { $exists: true } }` so legacy docs are excluded from `byRole` — they remain counted in `total`, `byStatus`, `byReport`.

### §10.6 Rollout flag — `RBAC_NL_ENFORCE`

**Semantic (closes prior OQ-2):** Per-request env read inside a wrapper middleware. Matches the precedent at `authorize.ts:21` for `RBAC_ENFORCE`. Live-flip per environment without process restart.

```typescript
// Pseudocode for the route mount in governance/routes.ts:
router.post('/nl-query',
  authenticate,
  (req, res, next) => {
    if (process.env.RBAC_NL_ENFORCE === 'true') {
      return authorize('governance', 'read')(req, res, next);
    }
    return requireRole(['admin', 'super_admin'])(req, res, next);
  },
  validate(nlQuerySchema), nlQueryController
);
```

**Per-endpoint-flag rationale:** This is the first per-endpoint RBAC rollout flag in the codebase (`RBAC_ENFORCE` is the master switch on `authorize()`). NL is the only endpoint where mistaken scope-leak is high-blast-radius (LLM-generated aggregation = unbounded query shape). Existing module endpoints already use `applyAuthScope()` in service-layer list functions and are governed solely by `RBAC_ENFORCE`. 004 is a one-off.

**Sunset:** A cleanup ticket schedules removal of `RBAC_NL_ENFORCE` 60 days post production-stable rollout, after which the wrapper collapses to direct `authorize('governance','read')`. Tracking ticket TBD by ops; spec records the intent.

**Sanity:** The `(RBAC_ENFORCE=false, RBAC_NL_ENFORCE=true)` combination is non-sensical (authorize would be a pass-through, granting any persona unscoped access). The wrapper middleware tolerates it without failing (authorize pass-through just sets `authScope` defaults), but the rollout playbook calls it out as "do not deploy this combo".

### §10.7 Refusal taxonomy

Existing 003 refusal `reason` values (unchanged): `cap_reached`, `timeout`, parser-specific reasons, `report_run_failed`.

New for 004:

- `report-not-scopable-for-role` — emitted when the eligibility gate detects `def.scopeEligibility.<dim> === 'admin-only'` AND the persona has `authScope.<dim> === true`. Sub-categorized by an additional optional `dimension: 'department' | 'self'` field on the refused response (`NlReportQuery.reasonDimension?: string`) so the FE can render a more specific banner ("Your role can't view department-scoped reports of this kind" vs. "Your role can't view self-scoped reports of this kind").
- `scope-unresolved` — emitted when the persona's scope flag is set but its discriminator is undefined (e.g., HOD with no `Faculty.departmentId`). Distinct from `report-not-scopable-for-role`: this is a **data quality** refusal, fixable by ops; the FE renders "We couldn't determine your department. Please contact admin to update your Faculty record."

The FE `reason: string` type continues to absorb new values without a wire-shape break. New optional `reasonDimension` field is rendered when present.

### §10.8 Test fixtures

Integration tests require multi-persona users seeded with the full Department → Branch → Student chain so `resolveUserScope` and the Branch lookup return non-empty results.

New helper: `backend/src/modules/governance/__tests__/helpers/seedRbacTestFixtures.ts` (renamed from earlier draft's `seedUsersAndPolicy.ts`; the helper seeds users + policies + the Department/Branch/Student linkage, not just policies).

Seed chain per tenant:

1. `User` with `{ role, personaType, personId }` — one per role being tested.
2. `Person` document for each user's `personId`.
3. For HOD/faculty: `Faculty` document `{ personId, collegeId, departmentId: <dept._id> }`.
4. `Department` document `{ _id, collegeId, name }`.
5. `Branch` documents `{ collegeId, departmentId, name }` — at least 2 branches per department to verify $in semantics.
6. `Student` documents distributed across branches + tenants (cross-tenant rows in the fixture prove `collegeId` filter still binds).
7. `Policy` documents from `DEFAULT_POLICIES` + the new §10.9 policies.
8. Redis cache flush between tests (`invalidateUserScope(userId)`).

The fixture seeds 2 tenants × {admin, HOD-tenant-A, faculty-tenant-A, HOD-tenant-B}, with students planted in both tenants so a scope leak would be detectable as cross-tenant data appearing in an HOD's results.

### §10.9 Policy seed plan

**Required additions to `backend/src/shared/rbac/defaults.ts`** before `RBAC_NL_ENFORCE='true'` per environment:

```typescript
// HOD: governance read, department-scoped.
{ role: 'hod', module: 'governance', action: 'read', effect: 'allow', priority: 800,
  isActive: true, scope: { departmentOnly: true },
  description: 'HOD: read governance reports for own department' },

// Faculty: governance read, department-scoped.
{ role: 'faculty', module: 'governance', action: 'read', effect: 'allow', priority: 700,
  isActive: true, scope: { departmentOnly: true },
  description: 'Faculty: read governance reports for own department' },

// Staff: explicit deny — overrides the 600-priority module:'*' fallback.
{ role: 'staff', module: 'governance', action: 'read', effect: 'deny', priority: 700,
  isActive: true,
  description: 'Staff base: deny governance reads (overridden per-persona in v1.5)' },
```

**Rollout sequence per environment:**

1. Deploy code (007ed1c-like commit) with `RBAC_NL_ENFORCE` unset / `'false'`. Behavior identical to today.
2. Run the seed loader to insert the 3 new policy rows into the `Policy` collection. Verify with a manual query that `evaluateAccess(collegeId, 'hod', 'F-HOD', 'governance', 'read')` returns the allow + departmentOnly scope.
3. Flip `RBAC_NL_ENFORCE='true'` via env var. Restart not required (per §10.6 the wrapper reads env per request).
4. Smoke-test from an HOD user fixture (one tenant) before opening to production HODs.
5. Monitor `byRole` stats + audit log for the first 24h.

**Idempotency:** the seed loader is upsert-safe; re-running it does not duplicate policies.

### §10.10 `runReport` eligibility gate placement

The gate fires INSIDE `runReport` BEFORE any side effects. Specifically:

```typescript
// backend/src/modules/governance/report-service.ts (pseudocode)
export async function runReport(
  collegeId: string,
  reportCode: string,
  params: Record<string, unknown>,
  performedBy: string,
  authScope: AuthScope,    // required (v1)
): Promise<ReportRunDoc> {
  const def = getReportDefinition(reportCode);
  if (!def) throw new AppError(404, 'Unknown report code');

  // ── 1. Eligibility gate (pre-side-effects) ─────────────
  if (authScope.departmentOnly && def.scopeEligibility.departmentOnly === 'admin-only') {
    throw new ScopeNotSupportedError(reportCode, 'department', 'role-not-eligible');
  }
  if (authScope.selfOnly && def.scopeEligibility.selfOnly === 'admin-only') {
    throw new ScopeNotSupportedError(reportCode, 'self', 'role-not-eligible');
  }
  if (authScope.departmentOnly && !authScope.departmentId) {
    throw new ScopeNotSupportedError(reportCode, 'department', 'scope-unresolved');
  }
  if (authScope.selfOnly && !authScope.userId) {
    throw new ScopeNotSupportedError(reportCode, 'self', 'scope-unresolved');
  }

  // ── 2. Side effects ────────────────────────────────────
  const runDoc = await ReportRun.create({ status: 'running', ... });
  try {
    const output = await def.run({ collegeId, authScope }, params);
    await ReportRun.findByIdAndUpdate(runDoc._id, { status: 'success', result: output.rows, ... });
  } catch (err) {
    await ReportRun.findByIdAndUpdate(runDoc._id, { status: 'failed', error: ... });
    throw err;
  }
  return ReportRun.findById(runDoc._id);
}
```

The NL service catches `ScopeNotSupportedError` and converts to the `report-not-scopable-for-role` or `scope-unresolved` refused response (with `reasonDimension`). Audit + persistence happen as for any refused response.

### §10.11 Phase B stub eligibility placeholders + ObjectId-wrap pattern

**Phase B stubs (all 9 unimplemented runners):** declare `scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' }` as a placeholder. Their `run: phaseBStub` still throws `PhaseBStubError`. The placeholder ensures the registry-wide type checks pass and forces Phase B authors to revisit the declaration when they un-stub.

**ObjectId wrap (for runner authors):** when building a `$match` value from an `AuthScope` field, always wrap as `new Types.ObjectId(authScope.<field>)`. Reason: Mongoose auto-casts strings inside `.find(...)` filters but NOT inside `$match` stages. A string-form scope value silently matches zero documents. The existing `aggregate-collegeid-pattern` regression-guard test catches the most common shorthand-bug variant but does not catch this case. Plan.md adds a runner-level comment + a unit test that asserts the runner builds `Types.ObjectId(...)` values.

### §10.12 FE handling of `authorize()` 403 + new refusal sub-categories

**003's NlQueryPanel** (path `admin-portal/src/components/governance/NlQueryPanel.tsx`):

- Today's mutation `onError` calls `setResponse(null)` — silent clear. For admin-only NL this is fine; for 004's non-admin surface it's a dead-end.
- **Change:** on `error.response?.status === 403`, render a policy-denied banner with copy "Your role can't run governance reports. Contact admin if this is incorrect." Do NOT translate 403 → 200 at the BE (keeps wire semantics standard).
- **Change:** on refused responses with `reason === 'report-not-scopable-for-role'`, render a friendlier banner that includes `reasonDimension` (e.g., "Your role can't view department-scoped data of this kind. Try one of: <chip-list>"). Render `reason === 'scope-unresolved'` as "We couldn't determine your department/profile data. Contact admin."
- **Test:** `NlQueryPanel.test.tsx` gains 3 new cases: 403, `report-not-scopable-for-role` with `reasonDimension: 'department'`, and `scope-unresolved`.

## 11. SDD Workflow Notes

- **Complexity score (post-amendment):** ~6 (auth touch +2, multi-component +1, integration test +1, RBAC sensitivity +1, policy-seed dependency +1). Slight upgrade from earlier draft's 5 due to §10.9 seed plan. Still standard 3-validator team; no enhanced team needed.
- **GATE 3 audit (pre-implementation):** Spec amendments addressed all 5 CRITICAL and 6 HIGH findings from gate2-*.md reports. Resolution log in `gate2-resolution.md`. Re-validation by an additional pass is recommended only if the user opts in; otherwise GATE 3 proceeds.
- **Phase 8 story ordering:** Stories 1 and 2 share infrastructure (eligibility gate, two-step Branch lookup, registry declarations) — implemented together. Story 5 (`byRole` stats) is independently testable once `NlReportQuery` gains the `role` field. Story 6 (FE) lands after BE stories 1–5 are green.
- **Phase B contract (Risk row 1):** post-004, the SDD pre-implementation check for any new report runner includes "if scopeEligibility declares anything other than `admin-only`, an RBAC integration test must exist in `__tests__/<runner>-rbac.test.ts`." This becomes part of the SDD `/sdd` template for future report-runner work.
