# Generate Bills — UX improvement suggestions

**Status:** proposed, not built. Follow-up to 007 T13.
**Screen:** `/finance/fee-management/generate-bills`
**Files:** `admin-portal/src/pages/finance/GenerateBillsPage.tsx` (154 lines),
`backend/src/modules/finance/fee-billing-service.ts`

---

## What exists today

**Backend — one endpoint, and it writes.**

`POST /api/finance/invoices/generate-from-pins` — `authorize('finance','create')`,
body `{ semesterId, studentIds?, yearOfStudy?, dryRun? }` (`routes.ts:318`).

Returns **counts only** (`BatchBillResult`):

```json
{ "generated": 12, "alreadyBilled": 3, "noPin": 2,
  "pinnedToDifferentAy": 0, "noAmount": 1, "errors": [] }
```

No names, no amounts, no per-student detail. `dryRun: true` runs the identical
read path and returns before writing.

**Frontend — you approve a number.**

1. Two dropdowns: Semester (required), Year of study (optional).
2. One button, *Preview & Generate*.
3. Click → POST `dryRun:true` → counts → confirm dialog
   (*"Generate 12 bills? 3 already billed (skipped). 2 have no active pin."*).
4. Confirm → same POST without `dryRun` → toast + "Last run" card, 6 number tiles.

### The problems

| # | Problem |
|---|---------|
| P1 | The operator never sees a student name. They approve an integer. |
| P2 | All-or-nothing within the filter — cannot bill 40 of 47. |
| P3 | Skips are abstract counts. "2 have no active pin" — *which* two? |
| P4 | No money figure anywhere. You cannot tell the accountant what was billed. |
| P5 | Only Semester + Year filters. No Programme or Branch. |
| P6 | Due date hardcoded `+30 days` (`fee-billing-service.ts:172`). |
| P7 | `dryRun` on a POST is a read wearing a write's clothes — so the preview is gated behind `finance:create` and a principal (approve/read only) cannot even *look*. |
| P8 | ~7 queries per student, sequential, including a `Semester.findOne` that is identical on every iteration (`fee-billing-service.ts:108`) and a second `Student.findOne` when the year filter is on (`:275`). Fine for dozens, crawls at 500. |

---

## Proposal

**One-line summary:** today you approve *a number*; after, you approve *a list of
people*, and you can uncheck any of them.

### Backend — split the read off from the write

| Route | Change |
|-------|--------|
| `GET /finance/invoices/bill-preview` | **new**, `authorize('finance','read')` — one row per student |
| `POST /finance/invoices/generate-from-pins` | unchanged job, now driven by the ticked `studentIds` (the param already exists and is already validated) |

Preview row:

```ts
interface BillRow {
  studentId: string;
  name: string;
  rollNumber?: string;
  programmeCode?: string;
  branchCode?: string;
  yearOfStudy: number;
  amount: number;                 // this installment, not the annual
  outcome: 'billable' | 'already-billed' | 'no-active-pin'
         | 'pinned-to-different-ay' | 'no-amount' | 'error';
  error?: string;
}
```

Plus:

- `programmeId` / `branchId` filters on `BatchBillInput` — the candidate query at
  `fee-billing-service.ts:264` just gains the fields (P5).
- Optional `dueDate`, defaulting to the current `+30 days` (P6).
- Extract the per-student rule into a **pure `decideBill(student, pin, fsi,
  semester, existingInvoice)`** with no I/O. The writer loads its docs and calls
  it; the preview bulk-loads Students / FSIs / Invoices with three `$in` queries
  and calls it per row. **One rule, two loaders** — ~5 queries total instead of
  ~7N (P8), and the writer's behaviour is unchanged so all 14 existing
  `fee-billing-service-007.test.ts` cases still pass.

### Frontend — the table replaces the dialog

1. Pick Semester (+ optional Programme / Branch / Year) → **the table loads
   itself** via `useQuery`. No Preview button, no confirm dialog: the table *is*
   the confirmation.
2. One row per student:
   `Rahul Kumar · 21CS045 · BTECH/CSE · Yr 2 · ₹62,500 · [Billable]`
3. **Billable rows** carry a ticked checkbox. **Non-billable rows are still
   listed**, greyed, checkbox disabled, reason in the badge (P1, P3) — and
   `no-active-pin` rows get a `Fix →` link to Pin Coverage. The operator
   physically cannot mis-bill, and skips become people instead of numbers.
4. Client-side search over loaded rows (name / roll).
5. Sticky footer: **`12 of 47 selected · ₹4,62,500`** → `[Generate bills]`,
   formatted with `toLocaleString('en-IN')` for lakh grouping (P2, P4).

---

## Why keep a preview at all

Considered and rejected: *just bill everyone, undo the mistakes.*

A billing run writes an Invoice, N InvoiceLineItems, and `$inc`s
`StudentFeeAccount.balance` (`fee-billing-service.ts:195-199`). Reversing 500 of
those across three collections is a feature we do not have and that costs more
than the table. **Showing before writing is the cheap version of an undo.**

## Rejected — single aggregation

`Student.aggregate` with `$unwind: feePins` + `$lookup`s would be one query, but
it re-implements the pin / AY-match / installment-split rules inside a pipeline.
Two sources of truth for "what does this student owe", in a money path. Not
worth it until the 5-query version measurably hurts.

---

# Billing history — "what was billed before"

## There is no run entity, and we should not add one yet

`generateSemesterInstallmentsForPinned` persists nothing about the run itself —
no `BillingRun` document, no job record. What it *does* leave behind is
durable and sufficient:

- **`Invoice`** rows carrying `isSemesterInstallment: true`, `semesterId`,
  `netPayable`, `status`, and `createdAt` (the schema has `timestamps: true`).
- **An audit entry per invoice** (`fee-billing-service.ts:206`) with
  `performedBy`, `entityId` and `entityName`.

So history is a **read over invoices already written**, not a new collection.
That matters: it works retroactively over every bill generated to date, needs
no model, no migration, and no backfill.

**Rejected for now — a `BillingRun` model.** It would record who clicked, which
filters were used, and the outcome counts as one row. Strictly more faithful,
but it only ever describes runs made *after* it ships, leaves today's invoices
invisible, and adds a write to a money path to answer a question the invoices
already answer. Revisit only if operators actually ask "who ran this and with
what filters" — at which point `performedBy` is already in the audit log and
can be surfaced without a new model.

## What the history view shows

`GET /finance/invoices/billing-history` — one row per **semester**, because that
is the unit an operator thinks in ("have we billed Sem 1 yet?"):

```ts
interface BillingHistoryRow {
  semesterId: string;
  semesterLabel: string;      // "Semester 1 — 2024"
  academicYearLabel: string;
  invoiceCount: number;
  totalBilled: number;
  totalCollected: number;     // Σ successful payments against those invoices
  outstanding: number;
  firstGeneratedAt: string;   // min(createdAt)
  lastGeneratedAt: string;    // max(createdAt) — later top-ups show as a spread
  generatedBy: string[];      // distinct performedBy, from the audit log
}
```

Two aggregations: `Invoice` grouped by `semesterId` for count/total/dates, and
`Payment` (status `success`) `$lookup`-ed to its invoice for collected. Both
need the `new Types.ObjectId(collegeId)` cast — `aggregate()` does not auto-cast
and would silently return zero rows.

Rendered as a table beneath the billing console, each row expanding to that
semester's invoices (`listInvoices` already accepts a `studentId`; it needs a
`semesterId` filter adding — two lines, same shape as the existing ones).

This also quietly answers a question the counts-only screen could never answer:
**is a semester fully billed?** `invoiceCount` against pinned-student count for
that semester is the coverage number.

---

# Execution plan

Four slices, each commit-shaped, each independently shippable and demoable.
Ordered so the thing blocking you today lands first.

## Slice 1 — Backend: make the preview a real read

The foundation; every later slice needs per-student rows.

1. Extract a pure **`decideBill(student, pin, fsi, semester, existingInvoice)`**
   with no I/O — the single source of truth for "what does this student owe".
   `generateSemesterInstallmentForStudent` loads its documents and calls it;
   the new preview bulk-loads and calls it per row. **One rule, two loaders.**
   The writer's behaviour is unchanged, so all 14 existing
   `fee-billing-service-007.test.ts` cases must still pass untouched — that is
   the safety net for this refactor.
2. **`GET /finance/invoices/bill-preview`**, `authorize('finance','read')`,
   returning `BillRow[]` + `totalAmount`. A read gated as a read, so a principal
   or read-only clerk can see what is about to be billed without holding
   billing rights.
3. Bulk-load Students / FSIs / Invoices with three `$in` queries — **~5 queries
   total instead of ~7 per student**. Kills the per-iteration `Semester.findOne`
   (`:108`) and the second `Student.findOne` under the year filter (`:275`).
4. Add **`programmeId` / `branchId`** to `BatchBillInput` and the candidate query
   (`:264`).
5. Add an optional **`dueDate`**, defaulting to the current `+30 days` (`:172`).

~150 lines + tests. **Ship-alone value:** none visible to the user — this is
plumbing. Do not demo after this slice.

## Slice 2 — The billing console

The visible win, and the answer to "we only show numbers".

1. Pick Semester (+ Programme / Branch / Year) → **the table loads itself**. No
   Preview button; the table *is* the confirmation, so the counts dialog goes.
2. One row per student: name · roll · programme/branch · year · **₹ amount** ·
   outcome badge.
3. Billable rows carry a ticked checkbox. **Non-billable rows still appear** —
   greyed, checkbox disabled, reason in the badge. Skips become people instead
   of integers, and the operator physically cannot mis-bill.
4. Client-side search over loaded rows.
5. Sticky footer: **`12 of 47 selected · ₹4,62,500`** → `[Generate bills]`,
   posting the ticked `studentIds` (the param already exists and is validated).
   `toLocaleString('en-IN')` for lakh grouping.
6. Due-date field on the form.

~300 lines FE + tests. The 3 existing `GenerateBillsPage.test.tsx` cases must be
rewritten — they assert the dialog flow that this deletes.

**Ship-alone value: high. This is the demo.**

## Slice 3 — Billing history

Independent of slices 1–2; could ship before them if priorities move.

1. `GET /finance/invoices/billing-history` (aggregations above).
2. Add a `semesterId` filter to `listInvoices` for drill-down.
3. FE: "Previously generated" table under the console, rows expanding to that
   semester's invoices.

~80 backend + ~120 FE lines.

## Slice 4 — Polish, only if wanted

- `Fix →` link on `no-active-pin` rows, deep-linking to Pin Coverage. Turns a
  dead end into a next step; one `<Link>`.
- CSV export of the preview for Finance sign-off before a large run.

## Deliberately not building

**Group-by-programme with subtotals** — with search plus a sortable amount
column, grouping only earns its keep past a few hundred rows. Flat table first.

**Progress bar / type-to-confirm for large runs** — the run is sequential and
server-side; a spinner is honest until someone actually bills 500 at once.

**A `BillingRun` model** — see above.

**Per-invoice paid amounts on preview rows** — `already-billed` students would
need an extra lookup each. Show `—`.

## Known ceiling

The preview runs `decideBill` per student on every filter change. After slice 1
that is ~5 queries plus in-memory work, so dozens are instant and ~500 is
sub-second. Pagination when someone actually feels it — the filters narrow the
set and React Query caches per filter-key.
