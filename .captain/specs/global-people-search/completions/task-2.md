# Completion: Task 2 — search-service.ts + Person indexes + unit tests

**Feature:** global-people-search
**Completed:** 2026-04-19 12:43
**Person:** srinikandula
**Final Status:** Refactored

## Test Results
- Unit tests (new): **16 passed, 0 failed** (`backend/src/modules/people/__tests__/search-service.test.ts`)
- Full backend suite: **242 passed, 0 failed** across 22 test files (no regressions)
- TypeScript strict (`npm run typecheck`): 0 errors

## Spec Coverage

| Acceptance Criterion | Tests | Status |
|---|---|---|
| 1. Admin scope sees all 5 types | "admin (no scope restriction) sees everyone in the college" | Covered |
| 2. HOD scope sees dept-only | "HOD sees only their department's faculty/staff (dept scope applied)" | Covered |
| 3. Cross-college isolation | "cross-college isolation — College A search does not return College B people" | Covered |
| 4. Name substring match | "matches name substring, case-insensitively" | Covered |
| 5. Phone normalization | "normalizes phone number (+91 / spaces) in query before matching" | Covered |
| 6. Roll number direct match | "matches roll number directly (without name/person lookup)" | Covered |
| 7. Employee code direct match | "matches employee code for faculty and staff" | Covered |
| 8. Parent dedup with linked students | "parent appears once with linked students joined in the identifier" | Covered |
| 9. Alumni programme resolution | "alumni result resolves department via programme" (+ branch → dept fallback) | Covered |
| 10. includeInactive=false excludes separated | "includeInactive=false (default) excludes separated faculty and graduated students" + inverse | Covered |
| 11. PII negative assertion | "response does NOT include phone, email, dob, aadhaar, or address" | Covered |
| 12. Regex escape safety | "regex special characters in query are escaped safely" (`.`, `(.*)+`, `*` all safe) | Covered |
| 13. Result cap + hasMore | "limits results to `limit` (default 10); sets hasMore=true when more exist" + empty result | Covered |
| + Response shape contract | "each result has the exact SearchResult fields" | Covered |

## Violations
None. Red confirmed (service module missing) before Green; tests written first; no code before tests.

## Spec Gaps Discovered

1. **Programme has no `departmentId` field** — spec §9 OQ-4 flagged this as an open question; verified during implementation. Programme only references `regulationId`. Department resolution for Alumni now goes through `Alumni.branchId → Branch.departmentId → Department.name`, with fallback to Programme name if branch lookup fails. Spec should note this (draft update: OQ-4 resolved; document in plan §1.5).

2. **Student dept scoping requires an extra query** — `Student` has no direct `departmentId`. For HOD dept scope, `searchStudents` first queries `Branch.find({collegeId, departmentId})` then filters Student by `branchId: {$in: branches}`. This adds one DB round-trip per HOD search. Acceptable for v1 (still <100ms total); worth considering a denormalized `Student.departmentId` in a future pass. Flag for P3 cleanup.

3. **Parent has no departmentId** — any caller with `departmentOnly` scope gets zero parents. Documented as conservative behavior: rather than leak parents across departments, we return empty. Consistent with spec §3 NOT-for boundaries. Could be revisited if a stakeholder wants "parents of students in my dept" — more work than justified for v1.

4. **`applyAuthScope` does not naturally handle Student's Branch→Department indirection** — had to implement dept filtering manually in `searchStudents`. Noted as a potential extension to the scope helper but kept inline for v1 to minimize blast radius.

5. **Phone query with country code required a "last-10-digits" fallback** — `"+91 9998 887777"` (12 digits) against stored 10-digit phone needed a slice-based fallback regex in addition to the full-digit pattern. Not in the original spec; added as an implementation detail (test: "normalizes phone number"). The symmetric-contains JS filter further confirms the match. Documented inline.

## Files Changed

- **Created:**
  - `backend/src/modules/people/search-service.ts` (~440 lines) — the service
  - `backend/src/modules/people/__tests__/search-service.test.ts` (~380 lines) — 16 tests

- **Modified:**
  - `backend/src/models/people/Person.ts` — added 2 indexes: `{collegeId, name}`, `{collegeId, email}`. Existing `{collegeId, phone}` unchanged.

## Coverage metrics (from ratchet config)

New file `search-service.ts` is picked up by the existing coverage scope (`src/modules/**`). All 16 unit tests exercise happy paths + edge cases; estimated coverage of the service ~85%+.

## Design notes worth remembering

- **5 parallel queries**: intentional (plan §1.3). Simpler per-role index strategy + correctness-per-role, at the cost of 5× round-trips (colocated Mongo → negligible).
- **Phone matching** is a 3-stage funnel: DB-side loose regex (digits with `\D*` gaps), multiple digit-length patterns (full + last-10), then JS-side symmetric-substring filter.
- **PII negative assertion** serializes the whole response and asserts no phone/email/dob/aadhaar/address substrings. If anyone later extends the response payload with these fields, this test catches it.
- **HOD on Parent/Alumni** returns empty by design — documented inline.
