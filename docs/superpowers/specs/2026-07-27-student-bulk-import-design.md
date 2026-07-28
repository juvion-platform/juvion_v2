# Student Bulk Import — Design

**Date:** 2026-07-27
**Status:** Approved, ready for implementation planning

## Problem

Operators can only create students one at a time through `/people/students/new`.
Indian college intake arrives as a spreadsheet of hundreds of students, so
first-week onboarding is currently manual data entry.

A generic schema-driven import system already exists at `/platform/bulk-imports`
(upload → preview → commit) with a registry covering five entity types including
`student`. Three gaps block it from serving this need:

1. **Not reachable from where the work happens.** The Students list page has no
   import or template affordance.
2. **The template does not mark mandatory columns.** It emits bare `fieldKey`
   headers, so an operator cannot tell what is required without reading the
   schema panel.
3. **The `student` schema covers 11 of the 24 operator-authored fields.** It cannot
   place a student in a programme, branch, batch or regulation, and cannot link
   a guardian — so an imported student still needs manual completion.

## Goals

- Import and template download on `/people/students`.
- Template covers every operator-authored field, with mandatory columns marked
  by a trailing `*`.
- Registrars — who own student data — can actually use it.
- Re-importing a corrected file is safe.

## Non-goals

- Importing system-managed fields (`feeStatus`, `hasFinancialHold`, `feePins`,
  `isSealed`, `graduationDate`, `exitDate`, `alumniId`). These are owned by the
  payment and lifecycle pipelines. Letting a spreadsheet write them recreates
  the corrupted-derived-field class of bug fixed in the Jul-2026 audit pass.
- Changing `/platform/bulk-imports` behaviour for the other four entity types.
- Excel (`.xlsx`) input. CSV only, matching the existing surface.

## Architecture

One engine, two doors.

`bulk-import-service` and `bulk-import-registry` remain the single source of
truth for parsing, validation, preview and commit. M02 gains a thin façade that
resolves the `student` schema from the registry and delegates:

```
/api/people/students/import/template   GET    authorize('people','read')
/api/people/students/import/preview    POST   authorize('people','create')   multipart
/api/people/students/import/commit     POST   authorize('people','create')
```

`/platform/bulk-imports` is untouched and continues to serve all five entity
types.

### Why a façade rather than a deep link

Only `admin` and `principal` hold `platform:create` (see
`shared/rbac/defaults.ts`). A Registrar (`ST-REG`) has full `people` access but
would receive a 403 from `/platform/bulk-imports`. Linking the Students page to
the platform importer would surface a button that fails for the persona that
owns student records.

### Why not a standalone importer

A second parser, preview UI and commit path would need to stay in sync with the
first. The registry's own header comment states that adding an entity type is
"a SINGLE registry entry … zero new infrastructure code required." Reuse keeps
one place to fix bugs, and improvements reach both surfaces.

## Template schema

The `student` registry entry grows from 11 to 24 fields.

> **Amendment (final review, 2026-07-28):** `onboardingStatus` was removed
> from the importable set — it was the 25th column. Writing it directly
> bypasses `assertStudentOnboardingRules` (`people/service.ts:127-150`) and
> the `onboardingCompletedAt` stamp, so a spreadsheet could mark a student's
> onboarding complete with no guardian and an empty checklist. Onboarding
> completion is a lifecycle outcome the platform owns, the same reasoning
> that already excludes `feeStatus`, `isSealed` and `graduationDate`.
> Imported students take the model default (`not_started`).

### Identity → Person

| Column | Required | Notes |
|---|---|---|
| `name*` | yes | 1–200 chars |
| `phone*` | yes | 10 digits |
| `email` | no | |
| `gender` | no | `male` \| `female` \| `other` |
| `dob` | no | `YYYY-MM-DD` |
| `aadhaar` | no | 12 digits |
| `addressLine1` | no | |
| `addressLine2` | no | |
| `city` | no | |
| `state` | no | |
| `pincode` | no | 6 digits |

### Placement → Student

| Column | Required | Notes |
|---|---|---|
| `programmeCode*` | yes | resolved to `programmeId` |
| `branchCode` | no | resolved to `branchId` |
| `batchCode` | no | resolved to `batchId` |
| `regulationCode` | no | resolved to `regulationId` |
| `admissionYear*` | yes | 2000–2100 |
| `studyYearAtAdmission` | no | 1–8, defaults to 1 (model default) |
| `rollNumber` | no | unique per college when present |
| `quota` | no | validated against active FeeQuota codes — see below |
| `category` | no | validated against active FeeCategory codes — see below |
| `status` | no | defaults to `active` — see below |

Two of these need stating precisely, because they differ from what the model or
the current importer does:

- **`status` defaults to `active`, not the model's `prospective`.** The existing
  `commitOne` already does this, with the comment "matches manual create path."
  Retained for consistency; an imported student is normally already admitted.
- **`quota` and `category` are validated against the active FeeQuota /
  FeeCategory catalogs.** The model deliberately has no enum (codes are
  admin-managed CRUD) and the current importer accepts any string. Validating
  here is a **behaviour change**, chosen for consistency with reference
  resolution: an unrecognised quota code is a typo that would otherwise produce
  a student who silently fails to fee-pin. Unknown value fails the row.

### Guardians

| Column | Required | Notes |
|---|---|---|
| `primaryParentPhone` | no | matched, else created |
| `primaryParentName` | no | used only when creating |
| `feeResponsibleParentPhone` | no | matched, else created |

### Deliberate deviation from the model

`programmeId` is optional on `Student`, but `programmeCode` is **required** in
the template. A student with no programme cannot be fee-pinned or placed, so
importing one creates downstream work rather than saving it. The import is
intentionally stricter than the schema.

## Header contract

The template emits `name*` for mandatory columns. The parser normalizes each
incoming header — strip surrounding whitespace, then a single trailing `*` —
before matching `fieldKey`.

This is load-bearing in both directions. `bulk-import-service` currently maps
headers by exact match (`rawObj[field.fieldKey]`). Without normalization, a file
downloaded from our own template would report every required field as empty and
fail every row.

Bare `fieldKey` headers remain accepted, so files exported before this change
still import. Normalization lives in the shared service, so
`/platform/bulk-imports` gains the same tolerance.

## Reference resolution

Codes resolve to ObjectIds scoped to the calling college.

- **Programme / branch / batch / regulation** — an unmatched code fails the row
  with a specific message (`unknown programme code "BTCS"`). Never auto-created:
  an unknown code is a typo, not intake data.
- **Quota / category** — validated against the active FeeQuota and FeeCategory
  catalogs, same rule: unmatched fails the row.
- **Parents** — matched by phone within the college. When absent, a minimal
  `Parent` + `Person` is created, using `primaryParentName` when supplied. Intake
  genuinely arrives parent-first, and `feeResponsibleParentId` gates onboarding
  completion (`assertStudentOnboardingRules`), so requiring a separate parent
  import first would make the feature unusable for its main case.

Preview reports how many parents *would* be created without creating any.

## Upsert

Natural key, first match wins, scoped to the college:

1. `rollNumber`
2. `aadhaar`
3. `phone` + `admissionYear`

Every preview row is labelled:

- **Create** — no match.
- **Update** — match found; the row's supplied fields are applied.
- **Blocked** — match found but the record is `isSealed`, `exited` or `alumni`.
  Never written.

Create-only semantics were rejected because the common workflow is "fix three
rows, re-upload the file": today that duplicates students without a roll number
and hard-fails those with one, against the unique sparse index on
`(collegeId, rollNumber)`.

The Blocked state exists so a spreadsheet cannot silently rewrite a sealed or
graduated record.

## Error handling

Three tiers:

1. **File** — not CSV, empty, no data rows below the header, >10 MB, or >10,000
   rows (`IMPORT_FILE_MAX_BYTES` / `IMPORT_MAX_ROWS`). Rejects
   the upload with a single message. Handled by existing multer config.
2. **Row** — per-field validation errors collected; the row is marked failed and
   its siblings proceed. Existing behaviour.
3. **Commit** — a row that throws records its error and the batch continues. One
   bad row never aborts a 300-row import.

### Partial-write integrity

A single row can create up to three documents: `Person`, optionally
`Parent` + its `Person`, then `Student`. If the `Student` write fails — duplicate
`rollNumber` being the realistic case — the `Person` is already committed and
becomes an orphan. Across a large file this is meaningful pollution, and it is
the only path where this feature can corrupt data rather than merely reject
input.

`programme-transfer-service` establishes the house pattern: the in-memory test
harness is not a replica set, so `session.withTransaction` is unavailable, and it
uses a documented compensating rollback instead.

This feature follows that precedent — track the ids created while processing a
row, and on failure delete them in reverse creation order. No new infrastructure,
consistent with existing code.

## UI

`/people/students` header gains two controls beside the existing search and
status filter:

- **Download template** — builds the CSV client-side from the schema returned by
  the template endpoint. Immediate, no navigation.
- **Import** — opens a drawer with the existing three-step flow: choose file →
  preview → commit.

The preview table shows per-row status (Create / Update / Blocked / Failed),
the resolved programme and branch, and per-field errors. A summary line states
counts including parents-to-create. Commit is behind the shared
`confirmAction` dialog, stating the counts being written.

Both controls are hidden unless the user holds `people:create`, matching the
route gating.

## Testing

**Registry unit tests** — one per validator, including:
- `*`-suffixed header round-trip (template output parses back correctly)
- bare-`fieldKey` headers still accepted (backward compatibility)
- unknown reference codes rejected with a specific message

**Service tests**
- upsert key precedence (`rollNumber` → `aadhaar` → `phone`+`admissionYear`)
- sealed / exited / alumni match resolves to Blocked and is never written
- compensating rollback leaves no orphan `Person` after a forced `Student` failure
- preview creates nothing, including parents

**E2E (`__e2e__`)** — a registrar (`ST-REG`) can reach preview and commit; an
unauthenticated caller gets 401. This is the reason the façade exists, so it is
covered directly.

**Playwright** — drive the drawer on `/people/students`: download template,
upload a fixture CSV, assert the preview counts, commit, assert the new student
appears in the list. Uses the `confirmDialog` helper.

## Risks

| Risk | Mitigation |
|---|---|
| `*` headers break the existing parser | Normalization in the shared service, tested in both directions |
| Orphan `Person` on partial row failure | Compensating rollback, per the `programme-transfer-service` precedent |
| Spreadsheet overwrites a sealed record | Blocked state; sealed/exited/alumni never written |
| Unintended parent creation | Preview reports the count before any write; creation only at commit |
| Large files time out | 10 MB / 10,000-row caps (existing); commit already processes row-by-row and records per-row outcomes |
