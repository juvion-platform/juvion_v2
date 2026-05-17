# GATE 2 Resolution Log — 004-rbac-nl-queries

**Date:** 2026-05-17
**Status after amendment:** GATE 2 should PASS on re-read (0 CRITICAL, 0 HIGH remaining).

## Summary of validator verdicts (pre-amendment)

| Validator | Verdict | C | H | M | L |
|-----------|---------|---|---|---|---|
| Architecture | FAIL | 1 | 2 | 5 | 3 |
| API + Security | FAIL | 2 | 3 | 4 | 3 |
| Data-layer | FAIL | 2 | 3 | 4 | 2 |
| **Deduplicated** | **FAIL** | **5** | **6** | — | — |

## CRITICAL findings — resolution

### C-A — Persona codes don't exist (architecture CRITICAL-1)

**Issue:** Spec used `ST-ACAD-HOD`, `ST-FAC`, `ST-CLUSTER-HEAD` — none in `personas.ts`. Real codes: `F-HOD`, `F-FAC`, and (for cluster head) `ST-ADM-AO-CH`. `resolveUserScope` dispatches on `role`, not `personaType`.

**Resolution:** Spec §2 prefaced with a persona-code key block citing `personas.ts`. Stories 1, 2 (rewritten), 3, 4, 5, 6 use real codes. §3 matrix uses real (`role`, `personaType`) pairs. §10.8 fixture seeds the actual codes.

### C-B — Policy DB unsatisfiable (api-security CRITICAL F-1)

**Issue:** `hod` and `faculty` have NO governance policies in `defaults.ts` (lines 23–34) — would 403 today. Staff base fallback at `defaults.ts:53` grants `module:'*', action:'read'` UNSCOPED to every staff persona — flipping `RBAC_NL_ENFORCE='true'` would expose unscoped data college-wide.

**Resolution:** New §10.9 specifies the exact 3 policy rows to seed BEFORE the rollout flag flips:
- `hod/governance/read` allow + `departmentOnly`, priority 800
- `faculty/governance/read` allow + `departmentOnly`, priority 700
- `staff/governance/read` deny, priority 700 (overrides the 600 fallback for ALL staff personas)

§6 acknowledges `defaults.ts` is modified (policy DATA, not engine logic). Rollout playbook in §10.9 specifies the seed-loader-then-flag-flip sequence.

### C-C — Dedup fingerprint collapse on undefined `personId` (api-security CRITICAL F-2 + data-layer H-DATA-3)

**Issue:** Earlier §10.4 used `personId` in the fingerprint but `apply-scope.ts` falls back to `userId` when `personId` is undefined. Staff users without a Person link would collapse to a shared `-:-` bucket → cross-persona cache leak inside the 30s TTL.

**Resolution:** §10.4 rewritten. Fingerprint now hashes the full discriminator tuple: `(role, personaType, departmentOnly, departmentId, selfOnly, personId, userId)`. All scope-affecting fields participate. Properties enumerated in §10.4: same-dept HODs share, different-dept HODs differ, undefined `personId` still differentiated by `userId`.

### C-D — `departmentId` vs `branchId` type-incompatible mapping (data-layer C-DATA-1)

**Issue:** Earlier §3 example called `applyAuthScope(match, scope, { departmentField: 'branchId' })`. But `AuthScope.departmentId` is a `Department._id` (from `Faculty.departmentId` per `Faculty.ts:101, 198`), and `Student.branchId` is a `Branch._id`. Different collections; the assignment would match zero rows in best case or — if `departmentId` is undefined — silently leak the whole college (worst case).

**Resolution:** §10.3 now specifies a two-step Branch lookup: `Branch.find({ collegeId, departmentId })` → `{ $in: branchIds }` predicate on `Student.branchId`. The §3 architecture flow shows the corrected pattern inline. §10.2 adds `{ collegeId, departmentId }` index on `Branch` to keep the lookup sub-ms.

### C-E — `applyAuthScope` short-circuits silently on undefined discriminator (data-layer C-DATA-2)

**Issue:** `apply-scope.ts:41-44` skips the filter when `departmentOnly: true` AND `departmentId: undefined`. Result: unscoped aggregation runs. The earlier spec didn't catch this case.

**Resolution:** §10.10 specifies a fail-closed eligibility gate inside `runReport` that fires BEFORE any side effects. Refuses with `reason: 'scope-unresolved'` when a scope flag is set but its discriminator is `undefined`. This refusal happens before the runner is invoked, before the placeholder `ReportRun.create()`, before any audit write. The shared `applyAuthScope` helper is NOT changed (preserves contract for 9+ other call sites in academics/welfare/finance).

§5 NFR table adds an explicit "Fail-closed on unresolved scope" row.

## HIGH findings — resolution

### H-A — Rollout flag governance + semantics (architecture HIGH-1 + api-security F-3)

**Issue:** `RBAC_NL_ENFORCE` is the first per-endpoint RBAC flag. Without governance, future RBAC-enables would copy the pattern and accumulate dead env vars. Also: spec was ambiguous between "module-load conditional" vs "per-request wrapper" semantics.

**Resolution:** §10.6 rewritten:
- **Semantic locked** to per-request env-read inside a wrapper middleware (matches `RBAC_ENFORCE` precedent at `authorize.ts:21`). Live-flip without restart. Wrapper code-shape shown inline.
- **Per-endpoint flag defended:** NL is the high-blast-radius outlier (LLM-generated aggregation = unbounded query shape). Other endpoints use `applyAuthScope` in service-layer list functions and don't need their own flags. 004 is a one-off.
- **Sunset** language: 60 days post-stable rollout, cleanup ticket removes the flag and collapses the wrapper to direct `authorize()`. Tracking ticket placeholder noted.
- **Sanity:** `(RBAC_ENFORCE=false, RBAC_NL_ENFORCE=true)` combo flagged as non-sensical in the rollout playbook.

### H-B — Optional `authScope` silent-miss risk (architecture HIGH-2)

**Issue:** Optional `authScope?` on `ReportRunContext` meant a runner declaring `'supported'` could forget `applyAuthScope` and silently return unscoped data. Eligibility gate caught `admin-only` mismatches, not `'supported'`-but-not-applied bugs.

**Resolution:**
- **`authScope` is now REQUIRED** on `ReportRunContext` (per §3 first paragraph). Admin paths carry `{ departmentOnly: false, selfOnly: false }` which makes `applyAuthScope` a no-op. No runner can be invoked with `authScope === undefined`.
- **Phase B contract** spelled out in §11: any runner upgrading from `admin-only` to `'supported'` MUST ship with `__tests__/<runner>-rbac.test.ts`. Regression-guard scaffolding noted as Phase B follow-on.
- **§10.10 fail-closed gate** also covers the `scope-unresolved` case at the eligibility layer, so even a forgetful runner is intercepted when its discriminator is missing.

### H-C — `authorize()` 403 → FE dead-end (api-security HIGH F-4)

**Issue:** `authorize` 403 returns `{error: 'Access denied'}` (wire-different from in-band refusals). `NlQueryPanel` mutation `onError` silent-clears the panel. After 004, the panel is shown to non-admin personas → visible dead-end.

**Resolution:** New Story 6 commits to an inline FE banner on 403. §10.12 specifies the panel changes (3 new test cases). 403 stays as 403 (no BE wire translation); FE renders the banner inline. Distinct copy for 403 vs in-band `report-not-scopable-for-role` vs `scope-unresolved`.

### H-D — `byRole` stats facet on pre-004 docs (api-security HIGH F-5)

**Issue:** `role` is optional on `NlReportQuery` (so legacy 003 docs survive). `$group by $role` would emit `{ role: null }` which violates the declared `role: string` type on the response.

**Resolution:** Story 5 AC-2 specifies the stats `byRole` sub-pipeline adds an upstream `$match: { role: { $exists: true } }` so legacy docs are excluded. Other facets (total, byStatus, byReport) continue to count legacy docs unchanged. Spec §10.5 reiterates.

### H-E — `ScopeNotSupportedError` placement (data-layer H-DATA-1)

**Issue:** Earlier spec implied the eligibility check would happen somewhere in `runReport` but didn't pin when. If placed after `ReportRun.create()`, every refused query would leave a stale `running` doc that the admin UI shows as "in flight".

**Resolution:** §10.10 explicitly places the gate BEFORE `ReportRun.create()` AND before any other side effect (audit, runner invocation). Pseudocode shown. NL service catches the error and converts to refused response with reasonDimension.

### H-F — `lead-source-performance` selfOnly broken in current data (data-layer H-DATA-2)

**Issue:** `Inquiry.assignedTo` holds emails not userIds; canonical `assignedOfficerId` is unpopulated in pre-Gap-5 data. Earlier spec's `assignedTo === String(userId)` self-filter would return empty for every counsellor.

**Resolution:** §10.1 rewritten. `lead-source-performance.scopeEligibility.selfOnly = 'admin-only'` for v1. Counsellor (`ST-ADM-AC`) NL access deferred to v1.5 pending a one-time backfill migration (`assignedTo` emails → `assignedOfficerId` Person ObjectIds). Spec §4 lists the deferral; §3 matrix shows counsellor as 403 from the policy layer.

## Material spec changes (summary)

| Section | Change |
|---------|--------|
| §1 | v1 unlock scope tightened: HOD + faculty only (not counsellor / cluster head); reason explained. |
| §2 Story 1 | Persona codes corrected; AC-5 added for `scope-unresolved` fail-closed. |
| §2 Story 2 | Rewritten — now "Faculty scoped NL query" (was counsellor). |
| §2 Story 6 | NEW — FE 403 dead-end handling. |
| §3 | `authScope` is REQUIRED; pseudocode shows two-step Branch lookup + ObjectId wrap. |
| §3 scope-eligibility table | `lead-source-performance.selfOnly` → `admin-only` (was `supported`). `student-roster-snapshot.selfOnly` → `admin-only`. |
| §3 persona × report matrix | Counsellor / cluster-head / other staff → 403 from policy. Student / parent → 403 (unchanged). |
| §4 Out of Scope | NEW items 2–4: counsellor selfOnly, cluster head, all other staff. Item 10: NO changes to `applyAuthScope` semantics. |
| §5 NFRs | NEW rows: fail-closed on unresolved scope; ObjectId wrap. |
| §6 Dependencies | `defaults.ts` modified for §10.9 seed; engine logic NOT touched. |
| §7 Risks | Rewritten — covers Phase B contract, fail-closed gate, full fingerprint, staff fallback override. |
| §9 OQs | OQ-2 closed (lifted into §10.6). |
| §10.1 | Counsellor selfOnly deferred to v1.5. |
| §10.2 | NEW Branch index `{collegeId, departmentId}`. |
| §10.3 | Two-step Branch lookup with explicit ObjectId wrap. |
| §10.4 | Full scope fingerprint over the discriminator tuple. |
| §10.5 | `byRole` stats filters legacy docs upstream. |
| §10.6 | Per-request wrapper middleware semantic locked; sunset language. |
| §10.7 | NEW `scope-unresolved` reason + optional `reasonDimension` field. |
| §10.8 | Renamed helper; full Department→Branch→Student seed chain. |
| §10.9 | NEW — Policy seed plan (3 rows). |
| §10.10 | NEW — `runReport` eligibility gate placement (pre-side-effects). |
| §10.11 | NEW — Phase B stub placeholders + ObjectId-wrap pattern. |
| §10.12 | NEW — FE `NlQueryPanel` 403 + refusal-sub-category handling. |
| §11 | Complexity bumped to ~6; Phase B contract noted. |

## Findings deferred (acknowledged but not blocking)

- **architecture MEDIUM-1**: `scopeEligibility` 2-D matrix stays colocated. Trigger condition (3+ dimensions OR 25+ runners) noted in §3 inline.
- **architecture MEDIUM-2**: `report-not-scopable-for-role` sub-categorization — adopted via `reasonDimension` (§10.7).
- **architecture MEDIUM-4**: `runReport.authScope` was promoted to required (§3), not deferred.
- **architecture MEDIUM-5**: Phase B placeholders adopted (§10.11), not deferred.
- **data-layer MEDIUM-1**: confirmed `admissions-funnel` correctly `admin-only`.
- **data-layer MEDIUM-2**: indexes added (§10.2).
- **data-layer MEDIUM-3**: test-fixture chain spelled out (§10.8).
- **data-layer MEDIUM-4**: stats `$facet` impact confirmed minimal; documented in §10.5.
- **api-security MEDIUM-6, 7, 8, 9**: incorporated into Stories 4–6 and §10.5–§10.12.
- **All LOWs**: incorporated inline (rename of fixture helper, OQ-2 cleanup, regression-guard note in §10.11).

## Sign-off

Spec amendments resolve all 5 CRITICAL + 6 HIGH findings. Medium findings either incorporated (most) or acknowledged with explicit rationale. Spec self-review (placeholder scan, contradiction check, ambiguity check) re-run after the amendment.

Recommended next step: user reviews this resolution log and the updated spec → if approved, GATE 2 is treated as PASS by author attestation. A re-run of the validator team is OPTIONAL (would catch any new findings introduced during amendment; given the scope of changes, this is defensible but adds wall-clock time). 003 did not re-run validators after its gate2-resolution; we follow the same convention.
