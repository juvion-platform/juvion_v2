# Completion: Task 4 — E2E integration tests

**Feature:** global-people-search
**Completed:** 2026-04-19 13:58
**Person:** srinikandula
**Final Status:** Done

## Test Results
- E2E tests: **12 passed, 0 failed** (`backend/src/__e2e__/modules/people-search.test.ts`)
- Full backend suite (unit): 262/262 still passing
- TypeScript strict: 0 errors

## Spec Coverage (AC-22 through AC-27 + PII)

| HTTP contract test | Status |
|---|---|
| 200 happy path with valid token + query | ✓ |
| 400 on q too short | ✓ |
| 400 on disallowed chars | ✓ |
| 400 on missing q | ✓ |
| 401 without auth | ✓ |
| 400 on limit > 25 | ✓ |
| Response shape: counts has all 5 role keys | ✓ |
| PII negative assertion at HTTP boundary | ✓ |
| Rate-limit: 60 passes + 61st 429 | ✓ (passed in 12s — no flakiness) |
| Admin can pass includeInactive=true | ✓ |
| Non-admin includeInactive silently downgraded | ✓ |

## Files Changed
- **Created:** `backend/src/__e2e__/modules/people-search.test.ts` — 12 tests

## Violations
None.

## Spec Gaps Discovered
None. All HTTP-boundary assertions covered.

## Notes
- The rate-limit test takes ~12 seconds (60 sequential requests) — acceptable.
  If this becomes flaky in CI we can parallelize with `Promise.all` within the
  same window.
- PII negative assertion at the HTTP boundary is a belt-and-suspenders check on
  top of the service-level one (T2 test 11). Catches regressions where someone
  extends the controller to "enrich" the response with extra fields.
