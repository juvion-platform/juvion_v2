# GATE 3 — Pre-Implementation Audit

**Feature:** 003-nl-report-queries
**Date:** 2026-05-14
**Auditor:** lead (direct read, same approach as 002's GATE 3)

## Summary

**PASS with 1 MINOR plan correction + 1 MINOR defensive add.** Plan is implementable as drafted.

## Verified (plan is correct here)

- `backend/src/middleware/authorize.ts` exists; no `requireRole.ts` yet — clean to add.
- `backend/src/models/governance/` exists with siblings (`ReportRun`, `Committee`, etc.) — natural home for `NlReportQuery.ts`.
- `backend/src/modules/governance/report-service.ts` exposes `runReport(collegeId, code, parameters, requestedBy)` at line 49 — note the **4-arg signature**, not the `(reportCode, params)` shorthand the plan implied.
- `runReport` already persists a `ReportRun` doc and handles `PhaseBStubError` by setting `status: 'unimplemented'` (line 81-83). Defense: NL service must treat `runDoc.status !== 'success'` as a refusal even though the allow-list should prevent us reaching a stub.
- `backend/src/modules/governance/routes.ts` mounts under `/reports/...` — proposed `POST /reports/nl-query` and `GET /reports/nl-query/stats` are conflict-free with the existing `/reports/definitions`, `/reports/runs`, `/reports/run/:code`.
- `admin-portal/src/pages/governance/ReportsPage.tsx` (12.2K) — single-file page. Uses `useState<ReportDefinition | null>` for the active picker + `useState<Record<string, unknown>>` for params. "Run as picker" means hoisting `setActive` + `setParams` so `NlQueryPanel` can fire callbacks.
- `admin-portal/src/services/governance.ts` (5.7K) — exists, ready for `runNlQuery` + `getNlReportStats` clients.
- `AuditAction` union has `'create'` already used for `ReportRun` creation (line 96 of `report-service.ts`) — the new `'ai_nl_report_query'` action is for the **NlReportQuery** entity, not for the underlying ReportRun. No conflict.

## Drift / Plan corrections required

### MINOR

- **[M-1] `runReport` signature.** Plan said `runReport(reportCode, params)`. Actual: `runReport(collegeId, code, parameters, requestedBy)`. NL service must pass all four; `requestedBy` is the same `performedBy` we already thread through.
- **[M-2] Defensive: handle `unimplemented` / `failed` outcomes from `runReport`.** Even though the allow-list should prevent the LLM from picking a Phase B stub, `runReport` always persists a `ReportRun` doc with `status`. The NL service should check `runDoc.status === 'success'` and convert anything else to a refused response:
  ```typescript
  if (runDoc.status !== 'success') {
    // persist NlReportQuery as refused with reason 'report_run_failed'
    return { status: 'refused', reason: 'report_run_failed', supportedReports: ALLOWED_REPORTS, ... };
  }
  ```
  Plan §service.ts step 7 should reflect this.

## Additional context discovered

- `backend/src/modules/governance/__tests__/` does not exist yet — first test in this module creates the dir. Other modules follow that pattern.
- The frontend's `ReportsPage` has a "Hub → Active report" two-state. The NL panel lives on the hub view (alongside the report picker grid) and, on a matched response, switches the page to active = the chosen ReportDefinition with params pre-filled. The plan's Wave 5.2 already captures this.

## Recommendations before Wave 1

1. Apply [M-1] to `plan.md` §D / `tasks.md` Wave 3 task 3.5.
2. Add [M-2] as an explicit defensive step in `plan.md` §service.ts and `tasks.md` Wave 3 task 3.5.

**Verdict:** PASS — Phase 8 can start.
