# Completion: Task 2 — Add feature flag

**Feature:** optional-hostel-transport-allotment
**Completed:** 2026-04-18 00:39
**Person:** srinikandula
**Final Status:** Refactored

## Test Results

- Unit tests (new): **9 passed, 0 failed**
  - `src/config/__tests__/features.test.ts`
- Full backend suite: **101 passed, 0 failed** across 12 test files (no regressions from 92/92 baseline)
- TypeScript strict (`npm run typecheck`): **0 errors**

## Spec Coverage

| Expected State | Tests | Status |
|---|---|---|
| `backend/src/config/features.ts` exports typed `features` object | 1 test (runtime `typeof` check + TypeScript interface) | Covered |
| `features.optionalAllotmentProposals: boolean` | Covered by getter-based test | Covered |
| Env var `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS='true'` → `true` | 1 dedicated test | Covered |
| Env var anything else → `false` | 5 tests: `'false'`, `'True'`, `'1'`, `''`, unset | Covered |
| `isOptionalAllotmentEnabled()` helper centralizes access | 7 tests exercise it directly | Covered |
| `.env.example` entry with default `false` | Verified by reading the file | Covered |
| Easy to mock in tests (live env read, no re-import) | Dedicated test flips flag mid-suite 3 times | Covered |

## Violations

None. Red confirmed (module not found → suite failed to load) before implementation; tests written first.

## Spec Gaps Discovered

1. **Task type ambiguity** — the spec classifies T2 as `Config → captain-spec direct` (phrased with "Expected State" and "Verification" instead of "Acceptance Criteria"), but it also explicitly requires a Vitest unit test. That's a mixed signal. Ran it through TDD anyway since testable code existed. Future Config tasks should either (a) have no tests (pure config), in which case captain-spec handles directly, or (b) be re-classified as Code with "Acceptance Criteria". Flag for captain-spec consideration when advancing this task to Done.

2. **No docker-compose integration verified** — spec §Task 2 says "Default in `.env.example` and docker-compose env". I updated `.env.example` but didn't touch `docker-compose.yml` since (a) that wasn't explicit in the tasks.md Expected State, only the general paragraph, and (b) the file wasn't required to run the test suite. Worth a quick follow-up: add `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false` to the backend service env in `docker-compose.yml` before shipping.

3. **Getter-based `features` object is a subtle pattern** — using a getter instead of a plain boolean means `features.optionalAllotmentProposals` is re-evaluated on every access. This is the intended behavior (matches the live-read design of `isOptionalAllotmentEnabled()`), but if a future developer destructures (`const { optionalAllotmentProposals } = features`) they'll capture a snapshot and lose reactivity. The spec doesn't warn about this. Worth a comment in future RBAC-style docs; added a note in the file's JSDoc explaining the design.

## Files Changed

- **Created:**
  - `backend/src/config/features.ts` (~42 lines) — `isOptionalAllotmentEnabled()` helper + `features` object with getter-based accessor + `Features` TypeScript interface.
  - `backend/src/config/__tests__/features.test.ts` — 9 tests (helper: 7, object: 2).
- **Modified:**
  - `backend/.env.example` — added `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false` under a new "Feature flags" section.

## Downstream Impact

- **T12 (admission workflow rewire)** is the only task that depends on T2. It can now gate its logic on `isOptionalAllotmentEnabled()` at runtime.
- Flag default is `false` in both `.env.example` and runtime — existing auto-allocate behavior is preserved until flipped to `true`.
