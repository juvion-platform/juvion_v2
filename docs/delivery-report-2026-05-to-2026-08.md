# Juvion v2 — Delivery Report, May–August 2026

**Period:** 2026-05-13 → 2026-08-09 (trailing three months to 2026-08-10)
**Scope:** All commits merged to `main` — backend, admin-portal, e2e, `.sdd/` artifacts
**Method:** Read of the full git history (`git log --since`), commit bodies, and diffstats
**Companion:** Published as a web page at `claude.ai/code/artifact/8de43a9f-88a0-4ec8-8af6-e5afa79552b3`

---

## At a glance

| Measure | Value |
|---|---|
| Commits | 131 (99 non-merge) |
| Pull requests | 30 (#57 – #86) |
| Files touched | 634 |
| Lines | +69,212 / −4,080 |
| New Mongoose models | 26 |
| New test files | 98 |
| New Playwright specs | 13 |
| Contributors | 5 |

Delivery came in two dense bursts rather than a steady drip.

| Dates | Commits | Theme |
|---|---|---|
| 2026-05-13 → 05-18 | 70 | Strategic gaps, AI layer, e2e + CI platform |
| 2026-05-26 → 05-27 | 2 | Fee snapshot at pin time, daily AI cache |
| 2026-07-13 | 1 | Campus Ops route fix |
| 2026-07-26 → 07-31 | 24 | Bug-audit remediation, student bulk import, fee-pin coverage |
| 2026-08-09 | 2 | Semester billing / payment / AR, incremental tsc |

> **Counting caveat.** The late-period commit counts understate the volume. From 2026-07-26 onward, work landed as squash-merged PRs bundling many underlying commits — e.g. `105579f` (31 Jul) is one commit carrying 41 files and 4,290 insertions; `1d1604c` (9 Aug) carries 49 files and 5,935 insertions.

---

## 1. Eight strategic gaps (2026-05-13 → 05-14, PR #57–#60)

A competitive comparison against CampX identified eight capabilities where Juvion would be disqualified before its architecture got a hearing. Each was closed to a "Phase A" floor, with deeper phases scheduled rather than half-built.

### Gap 1 — Faculty Profile depth & NAAC alignment

Seven phases across two days (`dc72c6a`, `ac0bcf0`, `6422329`, `6c2ffaf`, `4613b35`, `18f5e27`, `06e4d48`):

| Phase | Delivered |
|---|---|
| A | 33 external credential IDs across 5 NAAC-relevant groups (Indian regulators, international research, MOOC, code platforms, social/web) |
| B1 | `profileBio` + `office` sub-documents; generic `FacultyDocument` evidence store with S3, presigned view URLs, soft delete |
| B2 | 24 document types across the 12 NAAC categories, with 1:1 vs 1:N card semantics |
| B3 | Verification workflow — pending → approve/reject with mandatory reason, audit entry, college-wide FIFO queue |
| B4 | Per-document audit timeline, SLA badges (>7d amber / >30d red), filter-aware bulk approve/reject |
| D1 | `FacultySubjectAssignment`, `FacultyResearchScholar`, `FacultyBook` |
| B (orig.) | `FacultyPublication`, `FacultyPatent`, `FacultyProject` with NAAC scoring fields — indexing service, quartile, impact percentile, level, author position, UN SDG mapping |

Bulk approve/reject dispatches the existing per-document service so the audit trail stays row-grained (one entry per approval) rather than one entry per batch.

### Gap 2 — Schema-driven bulk import (`976a203`, `f6e6f6d`)

`ImportJob` lifecycle state machine (pending → parsing → preview_ready → committing → completed/partial/failed), inline RFC-4180 CSV parser (no new dependency), per-row validation preview, and a commit step that calls the same canonical service-layer create a manual entry would — so audit logs and downstream hooks fire identically.

- Multi-tenancy enforced in the Mongo query **and** the S3 key.
- Caps: 10 MB file, 10,000 rows, CSV only.
- Five entity types: student, faculty, staff, applicant, programme. The applicant schema's 18 fields exist specifically to batch-import EAMCET / JEE rank lists.

### Gap 3 — Schema-driven config registry (`6accd9c`)

Generic `ConfigEntry` model, `config-registry.ts` describing fields server-side, and one `SchemaConfigPage.tsx` handling both singleton and multi-record cardinalities. Adding a config subsystem is a one-line registry append — no model, service, route or page.

### Gap 4 — Declarative report engine (`9cc8ecc`)

12 `ReportDefinition` entries with parameter schema, column schema and runner. Three implemented (admissions-funnel, lead-source-performance, student-roster-snapshot); nine stubbed with a `PhaseBStubError` sentinel the service converts to `status: 'unimplemented'` so the UI shows a clean notice, not a stack trace. Every execution persists a `ReportRun` row.

### Gap 5 — Admissions CRM depth (`28b1858`, `fd7db6c`)

Depth on existing entities rather than new tables:

- 5 UTM fields carried Inquiry → Applicant, so campaign spend traces to enrolments.
- MQL/SQL classification, orthogonal to lead grade.
- Inquiry status enum widened 9 → 28 values; Applicant 11 → 17.
- New `AssignmentRule` model — 11 testable fields, 8 operators, priority-ordered first-match-wins — wired into `createInquiry` as a best-effort hook, plus a preview endpoint that dry-runs a hypothetical inquiry before a rule goes live.
- 4 single-roundtrip CRM aggregations: pipeline, funnel, per-officer conversion, source/UTM attribution.

Also fixed a pre-existing silent Zod strip: `leadGrade` was on the model but absent from the schema, so it was dropped on every create.

### Gap 6 — Examination administration depth (`e0c3585`)

7 new models under `models/academic-ops/`: `ExamRoom`, `Evaluator`, `GradeTemplate`, `ExamCentreTemplate`, `QuestionPaperSchema`, `SignatureType` (versioned, so an old certificate renders with the signature valid at issue time), `MoocSubject`. 35 routes, plus two config types (naming-series, award-classification) registered against the Gap 3 registry with no new infrastructure.

### Gap 7 — L3 sub-personas & cluster heads (`42b7a89`)

9 new third-level personas added without expanding the workspace count — the architectural thesis being defended. `shared/rbac/personas.ts` became the canonical catalogue; `Staff` gained `personaCode` and `clusterHeadOfPersonIds`; `GET /api/people/personas` and a read-only catalogue page make the tier structure browsable.

### Gap 8 — HR build-vs-buy (`9dd809d`)

Decision: **buy**. ERPNext / Frappe HR owns the personnel side (leave, attendance, payroll, expenses); Juvion keeps the academic side and the intelligence layer. Phase A ships config, a 6-event → DocType mapping registry, integration logging and an admin page — but makes **no outbound HTTP calls**. Shipping the wire before the ERPNext deployment and secrets vault exist would mean production dialling out.

---

## 2. The AI layer (2026-05-14 → 05-17, SDD 001–004)

Four features, each through the full spec → validate → plan → tasks → audit workflow before implementation.

### 001 — AI lead scoring (`bdd46eb`, `1a9287f`, `95696ca`, `656fb36`, `e02ffa7`)

Hybrid scorer: deterministic rules (source, academic fit, programme interest, interaction count/recency/outcome) blended 60/40 with a masked-context LLM call into a 0–100 score and one of four grades. Runs as a BullMQ worker triggered on inquiry create and on positive lead interactions, with a 5-minute debounce collapsing repeat scores into one job via a minute-bucketed `jobId`.

Frontend: grade badge, filter chips, sort-by-score, recompute button distinguishing 202-enqueued from 208-already-scored, and a rationale card breaking out rule vs LLM contribution with the top 5 weighted factors and their source. Dashboard tile reports 7-day volume, LLM/rules split, daily cost, average latency.

### 002 — AI-assisted config (`b838b5c`, `395f079`, `a62763c`, `1c55f4b`, `168691e`)

Confidence-scored field suggestions with rationale, accepted or rejected inline. Accepted values write to the audit log with `source: 'ai'` per field, so a reviewer can later distinguish AI-accepted from manual values. Fields marked `aiSuggestable: false` are projected out of the prompt **before** assembly, never stripped after the call.

### 003 — NL report queries (`04b59d3`, `9aee321`, `f8bb420`, `8350245`, `3463753`)

Plain-English question → one of three implemented reports, or a clean refusal. 11-step pipeline: mask → dedup → cap → prompt → 10 s abort → parse → validate → runReport → persist → audit → cache. The allow-list is enforced at the type level via a Zod enum on `reportCode`, so an unknown code is a parse failure rather than a runtime branch. Every refusal path still persists a query row and writes an audit entry.

### 004 — Opening NL to non-admin personas (`1101ada` → `f6ce1f6`)

Replaces the hard `requireRole(['admin','super_admin'])` gate with policy-based access plus scope-aware runners.

- Every `ReportDefinition` declares `scopeEligibility: { departmentOnly, selfOnly }`.
- `runReport()` checks it and throws `ScopeNotSupportedError` **before** any side effect — no `ReportRun` row, no runner invocation, no audit entry.
- Dedup cache key extended with a SHA-1 over (role, personaType, dept segment, self segment) so two personas can never share a cached answer.
- Rollout behind `RBAC_NL_ENFORCE`, read per-request.

**Gate 2 materially reshaped this feature.** Five critical findings, two worth naming: the spec's persona codes did not exist in `personas.ts` at all, and `AuthScope.departmentId` is a `Department._id` while `Student.branchId` is a `Branch._id` — different collections, requiring a two-step lookup the spec assumed away. Both caught on paper.

### Safety patterns shared across all four

| Concern | Mechanism | Failure behaviour |
|---|---|---|
| Cost | Atomic Redis INCR per college per day, namespaced per feature | **Fail closed** — no LLM call if Redis is unreachable |
| PII | Masker runs upstream of persistence | Stored question is always the masked form |
| Duplicate spend | 30 s dedup on a hash of the masked input | **Fail open** — a duplicate charge beats a broken flow |
| Latency | `AbortController` at 10–12 s | Falls back to rules-only, or refuses with a stated reason |
| Hallucination | Strict JSON schema, allow-list enum, per-runner param validation, extra-key rejection | Dropped silently from results, logged as a metric |
| Provenance | Dedicated audit actions + per-field `source` marker | Every outcome, including refusals, is recorded |

---

## 3. Test & CI platform (2026-05-16 → 05-18, PR #65–#67, #70, #71, #74, #75)

### Playwright against the live stack (`9930d30`, `a995c66`)

A dedicated `e2e/` workspace, sibling to backend and admin-portal — the tests assert full-stack behaviour, so filing them under the frontend misframed what they cover. Discipline: **zero retries** as a hard acceptance criterion (a retry hides drift), no `page.waitForTimeout`, `page.route` mocks where determinism matters.

Also caught a real bug: the 401 interceptor hard-redirected on *any* 401 including the login response itself, so bad credentials reloaded the page before the error could render.

### RBAC seeding consolidated (`f4af314`)

`DEFAULT_POLICIES` was being written from three places, two of them non-idempotent `insertMany`. Consolidated into `shared/seed/policies.ts`, upserting by natural key — re-run is a row-level no-op, operator-added college-specific policies survive, edits to `defaults.ts` propagate on next run.

### CI hardening

Seven commits, each a real environment defect rather than a test tweak:

| Commit | Defect |
|---|---|
| `3bbe403` | No Redis service — backend blocked on ECONNREFUSED, health never came up |
| `cc0b555` | CI set `MONGO_URI` but `config/db.ts` reads `MONGODB_URI` |
| `d0ab32e` | Job-level `NODE_ENV=production` made `npm ci` skip the devDeps typecheck needs |
| `5c3b14d` | Same var tripped the `PAYMENT_WEBHOOK_SECRET` startup guard inside vitest |
| `d0344c9` | `vite preview` doesn't inherit the dev proxy — login 404'd, every auth test timed out |
| `c137086` | Empty `Policy` collection → `authorize()` denied universally → 9 of 29 tests timed out |
| `04e82a8` | TS5107 `moduleResolution: node10` deprecation as a hard error in CI only |

### Documentation (`686b30e`, `4a356b3`)

`CLAUDE.md` refreshed with the RBAC model, fee-pin contract, SDD workflow and e2e discipline. `AGENTS.md` became a symlink to it, eliminating a file that had already drifted. A PR template added a docs-impact checklist.

---

## 4. Fee-pin foundations (2026-05-17 → 05-27, PR #72, #73, #76)

### Four axes, one contract (`61d19ca`, `f150451`)

A discovery exercise (`.sdd/discovery/005-fee-mapping-architecture/`) found the matching rule was only derivable by reading the scoring code. Now explicit in `FeeStructureInstance.ts` and `fee-pin-service.ts`:

- **Required exact:** `collegeId`, `programmeId`, `academicYearId`, `status: 'active'`.
- **Wildcardable:** `branchId`, `category`, `quota`, `yearOfStudy` — null on the FSI means "match any".
- `scoreAxis()` returns 0 (mismatch, reject) / 1 (wildcard) / 2 (exact), with powers-of-ten weighting so branch-exact always beats any combination of lower-tier exacts.
- **Course is not a fee axis.**

Two real defects fell out: quota was scored asymmetrically, so a student with a declared quota could not match a wildcard FSI, and a student with none could match anything. `checkPinValidity` had the same inversion and would have raised false-positive drift banners in production.

### Fee snapshot at pin time (`3123c5b`)

Evaluated components are frozen into the pin subdocument at pin time, so invoice generation is immune to post-pin `FeeComponent` edits. Legacy pins without a snapshot fall back to a live fetch. Same commit fixed four W01 admission-workflow engine bugs (handler result vs raw input passed to `advanceWorkflow`, unguarded handler throws, concurrent sibling completions each spawning the next step, an invalid Invoice status enum value).

### Programme transfer UI (`a522a28`)

The backend rejects `programmeId` changes through the generic student PATCH by design — fee pins must rebind atomically. The transfer endpoint and its FE service wrapper both existed; nothing called it. Administrators editing academic details hit a 403 with no path forward. Now the field is read-only in edit mode with a transfer affordance beside it.

### Server-side AI cache (`2ad4f9b`)

Forecast, situations and risk-scores each hit an LLM on every dashboard load. Now Redis-cached with TTL to UTC midnight, per-section and master force-refresh, "Cached · HH:MM" chips. Dismissing a situation card invalidates the key immediately.

---

## 5. Bug-audit remediation & the UX platform (2026-07-26 → 07-27, PR #77–#80)

`Juvion_v2_Bugs.docx` produced five critical defects, global UX gaps, per-module validation holes, and 36 pages with no frontend. Fixes were applied in shared components wherever possible.

### Five critical defects (`9bd1458`)

1. **Campus Ops entirely dead** — `campus-ops.ts` BASE was `/campus-ops`; M08 mounts at `/campus`. All 34+ sub-pages silently showed "No data". Every other service base was audited against `routes/index.ts`; this was the only mismatch.
2. **User null after refresh** — the user object was never persisted, so name/role/email went null on F5 and role-gated UI fell false.
3. **No error boundary** — any render error produced a blank white screen.
4. **No token refresh** — expiry did `window.location.href = '/login'`, destroying unsaved forms. Replaced with background renewal 5 min before expiry, a deduped refresh-and-replay on 401, and soft navigation only on genuine renewal failure.
5. **Plaintext `admin123` on the login page** — the sample-credentials panel had no DEV guard.

### Global list primitives (`5d1162c`)

| Surface | Scale | Change |
|---|---|---|
| Confirm dialogs | 195 call sites | Promise-based `confirmStore` + `ConfirmDialog` replacing every native `confirm()` / `prompt()`; supports typed confirmation and a required-reason field |
| Pagination | 157 pages | Shared component with record count and page-size selector. 34 Campus Ops pages had been paginating their query while rendering no pager — page 1 was the only reachable page |
| Search | 146 pages | Debounced `SearchInput`, backed by generic server-side `?search=` in `paginate()` — schema-derived string fields, regex-escaped, capped at 12, denylist for credential-ish paths. ANDed with the caller's filter, so search can never widen tenancy/RBAC scope |
| Empty states | 173 pages | Each page distinguishes "no records" from "filter matched nothing" using its own heading as the noun |
| Accessibility | Modal + DataTable | `role="dialog"`, `aria-modal`, real Tab focus trap, focus-in/restore; click-to-sort, skeleton rows, labelled clickable rows |
| Feedback | ~200 call sites | Toasts implemented once in the React Query MutationCache/QueryCache, plus an explicit 404 page |

The search term reaches `paginate()` via an AsyncLocalStorage request context (`shared/request-context.ts`) rather than being threaded through 216 service signatures for a concern none of them model.

### 36 missing pages (`3ca664b`, `7d39564`, `a80ddb3`)

12 Placement, 10 HR, 8 Student Development, 4 People surfaces had complete backends and no frontend — `/placement/drives` did not resolve. They share a config-driven `ResourcePage`: each declares fields, ref pickers and lifecycle actions; the shared component supplies table, sorting, search, confirm dialogs and toasts.

Lifecycle transitions are modelled as **row actions**, not a status dropdown, because these modules expose state changes as dedicated endpoints. Create/Edit are hidden where the API genuinely has no such endpoint, so the UI stops offering actions the server would reject.

Four surfaces got bespoke panels (attendance marking, internal marks, timetable periods, HR appraisal workflow). Building them surfaced a real backend bug: `bulkCreateAttendanceRecords` / `bulkCreateInternalMarks` used `insertMany`, which threw on the unique index the second time a sheet was saved — **correcting a register was impossible**. Both are now `bulkWrite` upserts.

### Derived values locked down (`2566ef7`, `2c0c240`)

- Student fee accounts exposed `totalPaid` / `totalWaived` / `totalRefunded` / `balance` as editable inputs while the payment pipeline owns them via `$inc`. Manual edits silently desynced an account from its transactions. Now read-only in the form **and** rejected by a `.strict()` schema.
- Payroll gross/net derive from components. Leave applications compute days from the range and expose real approve/reject/withdraw actions hitting the lifecycle endpoints — a PUT of `status` skipped balance deduction and approver recording.
- System-generated records (delivery logs, Juvi conversations/messages/usage metrics) lost create and delete entirely.
- Anti-ragging complaints and crisis alerts — statutory records — now require typing DELETE plus a recorded reason.

### Validation, both halves (`2c0c240`, `ef81a55`, `4ccea25`)

Exam schedule times, placement season dates, hostel visitor log times and filing-date-required-when-filed were accepted silently on client **and** server. Both closed, with shared `refineRange` / `refineRequiredWhenStatus` helpers rather than three copies of the same `superRefine`. Both skip when a field is absent, so they compose with `.partial()` schemas.

### 13 pre-existing test failures repaired (`b34f37b`)

Two were genuine implementation regressions from `2ad4f9b`: `situationsSchema` lost `.strict()` (so a body carrying `collegeId` would be silently stripped rather than rejected), and two response shapes changed without their tests. Four were time bombs — `backfill-fee-pins` hard-coded a 2025-26 academic year, so past 2026-05-31 every student became "unresolvable". One was order-dependence from the daily AI cache. One was a fixture seeded in an order that made the code path it was named for unreachable.

---

## 6. Student bulk import (2026-07-27 → 07-31, PR #81)

### Two doors, one engine

`/platform/bulk-imports` needs `platform:create` (admin/principal only), so a Registrar — who owns student records — got a 403. A thin `people`-gated facade at `/api/people/students/import/{template,preview,commit}` delegates to the same service.

- Student schema grew 11 → 24 fields (address, academic placement, guardians).
- Template headers mark mandatory columns with a trailing `*` that `normalizeImportHeader` strips on upload. This is a **two-way contract across workspaces**, so `student-import-header-roundtrip.test.ts` asserts it holds for every field, including ones added later.
- Field validators are synchronous and cannot reach the DB, so an optional async `validateRow` hook was added — this is what lets preview honestly label rows Create / Update / Blocked before anything is written.
- `onboardingStatus` was dropped from the template: a spreadsheet could mark onboarding complete with no fee-responsible guardian, bypassing `assertStudentOnboardingRules`.

### What re-import used to do, and now doesn't

| Failure | Consequence | Resolution |
|---|---|---|
| Fee-axis change applied directly | Unguarded programme transfer bypassing the 403; fee pin left bound to the old programme with no `staleSince` marker | Blocked at preview naming the transfer screen; re-checked at commit (409) |
| Duplicate natural keys within one file | Two rows sharing a `rollNumber` both previewed Create; at commit row 2 overwrote row 1 and the job reported two successes | Opt-in `naturalKeys` schema declaration evaluated by the engine's per-file loop |
| Whole `address` object `$set` | A row with no address columns silently wiped stored addresses | Only the specific `address.*` dotted paths the row supplies |
| `status: cell(...) \|\| 'active'` ran unconditionally | Re-importing a withdrawn/expelled student flipped them back to active | Default is create-only |
| No rollback on the update path | `Person.updateOne` could succeed then `Student.updateOne` fail, leaving the Person permanently overwritten | Snapshot/restore compensations, including re-`$unset`ting paths that did not previously exist |
| Guardian resolved to the student | In Indian intake the student's phone is often the family phone, so a student could become their own guardian — silent corruption, since `feeResponsibleParentId` gates onboarding | Resolve every Person on the phone, prefer an existing guardian, never attach to a known Student or Faculty |
| `Number('')` on blank `admissionYear` | Wrote 0 on create, clobbered a real value on update, corrupting the phone+year natural key | Blank treated as absent |
| Blocked rows counted as failures | A job whose only anomaly was one ineligible row finished `partial` with "1 failed" | Blocked is its own outcome and its own counter, excluded from the status ladder |

### The roll-number index

The students index was `{ collegeId: 1, rollNumber: 1 }` with `{ unique: true, sparse: true }`. On a **compound** index, `sparse` omits a document only when *every* indexed field is absent — and `collegeId` never is. So every student without a roll number was indexed under `{ collegeId, null }`, and a college could hold exactly one of them.

`rollNumber` is optional by design (admissions allocates it later; the import does not require the column). Importing two roll-number-less students was therefore impossible — and it explained a long-red test attributed to phone normalisation. Fixed with `partialFilterExpression: { rollNumber: { $type: 'string' } }`, shipped with `scripts/fix-student-rollnumber-index.ts` because `createIndex` on an existing key pattern with different options raises `IndexOptionsConflict`.

### Making the outcome visible (`44e2ee5`, `b38dbd0`, `5794776`, `e6169eb`)

- Per-row commit failures land on the `ImportJob`, which a Registrar cannot read. They now travel with the commit response; the drawer stays open on anything but a clean import, listing failed rows with errors and blocked rows with reasons.
- Two read-only history routes under `authorize('people','read')` let a past job be reopened, rendering through the same component as a fresh commit via an extracted `jobSummary()`.
- The update audit now records **what** changed — one entry per field that moved, with `oldValue`, `newValue` and `source: 'import'`. This is precisely why the address-wipe and status-flip defects left no trace.
- `validPhone` now strips separators and an optional `+91` / `91` / leading `0` before the 10-digit check, storing the canonical form — phone is a natural key compared by exact equality in `matchExistingStudent` and `linkOrCreateParent`.

---

## 7. Billing, payment capture and live AR (2026-07-29 → 08-09, PR #82–#86, SDD 006 & 007)

### Authoring fee structures at all (`74fa6fe`, `2085a76`)

`FeeStructureInstance` — the record students actually pin to — could only be created by the seed script.

- The create schema was silently stripping `yearOfStudy`, so per-year fees were unreachable through the API.
- `PATCH` and `DELETE` added for drafts, locked once submitted; a rejected structure returns to draft on edit.
- New `FeeStructureInstancesPage` covering author → submit → approve → activate → reject → archive, with a live "already active for this slot" warning.
- **Supersede scoping fix:** activating an FSI superseded existing actives by (programme, branch, quota, category) only — so activating a Year-2 structure silently retired the Year-1 one for the same combination and unpinned that cohort. The filter now matches the full axis tuple including `academicYearId` and `yearOfStudy`.

### 006 — Auto-pin on import + Pin Coverage worklist (`105579f`)

Three decisions shaped it:

- **The academic year is resolved once per job and frozen** on the `ImportJob`, not derived per row — a long import could otherwise straddle a year rollover and split one cohort across two years, and preview/commit could disagree if `isCurrent` flips between them. Two years flagged current is **refused, not guessed**.
- **Pin outcomes are tallied on their own axis** and never touch `successCount` / `failureCount` / `blockedCount` or the status ladder. A file where every row fails to pin still reports `completed` — "the college has not published next year's fee structures" must not read as a broken import.
- **Preview echoes the resolved pin year** per row, not just the amount. `studyYearAtAdmission` is optional, so a blank column silently means Year 1; a mid-lifecycle intake would otherwise show a confident figure against a year nobody chose.

Pin Coverage reports *whose job it is* — publishing a fee structure, assigning a batch and pressing re-pin are three different tasks with three different owners — and rolls students up onto their fee axes, so "BTECH / CSE / convener / Year 2 — 46 students, no structure published" is one task rather than 46 rows. Bulk pin is gated `finance:approve`, capped at 1000 per call, with no row-level throw. `previewPinYearAvailability` mirrors the writer's decision tree in the same order, asserted by test, so a dry run cannot promise an outcome the real run would not produce.

Also fixed: `resolve-permissions` only emitted read/create/update/delete, so the frontend could never detect an `approve` grant and any button needing it fell back to a role check that disagreed with the backend.

### 007 — Semester billing, payment, net AR (`1d1604c`)

| Task | Delivered |
|---|---|
| T1–T2 | `Payment.invoiceId`, `Invoice.isSemesterInstallment` as a positive discriminator (exam-fee invoices share `type: 'fee'`), plus a partial unique index with `$type: objectId` guards and an idempotent migration that refuses to build over existing violators |
| T3–T5 | Pin-driven invoice generation — annual splits floor+remainder so two semesters sum exactly, guarded by an academic-year match, under compensating rollback. Batch generation with dry-run; a throw on one student drops to `errors` and the batch continues |
| T6–T7 | Payment mutations locked: create strips `status`, update is a standalone `.strict()` `{remarks, transactionRef}` so PUT cannot touch amount/status/invoiceId. Delete became a **reversing** operation. Create now settles the invoice and decrements the account balance, so net AR moves live including on partials; overpayment is rejected before any write |
| T8 | `FINANCE_ENFORCE_FEE_GUARDIAN` gates only the guardian *requirement*; the existence + college-match check runs unconditionally, so the flag can never open a cross-tenant write |
| T9 | Dashboard AR sums `StudentFeeAccount.balance` (net) instead of gross unpaid-invoice totals |
| T10 | Test-only invariant verifier: `balance == totalDue − totalPaid − totalWaived + totalRefunded`, scoped to 007 students so the ~dozen other `StudentFeeAccount` writers don't false-flag |

**Three surfaces reported money from the wrong collection.** The finance hub "Pending", hub "Overdue Items" and the student Fee Structure panel all computed from `FeeLineItem`, which the pin → invoice billing path never writes. One showed a student holding a real ₹1,20,000 invoice as ₹0 across Billed/Paid/Waived/Balance. All three now read `StudentFeeAccount`; the hub and dashboard return an identical figure where they previously disagreed by lakhs.

### The Generate Bills console (007 C1–C3)

The first cut was two dropdowns and a dialog reading "Generate 12 bills?". It is now a table naming all twelve:

- One row per student — name · roll · programme/branch · year · ₹ · outcome. Non-billable rows stay visible and greyed with the reason as the badge and a Fix link into Pin Coverage, so a skip names a person rather than a count.
- Per-row checkbox, sticky footer with selected count and rupee total in en-IN grouping. Generate is disabled on empty selection, matching the new `.min(1)` validation — shut at both ends.
- Changing any filter clears the table and selection. *A table that outlived its filters is how you bill the cohort you stopped looking at.*
- Generate posts `studentIds` and nothing else: the backend re-applies `yearOfStudy` on top of an explicit list, which would silently drop ticked students.

`GET /finance/invoices/billing-history` answers "did we bill Semester 1?" by aggregating existing invoices rather than adding a `BillingRun` model — one would only describe runs made after it shipped, and would add a write to a money path to answer a question the invoices already answer. Registered above `GET /invoices/:id`, with a source-order test pinning it.

**Pin Coverage was answering a different question from billing.** It derived year-of-study with `resolveStudentYearOfStudy`, which hard-fails without a Batch, and ran that check *before* looking at the student's pins — so a batch-less student with a good pin was bucketed `year-unresolvable`. It was the only caller using the strict helper; billing, bulk-pin and import auto-pin all use `resolvePinYearForExistingStudent`. On the dev dataset: 0% (0 of 45) → 37.78% (17 of 45).

---

## 8. Engineering practices observed

### Specs before code, with load-bearing gates

Seven features ran the full SDD workflow. The gates are not ceremonial:

- **001** closed 6 CRITICAL + 9 HIGH before implementation.
- **004** Gate 2 returned 5 CRITICAL + 6 HIGH and materially narrowed v1 scope — only HOD and faculty, only on one runner.
- **007** Gate 2 data-layer returned FAIL (1C + 2H), reshaping the invoice discriminator, the balance invariant sign and the rollback strategy.

Artifacts stay in-repo under `.sdd/`, so any future change has a paper trail to the trade-offs.

### Regression tests verified red first

A recurring discipline: a fix is not proven until its test has been watched to fail against the old code. Where a test *cannot* be made to fail — a determinism guard whose in-memory Mongo returns insertion order anyway — the commit says so, so nobody deletes the sort on the strength of a passing test.

### Compensating rollback instead of transactions

The test harness is not a replica set, so `withTransaction` is unavailable. Multi-write paths register explicit undo actions, with deliberate per-operation ordering:

- **Parent links** register their compensation *before* the forward write, because `syncStudentParentLinks` issues two `updateMany` calls and a failure between them would leave a half-applied change uncompensated. Safe because the undo is a set reconciliation, not a delete.
- **Fee pins** register *after*, because the undo needs a real pin id. Rollback **archives** the pin rather than deleting it — a pin is an auditable financial event and `commitPin` has already written an audit entry referencing it.

### Deferrals recorded, not silently dropped

Phase B report runners return a typed sentinel converted to `status: 'unimplemented'`. The ERPNext bridge ships listeners that log and stop, so Phase B is a one-function edit. Import follow-ups were tracked in `docs/superpowers/specs/2026-07-28-student-bulk-import-followups.md` with a state table — one closed *unfixed*, with the reasoning written down.

---

## 9. Open items

Taken from the commit record, not inferred.

| Item | Area | Note |
|---|---|---|
| 3 Playwright specs quarantined (`test.fixme`) | Testing | 2 fee-pin flows in `import-fee-pin.spec.ts`, 1 history-reopen in `student-import.spec.ts`. Features covered by backend integration suites + manual QA; merged skipped rather than red |
| 007 T14 manual QA | Finance | The Generate Bills console and billing history have **no automated coverage at all** |
| Phone normalisation on the manual form | People | Fixed on the import door only. A phone typed manually may not match an imported one; closing it needs the Zod schema tightened, admissions checked, and a `Person.phone` backfill |
| `changes: []` at ~837 other call sites | Platform | Bulk import now populates field-level changes. Whether the rest should is a codebase-wide question left with the audit-trail owner |
| 9 Phase B report runners | Governance | Wave 1 implemented backlog-report and hostel-occupancy. The rest return a clean unimplemented status |
| ERPNext outbound calls | Integrations | Phase A by design — needs the deployment and secrets vault first |
| Counsellor / cluster-head NL access | Governance | Deferred to v1.5 pending backfill — `Inquiry.assignedTo` holds emails, not user ids |
| `faculty_documents.verify` fine-grained RBAC | People | Any holder of `people:update` can approve a credential. Splitting it needs changes across middleware, the permission registry and every gated call site |
| Faculty Profile phases D2–D5 | People | Exam duties, in-house awards, external committees, consultancy |
| Bulk-import Phase C entity types | Platform | Branches/Departments need ref-by-code resolution; Subjects need a model first; fee structures don't fit flat CSV |
