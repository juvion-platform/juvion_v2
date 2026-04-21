# Completion: Task 6 — fee-component-template-service

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/fee-component-template-service.ts` — CRUD service + `buildComponentsFromTemplate` integration hook + re-exports `CANONICAL_FEE_COMPONENTS` and `FeeComponentTemplateCategory` so admin UI consumers don't need to reach into the script module
- **Created:** `backend/src/modules/finance/__tests__/fee-component-template-service.test.ts` — 24 tests (well past the 10+ minimum)

## Public API
```ts
listComponents(collegeId, opts?: { category?, applicableToYear? })
createComponent(collegeId, data, performedBy)    // isDefault auto-set to false
updateComponent(collegeId, componentId, data, performedBy)
deleteComponent(collegeId, componentId, performedBy)
buildComponentsFromTemplate(collegeId, yearOfStudy)  // integration hook for FeeStructureInstance creation
```

## Test Results
- Focused: 24/24 passing
- Full backend suite: 350/350 passing (326 baseline + 24 new)
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §AC fee component template — listing with filters, category + year
- ✓ Default vs custom protection — defaults can only change `displayLabel` + `displayOrder`; all other fields 403
- ✓ Custom immutability — `componentKey` cannot be changed post-creation (prevents dangling references)
- ✓ `componentKey` validation: `/^[a-z][a-z0-9_]*$/` with friendly 400
- ✓ Duplicate-key pre-check — friendly 409 before DB unique index
- ✓ Multi-tenancy — collegeId scoping on every query
- ✓ Audit log emitted on every create/update/delete, matching finance service conventions
- ✓ `buildComponentsFromTemplate` integration hook — returns plain objects with zero amounts

## Spec Gaps Discovered

1. **403 default-protection message is toast-unfriendly.** Current wording is accurate but long: *"Default components can only change displayLabel and displayOrder. componentKey/category/refundable/oneTime/applicableToYears are fixed by the canonical spec."* The service's error message is structured so the admin UI can split at the first period for a short toast (*"This is a default component — only its label and order can be changed."*) plus a "Learn more" link with the full technical wording. Flagged for T14 (admin UI) to implement that UX split.

2. **`componentKey` immutability advice might be misleading.** The 403 message suggests *"Delete the custom component and create a new one if you need a different key"*, but if the custom is already referenced by an in-progress FeeStructureInstance, deleting is not safe. The admin UI (T14) should add a reference-check warning before allowing the delete action. T10 (invoice integration) should also consider whether to tolerate or reject missing `componentKey` references.

3. **`applicableToYears: []` semantics = "all years" is ambiguous.** The service uses `$size: 0 OR contains match`, which matches the canonical seed's "empty = all years" convention. But if an admin sets `applicableToYears: []` on a custom intending "none", the behavior will surprise them. Options for future spec clarification:
   - (a) Require custom components to specify concrete years (reject `[]`)
   - (b) Add a sentinel `appliesToNoYears: boolean` flag
   - (c) Leave as-is and document "empty = all" prominently in the UI

   Non-blocking for T6; worth capturing in Open Questions.

## Violations
None.

## Notes
- `createComponent` auto-computes `displayOrder` as `max + 10` if omitted, leaving room for manual re-ordering.
- All errors use `AppError(statusCode, message)` — argument order correct per project convention.
- Integration hook `buildComponentsFromTemplate` intentionally returns plain objects rather than persisting them — the caller (future FeeStructureInstance creation flow, likely T10 or a separate task) owns the lifecycle of those components.
