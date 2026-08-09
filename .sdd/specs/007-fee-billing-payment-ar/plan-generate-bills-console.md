# Implementation plan — Generate Bills console

Problems and rationale: `generate-bills-ux-suggestions.md`. This is the build.

**Three commits.** Commits 1+2 are one deliverable (the console) split for
reviewability — commit 1 alone changes nothing a user can see. Commit 3 is
independent and could ship first if priorities move.

**Guiding constraint: no refactoring of tested money code.**
`generateSemesterInstallmentForStudent` keeps its behaviour, so all 14 existing
`fee-billing-service-007.test.ts` cases must pass **untouched**. That is the
safety net; if any of them needs editing, the change went too far.

---

# Why we are building this

## What the screen does today

Two dropdowns (Semester, Year of study) → one button *Preview & Generate* → a
confirm dialog reading *"Generate 12 bills? 3 already billed. 2 have no active
pin."* → a card with six numbers.

**The failure running through all of it: the screen reports outcomes but never
shows subjects.** It tells an operator *how many*, never *who* — so they cannot
verify what is about to happen, cannot intervene in it, and cannot audit it
afterwards. Every problem below is a consequence of that one design choice.

## Issues addressed

### You cannot see what you are doing

| # | Issue | Addressed by | Commit |
|---|-------|--------------|--------|
| 1 | You never see a student's name — you approve an integer. "Generate 12 bills?" — *which* 12? No way to check before or after. | One row per student: name · roll · programme/branch · year · ₹ · outcome. The loop already computes this and discards it. | 1 + 2 |
| 2 | Skips are anonymous. "2 have no active pin" names a problem but not a person; finding them means leaving for Pin Coverage and cross-referencing by hand. | Non-billable students still render as rows — greyed, checkbox disabled, reason as the badge, `Fix →` deep-linking to Pin Coverage. | 2 |
| 3 | No money figure anywhere. Several lakh in receivables raised and the screen never says how much — an accounts officer cannot reconcile or sign off. | `totalAmount` on the response, ₹ per row, and a footer total in `en-IN` lakh grouping. | 1 + 2 |

### You cannot control what you are doing

| # | Issue | Addressed by | Commit |
|---|-------|--------------|--------|
| 4 | All-or-nothing. Cannot bill 40 of 47 and hold back a fee dispute, a pending scholarship, a wrong pin, a student who left. | Checkbox per billable row; Generate posts the ticked `studentIds`, a parameter that already exists and is already validated. | 2 |
| 5 | Only semester and year. A college running BTECH, MTECH and MBA cannot bill just BTECH — yet real colleges bill programme by programme, on different calendars. | `programmeId` / `branchId` on the candidate query; dropdowns from the existing `listProgrammes` / `listBranches`. | 1 + 2 |
| 6 | Due date hardcoded to today + 30 days. Colleges announce a due date *with* the bill — "payable by 15 September". No field for it. | Optional `dueDate`, defaulting to the current +30 days. Native `<input type="date">`. | 1 + 2 |

### You cannot tell what you did

| # | Issue | Addressed by | Commit |
|---|-------|--------------|--------|
| 7 | No history. The "Last run" card is the only record and it dies on refresh. Tomorrow you cannot answer *"did we bill Semester 1?"* without filtering the Invoices page by hand. | `GET /finance/invoices/billing-history` — one aggregation over invoices you already have, so it works retroactively. | 3 |
| 8 | No sense of completion. Run it, get "Generated 0", and you cannot tell whether that means *all done* or *wrong filter, nothing matched*. | The reason distribution across named rows disambiguates it: `Already billed 47` reads as done, `No pin 47` reads as blocked. History adds billed-vs-pinned per semester. | 2 + 3 |
| 9 | The confirm dialog is transient — misread it and it is gone, and it is the only place the projected numbers ever appear. | Deleted. The table *is* the confirmation and stays on screen, sortable and searchable. A confirm still guards the write, but the numbers no longer live in it. | 2 |

## Explicitly not addressed, and why

| # | Issue | Position |
|---|-------|----------|
| 10 | The preview is a write endpoint in disguise — `POST …generate-from-pins {dryRun:true}` gated `finance:create`, so a principal (approve + read) cannot even look at what is about to be billed. | Splitting it into a `GET` means touching a money path guarded by 14 tests, to open a gate that blocks nobody today: everyone who can open this page already holds `finance:create`. It matters the day a principal must review before billing. |
| 11 | ~7 queries per student, sequential, including a `Semester.findOne` repeated identically every iteration. | Imperceptible at the tens-of-students scale this runs at. Commit 1 does not worsen it — enrichment adds four queries **total**, not per student. The fix is extracting a pure `decideBill()` so preview and writer share one rule while loading differently; it gets materially safer once the console's behaviour is pinned by tests. |

Both are internal. No administrator can see either.

---

## Table columns — settled first, because the payload follows from them

| ✓ | Student | Roll | Programme | Yr | Amount | Status |
|---|---------|------|-----------|----|--------|--------|
| ☑ | Aditya Nair | 25B01A0511 | BTECH / CSE | 1 | ₹60,000 | Billable |
| ☑ | Kavya Menon | 25B01A0512 | BTECH / CSE | 1 | ₹60,000 | Billable |
| ☐̶ | Rohit Verma | 25B01A0513 | BTECH / CSE | 1 | — | Already billed |
| ☐̶ | Meera Krishnan | 25B01A0411 | BTECH / ECE | — | — | No pin · *Fix →* |

Checkbox disabled on every non-billable row. `Amount` is `sortable` — free from
`DataTable`. Never-pinned rows show `—` under Yr: their year is deliberately not
resolved (step 3b), so the column stays honest rather than guessing.

**`Fix →` links to Pin Coverage UNFILTERED.** Not pre-filtered by reason or by
year, because the two screens resolve year-of-study through different functions
that disagree: billing uses `resolvePinYearForExistingStudent`, which swallows a
Batch-lookup throw and falls back to `studyYearAtAdmission`
(`student-import-pin.ts:294-301`), while Pin Coverage calls
`resolveStudentYearOfStudy` directly and files that same throw under
`year-unresolvable` at year 0 (`fee-pin-audit-service.ts:221-234`). So the
console can show a student the pre-filtered page would not contain, and the link
would land on an empty list. Pin Coverage has its own search; unfiltered is the
only link that cannot lie.

Above: Semester (required) · Programme · Branch · Year · Due date.
Below, sticky: **`12 of 47 selected · ₹7,20,000`** → `[Generate bills]`.

---

## Commit 1 — Backend: return the rows the loop already computes

### `fee-billing-service.ts`

The batch loop already knows each student's outcome and amount and discards it
into a counter. Keep it.

```ts
export type BillRowOutcome =
  | 'generated' | 'already-billed' | 'no-active-pin' | 'pinned-to-different-ay'
  | 'no-amount' | 'unsupported-semester-number' | 'error';

export interface BillRow {
  studentId: string;
  name: string;
  rollNumber?: string;
  programmeCode?: string;
  branchCode?: string;
  /** 0 when it could not be derived (unsupported-semester-number only). */
  yearOfStudy: number;
  /** The installment this run would raise. 0 for every non-billable row. */
  amount: number;
  outcome: BillRowOutcome;
  error?: string;
}
```

`BillRowOutcome` flattens the existing `BillOutcome['kind']`, splitting
`skipped{reason}` into its two concrete values. **Deliberately the same
vocabulary as the writer** — no parallel set of names to keep in sync. The FE
labels `generated` as *Billable* on a dry run and *Generated* on a real one,
switching on the `dryRun` flag already in the response.

1. `BatchBillResult` gains `rows: BillRow[]` and `totalAmount: number`
   (Σ amount over `generated` rows only). **The FE ignores `totalAmount`** — the
   footer sums `rows[].amount` over the *selected* rows client-side, because the
   server figure is only correct in the all-ticked initial state and would
   silently stop matching the moment anyone unticks. The field exists for API
   consumers and the post-run toast.
2. `BatchBillInput` gains `programmeId?`, `branchId?`, `dueDate?`.
3. Candidate query (`:264`) gains the two axis filters — two lines.
3b. **Never-pinned students, as rows, without walking them.** The candidate
   query selects `feePins: { $elemMatch: { archivedAt: null } }`, so a student
   with `feePins: []` is not a candidate and produces no row at all — today
   `no-active-pin` can only fire for someone who holds a pin for a *different*
   year. Issue #2 and the mockup both promise otherwise, so close the gap with
   one extra query beside the candidate query:

   ```ts
   // active students with NO non-archived pin → rows, not candidates
   const unpinned = await Student.find({
     collegeId, status: 'active', ...axisFilters,
     feePins: { $not: { $elemMatch: { archivedAt: null } } },
   }).select('_id').lean();
   ```

   Push these straight in as `{ outcome: 'no-active-pin', amount: 0,
   yearOfStudy: 0 }` — no per-student walk, no year resolution. `enrichRows`
   picks up their names with everyone else.

   **Not by dropping the `$elemMatch`.** Widening the candidate set would send
   every active student through `generateSemesterInstallmentForStudent`, ~4-7
   queries each, only to return `no-active-pin` at `:122`. On a 2,000-student
   college that is minutes on a Preview click. This is `O(1)` queries instead.

   The predicate is the exact complement of the candidate query over the same
   `status: 'active'` + axis filters, so the two sets partition cleanly — no
   student appears twice, none is missed.
4. **DECIDED: the counters become a projection of `rows`, not a parallel tally.**
   The loop pushes one row per candidate; the existing
   `generated`/`alreadyBilled`/`noPin`/… counters are then computed by tallying
   `rows` once, instead of the current `result.generated += 1` running alongside.
   Rows become the single source of truth, so the summary line and the table can
   never disagree. The emitted values are identical, so the existing route tests
   pass unchanged. (The alternative — keeping both independent — leaves two
   places to update and a drift bug waiting; rejected.)
5. **`enrichRows(collegeId, rows)`** — one pass after the loop:
   `Student.find({_id:{$in}})` → `Person.find` names → `Programme`/`Branch` code
   maps, stitched on. Copy the shape from `getCoverage` (`fee-pin-audit-service.ts:163-175`).
   **Four queries total, not per student.**
6. Extend `BillOutcome` to carry `yearOfStudy` on **all five variants that are
   reachable after the year is resolved** — `already-billed`, `no-active-pin`,
   `pinned-to-different-ay`, `skipped{no-amount}` and `error`. The year is known
   from `:117` onward, so every one of these can report it and the column is
   populated for every row the operator can act on. `generated` already carries
   it as `yearAssumed`. Only `unsupported-semester-number` returns at `:111`,
   before resolution → `0`, rendered `—`.
7. `dueDate`: `generateSemesterInstallmentForStudent` takes it as an option and
   uses it at `:172`, **defaulting to the existing `+30 days`** so every current
   caller is unaffected.

### `validation.ts`

`generateFeeBillsSchema` gains:

- `studentIds: z.array(z.string().min(1)).min(1).optional()` — **the `.min(1)`
  on the array is a correctness fix, not tidying.** Today `studentIds: []`
  passes validation, then fails the `length > 0` check at `:261` and falls
  through to *bill every pinned student in the college*. Untick everything, hit
  Generate, mass-bill. Reject the empty array at the edge.
- `programmeId`, `branchId` — optional strings.
- `dueDate` — optional ISO date. **No future-date constraint**: colleges
  legitimately raise bills with a due date already passed (a late-entered
  installment, a deadline set during authoring). A past date simply means the
  invoice is overdue on arrival, which is a true statement, not an error.

### Tests

New cases; the 14 existing ones stay untouched.

- rows carry name / roll / programme code, one per candidate
- **a student with zero pins appears as a `no-active-pin` row** — the existing
  `no-active-pin` case (`fee-billing-service-007.test.ts:149`) builds
  `pins: false` and calls the *single-student* function directly, bypassing the
  batch's candidate query, so nothing currently exercises a never-pinned student
  through the batch. This is the test that makes step 3b real.
- counters equal the tally of `rows` (guards the #4 decision)
- `totalAmount` sums only `generated` rows
- `programmeId` narrows the candidate set; `branchId` likewise
- `dueDate` is honoured; omitting it still yields today + 30 days; a **past**
  date is accepted
- non-billable rows report `amount: 0`, their specific outcome, and a populated
  `yearOfStudy` for all five post-resolution variants
- **`studentIds: []` is rejected with a 400** — never interpreted as "everyone"
- **`studentIds` + `yearOfStudy` together**: the year filter still applies on
  top of an explicit list (`:274`). Pin the behaviour with a test so the FE
  contract below is enforced rather than assumed.

### Edge cases

| Case | Handling |
|---|---|
| `studentIds: []` | 400 at validation (above). Belt and braces: the service keeps its `length > 0` check. |
| Duplicate ids in `studentIds` | **Dedupe candidates before the loop.** On a dry run nothing is written, so the idempotency guard cannot catch the second occurrence — the same student would report `generated` twice and `totalAmount` would double-count. |
| Id from another college / non-existent | `Student.findOne({_id, collegeId})` throws 404, caught by the loop's try/catch → lands in `errors[]` and an `error` row. Assert it is not a 500. |
| `yearOfStudy` filter skips a student | `continue` — no row emitted. `rows.length` is therefore ≤ candidates; documented, since filtered-out ≠ skipped. |
| **`yearOfStudy` filter + never-pinned students** | **Skip the 3b query entirely when a year filter is active.** Their year is unknown by construction — we deliberately do not resolve it — so listing them under "Year 1" would be a claim we cannot support. With no year filter (the common case) they appear. Documented rather than silently inconsistent. |
| **`studentIds` supplied explicitly** | **Skip the 3b query.** The operator named the set; a never-pinned id in that list still flows through the loop and returns `no-active-pin` at `:122` as it does today. 3b applies only to the bill-everyone-pinned branch. |
| Student with no `personId`, or a missing Person | `name: ''`; the table falls back to the roll number. |
| Student with no programme/branch | `programmeCode`/`branchCode` undefined → `—`. |
| No candidates match | `rows: []`, `totalAmount: 0`, all counters 0. |
| 500 candidates | ~75 KB payload. Acceptable; pagination deferred. |

---

## Commit 2 — Frontend: the console

### `services/finance.ts`

`generateFeeBills` body gains `programmeId` / `branchId` / `dueDate`;
`GenerateFeeBillsResult` gains `rows` / `totalAmount`.

### `GenerateBillsPage.tsx` — rewrite (~154 → ~330 lines)

Clone PinCoveragePage's layout. Reused as-is: `DataTable` (sorting free),
`listProgrammes` / `listBranches` / `listSemesters`, `confirmStore`,
`toastStore`, the `finance:create` guard.

- **The Preview button stays.** Filters do NOT auto-fire the query; the operator
  sets them and clicks *Preview*, and the result lands **in the table** instead
  of in a dialog. The dialog is what dies, not the explicit step. Auto-firing on
  every filter change would launch a ~7-queries-per-student walk on each
  keystroke, and it takes away the operator's control over when a heavy read
  runs.
- `selected: Set<string>`, seeded from the billable rows on each preview.
- Non-billable rows render with a disabled checkbox and their reason as the badge.
- Due date is an empty optional `<input type="date">`. **No default is
  pre-filled** — a blank field sends nothing and the backend applies its
  existing +30 days, which is the sane deadline for a fee bill. Pre-filling
  today would make the common case a bill due the day it is raised.
- Sticky footer with the selected count and Σ ₹ (`toLocaleString('en-IN')`)
  summed **client-side over the selected rows**, never from the response's
  `totalAmount`, which is only right while everything is ticked.
- **Generate is disabled whenever the selection is empty** — the FE guard
  matching the `.min(1)` validation, so the mass-bill path is closed at both
  ends rather than relying on either alone.
- **Generate posts `{ semesterId, studentIds: [...selected], dueDate }` and
  NOTHING else** — no `programmeId`/`branchId`/`yearOfStudy`. The selection
  already encodes the filtering, and per the test above the year filter would
  otherwise re-apply on top and silently drop ticked rows.
- `confirmAction` still fires before writing — but the numbers now live in the
  table, not in a dialog that vanishes.

### Tests

The 3 existing cases assert the dialog flow this deletes; rewrite. New: rows
render, non-billable checkbox is disabled, footer total tracks selection,
Generate is disabled on empty selection, Generate posts only the ticked ids
without filters, and changing a filter invalidates a stale table.

### Edge cases

| Case | Handling |
|---|---|
| **Filters changed after previewing** | **Clear the table and the selection.** Otherwise the operator narrows to MTECH, sees the stale BTECH table, and bills the wrong cohort. The table must never outlive the filters that produced it. |
| Selection empty (all unticked, or every row non-billable) | Generate disabled; footer reads `0 selected · ₹0`. |
| Preview returns zero rows | Distinguish the causes in the empty state: *no pinned students match these filters* vs *every matching student is already billed*. "0" alone reproduces problem #8. |
| Semester not chosen | Preview disabled — it is the one required filter. |
| A row is billed by someone else between preview and Generate | The idempotency guard returns `already-billed`; the result summary surfaces it. No double-bill, because the guard is server-side. |
| Due date left blank | Omit the field; the backend applies +30 days. |
| Preview slow on a large cohort | Button shows a spinner and is disabled while in flight, so it cannot be double-fired. |

---

## Commit 3 — Billing history

Independent of 1 and 2.

### Backend — one aggregation, no new model

Invoices already carry `isSemesterInstallment`, `semesterId` and `createdAt`,
so this works **retroactively** over every bill already generated.

```ts
interface BillingHistoryRow {
  semesterId: string;
  semesterLabel: string;     // "Semester 1 — 2024"
  invoiceCount: number;
  totalBilled: number;
  firstGeneratedAt: string;
  lastGeneratedAt: string;   // a spread means bills were added later
}
```

`GET /finance/invoices/billing-history`, **gated `authorize('finance','create')`**.

Two registration details, both load-bearing:

- **Register it ABOVE `GET /invoices/:id` (`routes.ts:326`).** Express matches in
  order, so a route declared after it resolves `billing-history` as an `:id`,
  and the handler tries to load an invoice with that literal id. The symptom is
  a 404 or a cast error, and it looks nothing like a routing bug.
- **`finance:create`, not `read`.** This is billing-run history, and it lives on
  a screen already gated `finance:create`; anyone who cannot bill cannot reach
  it, so a `read` gate would advertise access that the page never grants. Keeping
  the endpoint's gate equal to its only caller's keeps the surface honest.
  (Deliberately the opposite call from the deferred preview split, where the
  point *was* to widen access to non-billers — here there is no such consumer.)

`Invoice.aggregate` grouped by `semesterId`, joined to `Semester` for labels.
`new Types.ObjectId(collegeId)` cast is load-bearing — `aggregate()` does not
auto-cast and would silently return nothing.

### Edge cases

| Case | Handling |
|---|---|
| Route shadowed by `/invoices/:id` | Registered above `:326` (above). Add a route test that hits the path and asserts it is not the `getInvoice` handler. |
| `isSemesterInstallment: true` with a null `semesterId` | Excluded — `$match` requires `semesterId` to exist. The partial index tolerates such rows, so they can exist; they would otherwise form a meaningless `null` bucket. |
| Semester document deleted, invoices remain | `$lookup` yields nothing → label falls back to the raw id rather than dropping the row. Money that was billed must not vanish from history because a lookup failed. |
| **Cancelled invoices** | **DECIDED: excluded from `totalBilled` and `invoiceCount`.** `cancelled` means the bill should not have existed. `written_off` and `disputed` ARE counted — those were genuinely raised and later resolved, and hiding them would understate what the college billed. |
| Nothing billed yet | Empty state, not a zero row. |
| `collegeId` passed as a string | Cast to `ObjectId` — otherwise the aggregation silently returns zero rows (the G2-M5 trap, and the same bug fixed in the dashboard). |

**Deliberately excluded: `collected` / `outstanding`.** The dashboard already
reports collections and net AR from `StudentFeeAccount`. A second money
aggregation on another page is exactly how two screens start disagreeing — the
bug class fixed in `c550955`. History answers *what was billed*; the dashboard
answers *what is owed*.

**Deliberately excluded: inline drill-down and `generatedBy`.** The Invoices
page already lists invoices; a `View invoices →` link filtered by semester
reuses it. `listInvoices` needs a `semesterId` filter — two lines, same shape as
the existing `studentId` one. `performedBy` is already in the audit log for
anyone who asks.

### Frontend

A "Previously generated" `DataTable` below the console. ~60 lines.

---

## Sequencing risks

| Risk | Mitigation |
|---|---|
| Row shape misses a column the table needs | Columns settled above, before the payload |
| Ticked rows silently not billed | Backend test pins the filter interaction; FE posts ids only |
| Refactor creep into the writer | The 14 existing tests must pass unedited |
| Preview slow at 500 students | Out of scope. ~7 queries/student is unchanged; enrichment adds 4 total, not per row. Revisit only if measured. |

## Not building

`GET /bill-preview` split · pure `decideBill()` extraction · bulk-loading the
preview · a `BillingRun` model · group-by-programme subtotals · CSV export ·
progress bars. Rationale for each in the suggestions doc.
