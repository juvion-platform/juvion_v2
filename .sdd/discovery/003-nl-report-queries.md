# Discovery — Natural-Language Report Queries (Gap 4 Differentiation)
**Feature:** 003-nl-report-queries
**Date:** 2026-05-14

## What already exists

| Surface | State | File |
|---|---|---|
| `ReportDefinition` schema — 12 reports registered | **2 implemented, 10 Phase B stubs** | `backend/src/modules/governance/report-registry.ts:72–91` |
| Report runner architecture (Mongo aggregation + `Promise.all` for multi-source) | Working for the 2 implemented | `report-registry.ts:124–450` |
| `ReportRun` persistence model with status machine (`queued`/`running`/`success`/`failed`/`unimplemented`) | Working | `report-service.ts:49–102`, `models/governance/ReportRun.ts` |
| HTTP API — `GET /reports/definitions`, `POST /reports/run/:code`, `GET /reports/history` | Working, `authorize('governance', 'read')` (route-level only) | `report-controller.ts:13–49`, `routes.ts:59–63` |
| Frontend: param form + result table, category-based styling | Working | `admin-portal/src/pages/governance/ReportsPage.tsx` |

### Implemented reports (2 of 12)

- `admissions-funnel` — Mongo aggregation over Inquiry/Applicant/Admission
- `lead-source-performance` — Mongo aggregation over Inquiry

### Phase B stubs (10 of 12)

`defaulter-list`, `collection-summary`, `attendance-below-threshold`, `backlog-report`, `faculty-workload`, `hostel-occupancy`, `transport-utilization`, `placement-pipeline`, `library-outstanding`, `student-roster-snapshot` (partial — also has a working runner per the discovery)

## Reusable LLM infrastructure (don't reinvent)

- `backend/src/shared/llm/pii.ts` — masker, especially relevant if NL surfaces rows with student PII
- `backend/src/modules/juvi/finance-agent/llm-client.ts` — Juvi LLM client
- `backend/src/modules/admissions/lead-scoring/llm-scorer.ts` — strict JSON parse + abort guard pattern
- `backend/src/modules/admissions/lead-scoring/prompt.ts` — system + user prompt builder + `PROMPT_VERSION`
- `backend/src/modules/admissions/lead-scoring/cap-guard.ts` — per-college daily cap
- `backend/src/shared/audit.ts` — audit log
- `backend/src/shared/rbac/apply-scope.ts` — **critical** — existing scope-constraint injection (department/self filtering). Must be honored by any NL-generated query.

## Report catalog — what NL could query

| Report | Source | Aggregation? | RBAC sensitivity |
|---|---|---|---|
| **admissions-funnel** | Inquiry/Applicant/Admission | Yes ($match, $group) | Medium (summary only) |
| **lead-source-performance** | Inquiry | Yes | Medium |
| **student-roster-snapshot** | Student | Yes | Medium (summary by programme/branch) |
| defaulter-list ⚠️ | FeeAccount/FinancialHold | _stub_ | **HIGH** — PII (name + amounts due) |
| collection-summary ⚠️ | Receipt/Payment | _stub_ | High — payment trails |
| attendance-below-threshold | AttendanceRecord | _stub_ | Medium — student names |
| backlog-report | Backlog | _stub_ | Medium |
| faculty-workload | CourseOffering | _stub_ | Low |
| hostel-occupancy | HostelAllocation | _stub_ | Low |
| transport-utilization | TransportRoute | _stub_ | Low |
| placement-pipeline | PlacementDrive | _stub_ | Low |
| library-outstanding ⚠️ | BookCheckout | _stub_ | **HIGH** — borrower + book titles |

## Risk profile — RBAC under NL

**Current enforcement is route-level only.** `authorize('governance', 'read')` (routes.ts:59) gates whether you can run any report, but the runners themselves filter only by `collegeId`. They do not apply per-role row-level scope (HOD: own department; student/parent: own row).

This works today because every report is hand-written by admins. It fails the moment NL generates a query — a department-head shouldn't be able to ask "show me all students in every department" and get an answer. **Row-level RBAC enforcement at the query layer is a prerequisite for safe NL** (or NL must be scoped to roles where route-level is already sufficient — i.e., admin + super_admin only).

## Pre-existing bug — `report-registry.ts:183`

`$match: { collegeId, ... }` — `collegeId` is a string here but Mongoose's aggregate stage expects an `ObjectId` for matches against a refs field. The `aggregate-collegeid-pattern` regression-guard test fails on this. Fix is one line: `new mongoose.Types.ObjectId(collegeId)`. **Decision: fix in 003, or in a separate small bug-fix PR first?**

## Gaps — what 003 must build

1. **NL → report-params translator** — LLM service that takes user intent → picks a report → fills in params + optional extra `$match` filters.
2. **Query safety validator** — enforce: `collegeId` always present, role-scope constraints applied, no PII-heavy reports surfaced to unauthorized roles.
3. **Failure / refusal strategy** — when LLM output is malformed or unsafe.
4. **Session history** — store NL queries (intent → chosen report → params → result handle) for audit + learning.
5. **Per-college NL cap** — shared with lead-scoring or separate?
6. **Frontend NL input** — "Ask a question" textarea alongside the existing report picker.

## Open questions to resolve in the spec

1. **Scope of reports exposed to NL** — only the 2–3 implemented? Need to implement more runners first? Or implement just enough stubs to make NL coverage meaningful?
2. **Failure mode for unsafe/malformed queries** — refuse with explanation? generate-and-validate-then-RBAC-filter silently? show preview for human approval (recommended for v1)?
3. **PII-sensitive reports** — exclude `defaulter-list`, `library-outstanding`, `collection-summary` from NL entirely, or gate them behind higher RBAC?
4. **Saved queries** — name/tag NL queries for reuse, or session-only?
5. **Aggregation only vs raw row lists** — today all reports aggregate. Should NL also support "list all students in CSE"? Pagination then matters.
6. **Report discovery in the prompt** — give the LLM context on all 12 report defs (big prompt) or a two-pass (narrow taxonomy then pick)?
7. **Pre-existing bug** at `report-registry.ts:183` — fix in this PR or separate?

## Key files

1. `backend/src/modules/governance/report-registry.ts` — 479 lines, 12 defs + 2 runners
2. `backend/src/modules/governance/report-service.ts` — run orchestration + persistence
3. `backend/src/modules/governance/report-controller.ts`
4. `backend/src/modules/governance/routes.ts`
5. `backend/src/models/governance/ReportRun.ts`
6. `admin-portal/src/pages/governance/ReportsPage.tsx`
7. `admin-portal/src/services/governance.ts`
8. `backend/src/shared/llm/pii.ts`
9. `backend/src/modules/juvi/finance-agent/llm-client.ts`
10. `backend/src/modules/admissions/lead-scoring/llm-scorer.ts`
11. `backend/src/shared/rbac/apply-scope.ts` — **critical for safe NL**
12. `backend/src/__tests__/regression-guards/aggregate-collegeid-pattern.test.ts`
