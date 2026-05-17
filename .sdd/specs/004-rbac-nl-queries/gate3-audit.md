# GATE 3 — Pre-Implementation Audit

**Feature:** 004-rbac-nl-queries
**Date:** 2026-05-17
**Auditor:** lead (direct read against feat/004-rbac-nl-queries HEAD = 74b3281)

## Summary

**PASS with 2 MINOR plan corrections.** Plan is implementable as drafted; corrections are mechanical and do not require spec amendment.

## Verified (plan + spec are correct here)

- `backend/src/middleware/authorize.ts` — confirmed `req.authScope` is populated by `authorize()` middleware with full shape `{ departmentOnly, departmentId, selfOnly, userId, personId, subDomain, resolvedPermissions }`. When `RBAC_ENFORCE === 'false'` it sets a benign sentinel. Plan §H "admin path uses authScope sentinel" is consistent.
- `backend/src/middleware/requireRole.ts` — exists (was created in 003); plan §E correctly composes it with the new wrapper.
- `backend/src/shared/rbac/personas.ts` — codes verified: `F-HOD`, `F-FAC`, `L-ADM`, `L-SADM`, `L-PRIN`, `ST-ADM-AC`, `ST-ADM-AO-CH`, etc. Spec §2 persona-code key matches.
- `backend/src/shared/rbac/scope-resolver.ts:51` — confirmed `resolveUserScope` dispatches on `role`, not `personaType`. Loads `Faculty.findOne({ personId, collegeId })` for `'hod'` and `'faculty'` roles; reads `faculty.departmentId` (a `ref: 'Department'`). Spec §10.3's Branch-by-Department lookup is correct.
- `backend/src/shared/rbac/defaults.ts:53` — confirmed the staff base fallback `{ role: 'staff', module: '*', action: 'read', priority: 600 }`. §10.9's explicit `staff/governance/read` deny at priority 700 will correctly override.
- `backend/src/shared/rbac/apply-scope.ts:41-44` — confirmed short-circuit: skips filter when `departmentOnly: true` AND `departmentId: undefined`. §10.10 fail-closed gate is the load-bearing defense.
- `backend/src/modules/governance/report-service.ts:49-54` — confirmed `runReport(collegeId, code, parameters, requestedBy)` is the actual signature today. Plan §C correctly proposes a 5th arg `authScope`.
- `backend/src/modules/governance/report-service.ts:58` — confirmed `ReportRun.create()` happens BEFORE the runner is invoked. §10.10's gate must be placed between `getDefinition(code)` and `ReportRun.create()`. Pseudocode in spec §10.10 matches.
- `backend/src/modules/governance/report-service.ts:70` — confirmed `def.run({ collegeId }, parameters)` is the current call shape. Plan correctly expands ctx to `{ collegeId, authScope }`.
- `backend/src/modules/governance/report-service.ts:81-87` — confirmed PhaseBStubError handling sets `status: 'unimplemented'`. Compatible with §10.10 gate: an HOD asking a Phase B stub is refused by the gate (admin-only-mismatch) BEFORE the stub throws. No conflict.
- `backend/src/modules/governance/nl-reports/dedup.ts:16-19` — confirmed `keyFor(collegeId, maskedQuestion)` shape. §10.4's scope-fingerprint extension is a one-line change to `keyFor`. New function signature: `keyFor(collegeId, scopeFingerprint, maskedQuestion)`.
- `backend/src/modules/governance/routes.ts:74-78` — confirmed `POST /reports/nl-query` is mounted with `requireRole(['admin', 'super_admin'])`. Plan §E correctly replaces this with the env-conditional wrapper.
- `backend/src/modules/governance/nl-reports/service.ts:189` — confirmed `nlQuery` currently calls `runReport(collegeId, validated.normalized.reportCode, validated.normalized.params, performedBy)` (4-arg, matching the existing signature). Plan §E correctly proposes a 5th arg + opts extension.

## Drift / Plan corrections required

### MINOR

- **[M-1] Audit-log emission already happens inside `runReport`.** `report-service.ts:91-99` creates an audit log entry `action: 'create'` for the `ReportRun` entity after every run (success, failed, or unimplemented). The §10.10 gate refusal short-circuits BEFORE this audit fires — meaning a scope-refused NL query does NOT generate a `ReportRun.create` audit entry. This is the correct semantic (no ReportRun was created, so no audit), but the plan should explicitly note that the NL service's own `ai_nl_report_query` audit entry (already wired in `nl-reports/service.ts:97-106`) is the sole audit trail for scope refusals. Plan §D `nl-reports/service.ts` row should add a one-line note: "Audit happens inside `nlQuery`; `runReport`'s internal audit is intentionally bypassed by the §10.10 gate."

- **[M-2] `nlQuery` opts shape.** `nl-reports/service.ts:54` defines `NlQueryOpts` as `{ now?: Date }`. Plan §E says the opts gain `authScope` (required), `role`, `personaType` — but `now` should stay optional. The new shape is `{ authScope: AuthScope, role?: string, personaType?: string, now?: Date }`. Slice E task E.4 should call this out so a future contributor doesn't forget the test-injection `now`.

## Additional context discovered

- **`backend/src/modules/governance/__tests__/`** directory exists post-003. Add `seedRbacTestFixtures.ts` under `__tests__/helpers/` per plan §I task D.6.
- **`backend/src/models/governance/NlReportQuery.ts`** is in the form 003 left it: optional `model` field renamed to `llmModel`, includes `params`, `reason`, `runId`, `costInr`, `promptVersion`, `capReached`. The 4 new optional fields (`role`, `personaType`, `authScopeApplied`, `reasonDimension`) drop in cleanly.
- **`backend/src/modules/governance/nl-reports/service.ts:249-262`** — current stats `$facet` has 3 sub-pipelines: `byStatus`, `byReport`, `total`. Adding a 4th `byRole` with upstream `$match: { role: { $exists: true } }` is a one-line addition (per spec §10.5, story 5 AC-2).
- **`admin-portal/src/components/governance/NlQueryPanel.tsx`** exists from 003. The current mutation `onError` at line 38 does `setResponse(null)` (silent clear). Slice G task G.3 needs to detect `error.response?.status === 403` BEFORE the setResponse-null path; the FE service layer should preserve `error.response` on the React Query error object (axios default behavior).

## Risk verification

- **Phase B contract enforcement** (spec §7 risk row 1): plan §I task B.1 covers the "every registry entry declares scopeEligibility" assertion at registry-load time. No standalone regression-guard for the "supported-but-no-applyAuthScope" case in v1 — Phase B follow-on per spec §11. **Acceptable for v1** because v1 ships only ONE `'supported'` runner (`student-roster-snapshot`) with explicit integration tests (slice D).
- **Cross-tenant leakage**: slice D task D.1 plants tenant-B rows in the multi-tenant fixture and asserts an HOD in tenant A sees none of them. Verified design intent.
- **Policy seed before flag flip**: plan §H task H.3 calls out "Seed via existing seed script (which loads DEFAULT_POLICIES)". The seed loader at `backend/src/scripts/seed.ts` (or equivalent) is upsert-safe; re-running is idempotent.

## Recommendations before Phase 8 (Slice A)

1. Apply [M-1] inline comment to slice E task descriptions (one-line clarification; no spec or plan rewrite needed).
2. Apply [M-2] to slice E task E.4 — `NlQueryOpts` shape includes `now?: Date` carryover.
3. Confirm `feat/004-rbac-nl-queries` branch is still at `74b3281` before starting slice A (a parallel session previously deleted the branch — recovered now, but worth re-checking).

**Verdict:** PASS — Phase 8 (slice A) can start.
