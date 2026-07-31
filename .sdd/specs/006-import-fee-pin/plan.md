# Implementation Plan — 006-import-fee-pin

**Problem:** Student bulk import creates students but never fee-pins them at import time, even when a matching active `FeeStructureInstance` exists — the manual create path (`people/service.ts:394`) does. Two doors onto the same act, different semantics.

Note the defect is **not** "imported students are never priced": they get pinned **lazily and unreviewed** at invoice generation as `system:invoice-lazy` (`fee-lifecycle-service.ts:459`). So the real problem is that pinning happens **silently, late, and unaudited** instead of at import with a reviewable, reported outcome. This feature moves the pin to import time, reports it honestly per the §2 invariant, and gives Finance a first-class place to see and clear the tail — it does not *introduce* pinning where there was none, it makes an existing implicit pin **early and reviewable**.

**Owner modules:** M02 People (import commit), M04 Finance (pin service, coverage surface), M12 Platform (import engine contract)

**Scope:** Auto-pin on import where a match exists; soft-fail and report where it doesn't; give Finance a first-class place to see and clear the unpinned tail.

---

## 1. Audit findings that constrain the design

Every design decision below traces to one of these. Verified against `main@74fa6fe` and a live dev DB (36 active FSIs, 14 imported students, all with `feePins: []`).

| # | Finding | File:line | Consequence for this plan |
|---|---|---|---|
| F1 | `commitStudentRow` never calls the pin service — it doesn't import it | `people/student-import-service.ts:363`, imports at `:17-25` | The whole defect. One call site to add. |
| F2 | `commitPin` is **not idempotent** — it archives any active pin for the year (`archiveReason:'replaced'`) then pushes a new one, *even when the FSI is identical* | `finance/fee-pin-service.ts:687-712` | Import must guard before calling `pinYear`, or every re-import churns pins and pollutes the audit trail. **§3.3** |
| F3 | `deriveAcademicYearId` returns `undefined` unless the caller passes one explicitly (`Batch` has no `academicYearId`) — and `resolveMatchingFeeStructureInstance` returns `null` immediately when AY is absent | `fee-pin-service.ts:144-157`, `:211-214` | Import **must** resolve and pass `academicYearId`. Omitting it means every row soft-fails. **§3.2** |
| F4 | `resolveStudentYearOfStudy` throws `400` when the student has no `batchId` | `finance/resolve-year-of-study.ts:103-108` | Cannot be used at import — `batchCode` is optional and no batches exist for MTECH/MBA in seed. Mirror `createStudent`: `studyYearAtAdmission ?? 1`. **§3.2** |
| F5 | `pinYear` costs ~5 round trips/student (`findById`, matcher `find`, `snapshotFeeComponents`, `save`, reconcile `findById` + possible `save`) | `fee-pin-service.ts:383-745` | At 10,000 rows (`IMPORT_MAX_ROWS`) that is ~50k queries in a synchronous HTTP handler. **§6 perf** |
| F6 | `enqueueCommitmentSheet` defaults to **true** → one BullMQ job per pin | `fee-pin-service.ts:81-82` | Must be `false` at import. Precedent: the update path already disables it "to avoid a Redis failure killing the student save" (`people/service.ts:541-543`). **§3.4** |
| F7 | Preview already has an aggregate side-effect channel (`sideEffects` → `sideEffectTotals`), used today for guardians | `platform/import-schemas/types.ts` (validateRow), `bulk-import-service.ts:465` | Reuse verbatim for pin counters. No engine change needed for counting. **§4.1** |
| F8 | `commitImportJob` catches any `commitOne` throw and flips the row to `outcome:'error'`, incrementing `failureCount` and degrading job status to `partial`/`failed` | `bulk-import-service.ts:595-608` | A pin failure must **never** propagate out of `commitOne`, or "no fee structure published yet" turns a clean import red. **§3.5** |
| F9 | `commitStudentRow` uses compensating rollback (no transactions — test harness isn't a replica set) | `student-import-service.ts:1-15, 391, 501` | The pin write needs its own `Compensation` kind, or a later failure in the same row leaves an orphan pin. **§3.6** |
| F10 | Import **refuses** any fee-axis change on an update row (programme/branch/quota/category), returning `blocked` at preview and 409 at commit | `people/student-import-match.ts:189-235` | Update rows have unchanged axes by construction → re-pinning them is always a no-op churn. Only pin update rows that have **no** active pin. **§3.3** |
| F11 | `GET /api/finance/pin-audit/coverage` already exists, returns `studentsMissingPin[]`, and has **zero frontend consumers** | `finance/fee-pin-audit-service.ts:77`, `finance/routes.ts:696` | The "where does the admin see this" answer is 80% built. Enrich, don't invent. **§5** |
| F12 | `getCoverage` classifies a student with unresolvable year-of-study as missing-pin with `currentYearOfStudy: 0` | `fee-pin-audit-service.ts:88-97` | Batch-less imported students (MTECH/MBA) show as year 0. Needs a distinct reason, not a silent 0. **§5.2** |
| F13 | `backfill-fee-pins.ts` has dry-run/commit/rollback + CSV audit + `alreadyPinned` accounting — but derives year via `resolveStudentYearOfStudy`, so batch-less students land in `unresolvable` | `scripts/backfill-fee-pins.ts:393-405` | Today's bulk remedy silently skips exactly the students import creates. **§5.3** |
| F14 | Rollback matches `pin.pinnedBy === pinnedBy` — **exact equality**, not prefix | `backfill-fee-pins.ts:532` | `pinnedBy` must be a stable literal (`system:import`), with operator + jobId in `remarks`. Embedding the jobId in `pinnedBy` breaks bulk undo. **§3.4** |
| F15 | FeePinsPanel gates Re-pin on `isPrincipal` while the route gates on `authorize('finance','approve')`; `hasPermission(_,'approve')` is always false in the FE | `FeePinsPanel.tsx:101,300`; `shared/rbac/resolve-permissions.ts` | The manual escape hatch is unreachable for a college admin. Must be fixed or the tail has no UI remedy. **§5.4** |
| F16 | The edit form's preview strip promises *"saving will switch to this"*, but the update path only pins when `feeAxisChanged` | `StudentFormPage.tsx:847`; `people/service.ts:509-527` | Actively misleading for an unpinned student. **§5.5** |

---

## 2. Behaviour contract

Per row, at commit:

| Row action | Student has active pin for `yearOfStudy`? | Matching FSI? | Result |
|---|---|---|---|
| `create` | n/a (new) | yes | **Pinned.** `reason:'initial'` |
| `create` | n/a | no | Student created, **not pinned**. Row still `success`. Note recorded. |
| `update` | yes | — | **Skipped.** Axes cannot have changed (F10); re-pinning would churn. Counted `alreadyPinned`. |
| `update` | no | yes | **Pinned.** This makes re-import the recovery path once Finance publishes the FSI. |
| `update` | no | no | Not pinned. Note recorded. |
| `blocked` | — | — | Never reaches commit. Unchanged. |
| any | — | pin throws non-404 | Student kept, not pinned, counted separately as `pinError`, logged. Row stays `success`. |

**Invariant: a pin outcome never changes a row's outcome.** `successCount`, `failureCount`, `blockedCount` and the job status ladder are untouched by pinning. Pin results are reported on their own axis.

---

## 3. Backend — import side

### 3.1 New module: `people/student-import-pin.ts`

Keep it out of `student-import-service.ts`, which is already 500+ lines and owns a different concern (Person/Parent/Student writes + compensation).

```ts
export type PinOutcome =
  | { kind: 'pinned'; pinId: string; fsiId: string; totalAmount: number }
  | { kind: 'already-pinned'; fsiId: string }
  | { kind: 'no-match'; message: string }
  | { kind: 'skipped'; reason: 'no-academic-year' | 'no-programme' }
  | { kind: 'error'; message: string };

export async function pinImportedStudent(
  studentId: string,
  typedRow: Record<string, unknown>,
  ctx: { collegeId: string; performedBy: string; academicYearId?: string; jobId: string },
): Promise<PinOutcome>;
```

Never throws. Every failure mode is a return value — that is what enforces the §2 invariant against F8.

### 3.2 Year and academic year (F3, F4)

- `yearOfStudy = Number(typedRow.studyYearAtAdmission) || 1` — identical to `createStudent` (`people/service.ts:391`). **Do not** call `resolveStudentYearOfStudy`; it hard-fails on batch-less students (F4), which is the majority of an MTECH/MBA import.
- `academicYearId`: resolved **once per job**, not per row. Precedence:
  1. explicit `academicYearId` on the preview request (new optional param, §4.2);
  2. `AcademicYear.findOne({ collegeId, isCurrent: true })`.

  Resolving per-row would let a long-running import straddle an AY rollover and split a cohort across two years. Store the resolved id on the job (§4.3) so preview and commit provably agree.
- If neither yields an AY → **every row** returns `{kind:'skipped', reason:'no-academic-year'}`. Detect this once at preview and show a file-level warning rather than 500 identical row notes.

### 3.3 Idempotency guard (F2, F10)

Before calling `pinYear`:

```ts
const student = await Student.findById(studentId).select('feePins programmeId').lean();
const active = (student?.feePins ?? []).find(p => p.yearOfStudy === yearOfStudy && !p.archivedAt);
if (active) return { kind: 'already-pinned', fsiId: String(active.feeStructureInstanceId) };
```

Deliberately **not** "re-pin if the FSI differs". A differing FSI means either an axis moved (impossible on import, F10) or Finance superseded the structure — the second is a Finance decision that belongs on the Re-pin screen with an audit reason, not a side effect of a spreadsheet upload.

An **archived** pin does not count as active, so a student whose pin was archived gets a fresh one. Correct: that is the "Finance retracted the old structure, re-import to rebind" path.

### 3.4 The pin call (F6, F14)

```ts
const pin = await feePinService.pinYear(studentId, yearOfStudy, {
  pinnedBy: 'system:import',                    // literal — F14, mirrors 'system:backfill'
  reason: 'initial',
  academicYearId,                               // mandatory in practice — F3
  enqueueCommitmentSheet: false,                // F6
  remarks: `import job=${jobId} by=${performedBy}`,
});
```

`catch (e)`: `e.name === 'FeeStructureNotFoundError'` → `{kind:'no-match', message: e.message}` (the error already formats the full axis tuple via `formatMissingStructureMessage`). Anything else → `{kind:'error'}` + `console.warn`.

Commitment sheets are deferred to a separate bulk action (§5.6). One Redis blip must not be able to affect a 500-student intake.

### 3.5 Wiring into `commitStudentRow` (F8, F9)

In `student-import-service.ts`, on the **create** branch after `syncStudentParentLinks`, and on the **update** branch after the student write:

```ts
const pinOutcome = await pinImportedStudent(String(student._id), typedRow, {
  collegeId, performedBy, academicYearId: ctx.academicYearId, jobId: ctx.jobId,
});
if (pinOutcome.kind === 'pinned') {
  compensations.push({ kind: 'pin', studentId: String(student._id), pinId: pinOutcome.pinId });
}
return { id: String(student._id), pinOutcome };
```

`commitOne`'s return type widens from `{id}` to `{id, pinOutcome?}` — an optional field, so the other four import schemas are unaffected.

### 3.6 Rollback compensation (F9)

New `Compensation` kind:

```ts
| { kind: 'pin'; studentId: string; pinId: string }
```

Undone via `feePinService.archivePin(studentId, pinId, 'import-rollback')` — already idempotent (`fee-pin-service.ts:~760`, early-returns when `archivedAt` is set). Archive rather than `$pull`: the pin is an auditable financial event and the audit log already references it.

Registered **after** the pin succeeds (unlike `parentLinks`, which registers before its write) because `archivePin` needs a real `pinId`.

---

## 4. Backend — preview and reporting

### 4.1 Preview resolution, in `studentImportSchema.validateRow` (F7)

The hook already runs `resolveStudentRefs`. Add, after the fee-axis conflict check and only for non-blocked rows:

```ts
const pinPreview = await previewPinForRow(ctx.collegeId, typedRow, refs.value, academicYearId);
// -> { willPin: true, fsiId, fsiName, totalAmount } | { willPin: false, reason }
```

Implemented with `resolveMatchingFeeStructureInstance` against a `studentLike` partial — **exactly** the shape `fee-pin-service.ts:342-356` already builds for the edit-form preview strip. Extract that block into an exported `previewMatchForAxes(...)` and call it from both, so the drawer and the form can never disagree about what a match is.

Emitted as:
- `sideEffects: { pinWillPin: 1 }` or `{ pinNoMatch: 1 }` → free aggregation into `sideEffectTotals` (F7)
- `sideEffects: { pinAmount: totalAmount }` → gives the money total with no extra plumbing
- `notes: ['will pin to Fee Structure X — ₹3,15,000']` or `['no matching fee structure — will import unpinned']`

For an **update** row that already has an active pin, emit `{ pinAlreadyPinned: 1 }` and no note. Silence is correct; nothing is changing.

**Cost:** one extra `FeeStructureInstance.find` per row. Mitigated in §6.

### 4.2 `academicYearId` as a file-level parameter (F3)

`POST /api/people/students/import/preview` gains an optional `academicYearId` form field.
- Absent → server resolves `isCurrent: true` and echoes it back in the preview payload.
- Present → validated as a real `AcademicYear` for this college; 400 otherwise.

This is the "importing next year's intake in advance" case. Without it, a June import of the AY2026-27 cohort silently pins everyone to AY2025-26 or matches nothing.

### 4.3 Persist the decision on the job

`ImportJob` gains:

```ts
/** AY the pin resolution was computed against. Frozen at preview so commit cannot drift. */
pinAcademicYearId?: Types.ObjectId;
```

`commitImportJob` reads it off the job and threads it into `ctx`. Preview and commit then provably use the same AY even if `isCurrent` flips between the two calls.

`ImportCommitContext` widens: `{ collegeId, performedBy, academicYearId?, jobId }`. `jobId` is genuinely useful beyond this feature (provenance in `remarks`).

### 4.4 Commit response

`student-import-controller.ts` `commitHandler` adds:

```ts
pinSummary: {
  pinned: number,
  alreadyPinned: number,
  noMatch: number,
  errors: number,
  totalPinnedAmount: number,
  unpinnedRows: Array<{ row: number; rollNumber?: string; name: string; reason: string }>, // cap 100
}
```

Same `FAILED_ROW_LIMIT` convention and the same justification: a Registrar holds no `platform:read` and cannot open the job afterwards (open follow-up #6 in the import follow-ups doc). If the unpinned list doesn't travel with the response, that persona can never see it.

Per-row pin outcomes are also written to `ImportJob.results[i].notes` so the platform door and any future job-read endpoint have them.

---

## 5. Where the admin sees and clears the unpinned tail

Four surfaces, in priority order.

### 5.1 Import drawer — immediate (new)

Preview gains a summary strip above the row table:

```
420 will pin · ₹6,42,80,000    18 no matching fee structure    12 already pinned
```

and a **Fee structure** column per row (`₹3,15,000` / `— no match`).

The confirm dialog gains one line: *"18 students will be imported without a fee structure. You can pin them later from Finance → Fee Management → Pin Coverage."*

Post-commit, when `pinSummary.noMatch > 0`, the drawer stays open (it already does this for failures) and lists the unpinned rows with a deep link to §5.2. Reuses the existing amber result panel — no new component.

### 5.2 Finance → Fee Management → **Pin Coverage** (new page, existing endpoint) — F11, F12

New tab in `FeeManagementPage.tsx:27` `TABS` at `/finance/fee-management/pin-coverage`, backed by the already-built and currently-unconsumed `GET /api/finance/pin-audit/coverage`.

Endpoint enrichment required:
- `studentsMissingPin[]` currently carries only `{studentId, rollNumber, programmeId, currentYearOfStudy}`. Add `name`, `programmeCode`, `branchCode`, `quota`, `category`, and a **`reason`** discriminant:
  - `no-matching-structure` — matcher returned null. Actionable by Finance: publish an FSI.
  - `year-unresolvable` — F12. Today this is silently `currentYearOfStudy: 0`. Actionable by the Registrar: assign a batch.
  - `never-pinned` — has a resolvable year and a candidate FSI exists; just was never pinned. One click to fix.
- Paginate. The hardcoded 500-entry cap is fine for a dashboard tile and wrong for a worklist.
- Group-by-axis rollup, because that is how Finance acts on it: *"BTECH / CSE / convener / Year 1 — 46 students, no structure published"*. Forty-six rows is noise; one row is a task.

Page: coverage % header, reason filter, the grouped table, per-row **Pin now**, and a **Pin all matching** bulk action.

### 5.3 Bulk pin endpoint (new)

```
POST /api/finance/students/bulk-pin
authorize('finance','approve')   // same gate as re-pin — this commits money
body: { studentIds?: string[], filter?: {programmeId, branchId, quota, category, yearOfStudy}, academicYearId?, dryRun?: boolean }
```

- `dryRun: true` returns the would-pin list and totals without writing. This is the Finance sign-off step, mirroring the backfill script's documented flow (`backfill-fee-pins.ts:19-27`).
- Delegates to the same `pinImportedStudent` guard logic (§3.3) so import and bulk-pin cannot diverge on what "already pinned" means.
- `pinnedBy: 'system:bulk-pin'`, `enqueueCommitmentSheet: false`.
- Capped per call (suggest 1,000); above that, the CLI backfill remains the tool.

**And fix F13:** `backfill-fee-pins.ts` must fall back to `studyYearAtAdmission ?? 1` when `resolveStudentYearOfStudy` throws for a missing batch, instead of classifying the student `unresolvable`. Otherwise the documented bulk remedy skips precisely the students import produces. Keep `unresolvable` for genuine failures (no AY at all).

### 5.4 Student detail — Re-pin (fix, F15)

`FeePinsPanel.tsx:300`: `disabled={!isPrincipal}` → `disabled={!canPauseEscalation}` (`hasPermission('finance','update')`), and drop the `isPrincipal &&` guard on the empty-state hint at `:333`. Already scoped and approved in principle as follow-up #1 of the fee-module notes; this feature makes it load-bearing, because it is the per-student escape hatch the whole design leans on.

### 5.5 Edit form honesty (fix, F16)

`StudentFormPage.tsx:847`: when `isEdit && !activePinFsi`, the strip must not say *"saving will switch to this"*. Either:
- **(a)** change the copy to *"No fee structure pinned. Use Re-pin on the student's Fee tab to apply this."*, or
- **(b)** make it true — pin on update when there is no active pin, mirroring §2's update rule.

Prefer **(b)**; it makes the form's promise correct and matches the import contract. **(a)** is the fallback if we want zero behaviour change on the manual path in this slice.

### 5.6 Commitment sheets

Because §3.4 sets `enqueueCommitmentSheet: false`, sheets are not generated during import. Add a **Generate commitment sheets** bulk action on the Pin Coverage page (or extend the existing `POST /students/:id/commitment-sheet/regenerate` to a batch form). Must be explicit — 500 synchronous BullMQ enqueues inside an HTTP request is the failure mode F6 exists to avoid.

---

## 6. Performance and limits (F5)

At `IMPORT_MAX_ROWS = 10,000`:

| Stage | Extra cost/row | Mitigation |
|---|---|---|
| Preview `previewMatchForAxes` | 1 × `FeeStructureInstance.find` | **Cache candidate FSIs per (programmeId, academicYearId) for the job's lifetime.** A college has tens of FSIs, not thousands — load once, score in memory. Turns 10,000 queries into ~3. |
| Commit `pinYear` | ~5 round trips (F5) | Cannot be avoided without restructuring `commitPin`. Accept for v1; measure. |
| Commit idempotency guard | 1 lean `findById` | Fold into the guard's own projection; already minimal. |

Recommend a **soft cap of 2,000 rows for auto-pin** in v1: above it, import the students and route the pinning to §5.3's bulk endpoint, with an explicit note in the preview. Rationale: the commit handler is a synchronous HTTP request and 10,000 × 5 round trips will hit gateway timeouts long before it hits a correctness bug. `log()` the cap so silent truncation never reads as full coverage.

---

## 7. Edge cases

| # | Case | Expected |
|---|---|---|
| E1 | No matching FSI | Student imported, unpinned, counted in `noMatch`, listed in drawer + Pin Coverage |
| E2 | No `isCurrent` AY and none supplied | File-level warning at preview; all rows import unpinned with `reason:'no-academic-year'`. **Not** an error — students are still valid. |
| E3 | Student has no programme | Already blocked at preview (`programmeCode` required). No change. |
| E4 | Batch-less student (MTECH/MBA — no batches seeded) | **Pins fine** (we don't use `resolveStudentYearOfStudy`, F4). Appears as `year-unresolvable` in coverage until a batch exists — hence the distinct reason in §5.2. |
| E5 | `studyYearAtAdmission` > programme `durationYears` | Year-specific FSIs won't match; wildcard-year FSIs will. Matcher behaviour, unchanged. Surfaces as `noMatch` if nothing matches. |
| E6 | Re-import the identical file | All rows `update`, all `alreadyPinned`, **zero** pin writes, zero new audit rows. Guard §3.3. Explicit test. |
| E7 | Re-import after Finance publishes the missing FSI | Rows are `update`, student has no active pin → **pinned**. This is the designed recovery path. Explicit test. |
| E8 | Two rows claim the same student | Already caught by `naturalKeys` intra-file duplicate detection. Second row fails validation, never commits, never pins. |
| E9 | Fee-axis conflict on an update row | Blocked at preview (F10). Never pinned. |
| E10 | Sealed / exited / alumni / graduated | Blocked at preview. Never pinned. |
| E11 | Pin succeeds, then a later write in the same row fails | Compensation §3.6 archives the pin. Test by forcing `syncStudentParentLinks` to throw. |
| E12 | Concurrent import + manual pin for the same student/year | `commitPin`'s reconcile pass (`fee-pin-service.ts:719-744`) resolves to last-writer-wins. Pre-existing behaviour; document, don't duplicate. |
| E13 | FSI superseded between preview and commit | Preview says "will pin ₹X", commit's matcher no longer sees it → `noMatch`. Honest and reported. The pin snapshot (`snapshotFeeComponents`) freezes amounts, so a pin taken a moment earlier stays valid. |
| E14 | Redis / BullMQ down | No exposure — `enqueueCommitmentSheet: false` (§3.4). |
| E15 | Student has an **archived** pin for that year | Treated as unpinned → fresh pin. Intended (§3.3). |
| E16 | Explicit `academicYearId` ≠ current AY | Allowed and honoured. Echoed in the preview and the confirm dialog so it's never accidental. |
| E17 | Quota/category not in the `FeeQuota`/`FeeCategory` catalog | Already a row error at preview (`validateCatalogCodes`). Never reaches pinning. Worth noting: the dev seed populates neither catalog. |
| E18 | 10,000-row file | Soft cap (§6): import all, auto-pin the first N, route the rest to bulk-pin, say so in the preview. |
| E19 | Pin throws something other than `FeeStructureNotFoundError` | Student kept, `pinError` counter, `console.warn`, row still `success`. Never degrades job status (§2). |
| E20 | `blockedCount`/`failureCount`/job status | Provably unchanged by any pin outcome. Assert in a test that a file where every row fails to pin still reports `status: 'completed'`. |
| E21 | `studyYearAtAdmission` omitted (it is **optional**, `import-schemas/student.ts:60`) | `Number(undefined) \|\| 1 = 1` → **silent Year-1 pin**. A mid-lifecycle intake (e.g. existing 3rd-years) with the column blank pins *everyone* to Year 1 → wrong FSI or `noMatch`. The per-row preview note MUST show the **resolved pin year** ("will pin **Year 1** → ₹X"), and preview should warn if the column is blank across the file. Reject `0` and non-integers (today `Number('0') \|\| 1` silently becomes 1; `Number('2.5')` → 2.5 matches no FSI). |
| E22 | Pinned ≠ payable (cross-flow) | `feeResponsibleParentPhone` is **optional** (`student.ts:69`). A pinned student without it is blocked at payment by `assertStudentFeeGuardianReady`. Surface "pinned, no fee-responsible guardian" as a distinct coverage reason (§5.2) / preview note — otherwise it looks fine until Seam B (payment). |
| E23 | Multiple / zero `isCurrent` AcademicYear | `findOne({collegeId,isCurrent:true})` returns an **arbitrary** AY if two are flagged (data bug) → cohort pins to a non-deterministic year. If `countDocuments({isCurrent:true}) > 1` → file-level warning + require explicit `academicYearId` (§4.2). Zero = E2. |
| E24 | Commit times out / dies mid-batch | Re-submitting the commit MUST be idempotent: existing students → `update` → `already-pinned` guard (§3.3) → no double-create, no double-pin. Explicit test. Ties to E18 / the §6 soft cap. |
| E25 | §6 candidate cache is **preview-only** | **Invariant:** the per-job FSI candidate cache MUST NOT be used to *write* a pin — commit always calls the live `pinYear`/matcher. Prevents a supersede-between-preview-and-commit from persisting a stale pin. State it so nobody "optimizes" commit to reuse the cache. |
| E26 | Re-import after Finance edits an FSI's component **amounts** (same FSI, same axes, not superseded) | The already-pinned student's frozen `snapshotTotalAmount` stays old; re-import **skips** them (`already-pinned`, §3.3). Correct-by-design — snapshots freeze on purpose — but **document it** so it isn't filed as a bug. The only refresh path is an explicit Re-pin. |

---

## 8. Task breakdown (TDD-ordered, each commit-shaped)

| # | Task | Tests first |
|---|---|---|
| T1 | Extract `previewMatchForAxes` from `fee-pin-service.ts:342-356`; both the edit-form preview and the new import preview call it | Existing edit-form preview tests still green; new unit test on the extracted fn |
| T2 | `people/student-import-pin.ts` — `pinImportedStudent` + idempotency guard. Never throws | Unit: pinned / already-pinned / no-match / no-AY / non-404 error. E6, E7, E15 |
| T3 | `ImportCommitContext` gains `academicYearId?` + `jobId`; `commitOne` returns `{id, pinOutcome?}`. Other four schemas untouched | Typecheck + existing platform import tests green |
| T4 | `ImportJob.pinAcademicYearId`; preview resolves AY once and freezes it; commit reads it back | Integration: flip `isCurrent` between preview and commit, assert the frozen AY wins |
| T5 | Wire into `commitStudentRow` + `pin` compensation kind | Integration: E11 (pin rolled back when a later write throws) |
| T6 | `validateRow` pin preview + `sideEffects` counters + per-row notes; job-scoped FSI candidate cache (§6) | Integration: counts and totals correct across >50 rows (past `PREVIEW_SUCCESS_LIMIT`) |
| T7 | `academicYearId` param on the preview route; validation; echo in payload | API: valid / invalid / absent |
| T8 | `pinSummary` on the commit response, incl. `unpinnedRows` | API contract test; **E20** (all-unpinned file still reports `completed`) |
| T9 | Drawer: summary strip, per-row Fee structure column, confirm-dialog line, post-commit unpinned panel | Component tests using accessible queries (per E2E discipline note in CLAUDE.md) |
| T10 | Enrich `getCoverage`: `reason` discriminant, names/axes, pagination, axis rollup | Unit: each reason branch, incl. **E4** batch-less → `year-unresolvable` |
| T11 | `POST /api/finance/students/bulk-pin` with `dryRun`, sharing T2's guard | API: dry-run writes nothing; gate is `finance:approve`; cap enforced |
| T12 | Pin Coverage page + tab | Render tests |
| T13 | Fix F13 — backfill falls back to `studyYearAtAdmission` on missing batch | Script test: batch-less student is pinned, not `unresolvable` |
| T14 | Fix F15 (Re-pin gate) and F16 (edit-form copy or behaviour) | Component test asserting the old gate/copy is gone |
| T15 | E2E: import 3 students (1 match, 1 no-match, 1 already-pinned) → verify drawer counts → verify Pin Coverage lists the one → bulk-pin it → verify pinned | Playwright, zero retries, no `waitForTimeout` |

**PR boundaries (HARD — do not bundle into one mega-PR):**
- **PR 1 — core fix (T1–T8):** import pins and reports honestly. This alone closes the upload→pin half of the cycle and is the demo-critical, low-risk change. Ship and get reviewed **before** starting anything below.
- **PR 2 — visibility + tail-clearing (T9, T10–T12, T11):** drawer surfacing, Pin Coverage page, bulk-pin endpoint.
- **PR 3 — dependent pre-existing fixes (T13 backfill, T14 = F15 re-pin gate + F16 edit-form):** each small; **F15 can ship independently first** and unblocks the manual escape hatch the design leans on.
- **PR 4 — E2E proof (T15).**

Rationale: PR 1 is what the demo needs; bundling the worklist (PR 2) and the pre-existing bug fixes (PR 3) into it delays the fix and makes review harder. Prerequisite for clean gating (see Decision 3): a tiny change to make `resolve-permissions.ts` emit `approve` — do it in PR 3 alongside F15.

---

## 9. Decisions (open questions resolved)

1. **Row cap (§6): soft cap 2,000 for auto-pin in v1 — but set the number from a measurement.** The commit handler is already synchronous and multi-write per row (Person + Parent + Student + compensation); pinning adds ~5 round trips *on top of* an already-heavy row, so a 10k file is a gateway-timeout risk **today, regardless of pinning**. v1: cap auto-pin at ~2,000, route the remainder to the §5.3 bulk-pin endpoint with an explicit preview note, and `log()` the truncation (never let silent truncation read as full coverage). **Before locking the number, time a 2,000-row commit *with* pinning against the real gateway timeout; drop to 1,000 if it's close.** The correct long-term fix — move commit to a BullMQ job + polling drawer — also fixes the pre-existing large-import timeout and is **v2, explicitly out of v1 scope** (don't let it block PR 1).

2. **Edit form (§5.5): option (b) — make it pin.** (a) is a lie-patch and re-creates the two-doors divergence this whole spec exists to fix. Extend the manual update path's re-pin condition from `feeAxisChanged` to `feeAxisChanged || noActivePin`. Low-risk in a specific way: it only **adds** a pin where none existed — it never touches or churns an existing pin, so it cannot archive or double-pin. Update the update-path tests.

3. **bulk-pin gate: `authorize('finance','approve')` on the backend — do not weaken it.** It commits money; it must match re-pin. The "FE can't detect `approve`" problem is a *separate* bug (fee-module-notes #3 / F15: `resolve-permissions.ts` only emits read/create/update/delete). Handle in two layers: **backend = `finance:approve`**; **FE button = `hasPermission('finance','update')`** as the detectable proxy (same stand-in as the F15 re-pin fix) until `resolve-permissions` emits `approve`. Add a tiny prerequisite task (in PR 3) to make `resolve-permissions.ts` emit `approve`; after that, re-pin AND bulk-pin gate cleanly on the real permission and the role-vs-permission mess dissolves.

4. **Money total in the confirm dialog: show it, as a consequence preview — not an approval.** Phrase it *"These 420 students will be bound to an estimated ₹6.42 Cr in fees"* — never "Approve ₹X". The import approves nothing; Finance already approved the FSIs, this binds students to them. Make the **row counts the headline** (420 pin / 18 no-match / 12 already-pinned) and the money a **muted secondary line labelled "estimated"** (it's the sum of matched FSI totals at *preview*; snapshots freeze at commit, E13). Keep it: a 10×-expected total (duplicated rows / wrong FSI) is exactly the gross error someone should stop on; the framing removes the "financial approval" misread.
