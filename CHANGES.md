# Changes

## Feature: Per-Row Selection Before Bulk Import Commit

### Problem
Previously, the bulk-import commit process was all-or-nothing: once a file was uploaded and parsed, all valid/eligible rows were automatically committed. There was no way for the operator to select or exclude individual eligible rows before committing the bulk import.

### Before
- Preview endpoints parsed the CSV and displayed eligible rows.
- Commit endpoints committed all eligible rows from the preview without checking any user-specified selections.
- Job history schema did not support tracking skipped rows and counts.

### Implemented Changes
- **Backend Schema & Service**: Added `skippedCount` and allowed `'skipped'` outcome in `ImportJob`. Service layer validates row selections, performs selective updates, marks unselected eligible rows as `'skipped'`, and manages accounting counts.
- **Backend API Validation**: Added validation schema to verify that the frontend payload conforms to validation rules (contains list of selected numbers).
- **Backend Controllers**: Forwarded `selectedRowNumbers` to the service layer and updated `jobSummary` to return skipped counts and rows.
- **Frontend Services**: Updated API client wrappers to accept selection arrays on commit and represent skipped rows.
- **Frontend UI Components**: Added checkboxes, Select All toggle (supporting indeterminate state), count badges ("X of Y eligible rows selected"), dynamic commit buttons, and skipped rows tables.
- **Tests**: Implemented Vitest test suites verifying logic correctness, boundary constraints, and UI integration.

### Files Modified
- [`backend/src/models/platform/ImportJob.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/models/platform/ImportJob.ts)
- [`backend/src/modules/platform/bulk-import-service.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/platform/bulk-import-service.ts)
- [`backend/src/modules/platform/validation.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/platform/validation.ts)
- [`backend/src/modules/people/validation.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/people/validation.ts)
- [`backend/src/modules/platform/routes.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/platform/routes.ts)
- [`backend/src/modules/people/routes.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/people/routes.ts)
- [`backend/src/modules/platform/bulk-import-controller.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/platform/bulk-import-controller.ts)
- [`backend/src/modules/people/student-import-controller.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/people/student-import-controller.ts)
- [`admin-portal/src/services/student-import.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/admin-portal/src/services/student-import.ts)
- [`admin-portal/src/services/bulk-imports.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/admin-portal/src/services/bulk-imports.ts)
- [`admin-portal/src/components/people/StudentImportDrawer.tsx`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/admin-portal/src/components/people/StudentImportDrawer.tsx)
- [`admin-portal/src/pages/platform/BulkImportsPage.tsx`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/admin-portal/src/pages/platform/BulkImportsPage.tsx)
- [NEW] [`backend/src/modules/platform/__tests__/bulk-import-row-selection.test.ts`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/backend/src/modules/platform/__tests__/bulk-import-row-selection.test.ts)
- [`admin-portal/src/components/people/__tests__/StudentImportDrawer.test.tsx`](file:///c:/Users/Raghu%20Ram/Desktop/juvion/admin-portal/src/components/people/__tests__/StudentImportDrawer.test.tsx)

### Tests Run
- Full Vitest backend test suites
- Full Vitest frontend test suites
- TypeScript compilation check (`typecheck`)

### Verified Manual Test
A manual validation was conducted with the following parameters and results:
* **Input**: 5 eligible student rows previewed.
* **Selection**: Checked Row 3, 4, 5. Left Row 1 and 2 unchecked (deselecting them).
* **UI Feedback**: Correctly showed `3 of 5 eligible rows selected`.
* **Action**: Committed the bulk import.
* **Commit Outcomes**:
  * 3 rows imported successfully.
  * 0 rows failed.
  * 2 rows skipped.
* **Database Verification**:
  * The three selected students (Rows 3, 4, 5) were created correctly.
  * The two skipped students (Rows 1 and 2) were NOT created in the Students collection.
  * Skipped rows remained fully preserved in the database `ImportJob` results history, with outcome `'skipped'` and notes `'skipped - not selected by operator'`.

### Impact
Enables granular operator control during bulk data imports, allowing exclusion of specific rows before saving transactions to the database. Fully backward-compatible: if legacy clients omit the selection array, all eligible rows are committed as before.

### Future Commit Message
`feat(bulk-import): add per-row selection before bulk import commit`
