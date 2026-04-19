# Completion: Task 11 — API reference + QA/deploy checklist

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/docs/api/people-search.md`
  - Full API reference following the style of `campus-allocations.md`
  - Sections: endpoint, query params, response shape, error responses,
    RBAC scope matrix, `includeInactive` semantics, performance notes,
    curl example
  - PII guarantees called out as a top-level section with enforcement
    mechanism (service-level projection + HTTP-boundary e2e test)

- **Created:** `backend/docs/api/people-search-qa-checklist.md`
  - Pre-flight checklist for backend + frontend deploys
  - Index-creation commands for large collections (background: true)
  - Per-role smoke-test matrix (5 roles × 3 canonical queries)
  - Keyboard & UX flow checks
  - Rate-limit verification steps
  - Observability SLO recommendations (p95 < 500ms, alert > 1000ms)
  - Known-limitations section documenting the 4 deferred items

## Verification
- Documents render correctly in GitHub markdown preview (tables, code fences).
- Cross-references to `.captain/specs/global-people-search/` are valid paths.
- Cross-reference to `routeForResult` helper matches actual code.

## Spec Gaps Discovered
None. The spec gap work surfaced during T5–T10 is captured in the
checklist's "Known limitations" section with rationale.

## Violations
None.

## Notes
- The QA checklist is an executable document — reviewers can tick boxes
  in the deployment ticket. The smoke-test matrix is designed to run
  in < 15 minutes per environment.
- Performance numbers (p95 < 300ms for 500-person, < 600ms for 5000-person)
  are modeled extrapolations, not measured. The observability section
  turns them into alertable SLOs so real data replaces the estimates
  within the first week of prod.
