# Tech Debt Remediation Plan

**Source audit:** [`docs/tech-debt-audit-2026-04.md`](./tech-debt-audit-2026-04.md)
**Started:** 2026-04-18
**Last updated:** 2026-04-18

This document turns the audit findings into a trackable checklist with owners, status, links to PRs, and phase ordering. Update `Status`, `Owner`, `PR`, and `Notes` as work progresses.

**Status legend:** 🔴 Not started · 🟡 In progress · 🟢 Done · ⚪ Dropped (won't fix) · 🔵 Blocked

---

## Phase 0 — Emergency / this week

_Blockers for safe production operation. Should not wait on any other phase._

| # | Item | Priority | Status | Owner | PR | Notes |
|---|------|----------|--------|-------|-----|-------|
| P0-1 | Payment webhook HMAC signature verification | **40** | 🟡 In progress | srinikandula | *(pending)* | HMAC middleware + raw-body capture + tests (10/10 passing, typecheck clean). Ready to push. |
| P0-2 | `npm audit fix` (axios + follow-redirects moderate vulns) | 30 | 🔴 | — | — | One command + verify tests. Should land alongside P0-1. |
| P0-3 | Verify `admin-portal/tsconfig.json` matches strict base | 16 | 🔴 | — | — | 30-min check; align if drifted. |
| P0-4 | Remove duplicate `collegeId` index on 6 models | 10 | 🔴 | — | — | Sweep; silences Mongoose startup warning noise. |

**Exit criteria for Phase 0:**
- Webhook cannot be called without a valid HMAC-SHA256 signature
- `npm audit` reports 0 moderate/high vulnerabilities
- `admin-portal/` typecheck under strict mode is clean
- No "Duplicate schema index" warnings on test run

---

## Phase 1 — This sprint (next 2 weeks)

_High-impact, high-value. These are where most of the code risk lives._

| # | Item | Priority | Status | Owner | PR | Notes |
|---|------|----------|--------|-------|-----|-------|
| P1-1 | Zod validation audit — classify 169 missing-validate POST/PUT routes | 21 | 🔴 | — | — | Phase (a): classify body-taking vs body-less. Phase (b): add schemas to body-taking routes. Phase (c): CI lint rule requiring `validate()` on POST/PUT except an explicit whitelist. |
| P1-2 | Unit tests for `finance/service.ts` money-touching functions | 18 | 🔴 | — | — | Payments, refunds, fee line items, invoice reconciliation. Set CI coverage floor via `vitest --coverage` threshold (suggest 40% to start). |
| P1-3 | `as any` cleanup, money-code first | 18 | 🔴 | — | — | Inventory: `finance/controller.ts` (25), `finance/service.ts` (15), `finance/fee-lifecycle-service.ts` (29), `fee-reminder-service.ts`. Target: cut by 50% in this sprint. |

**Exit criteria for Phase 1:**
- All body-taking POST/PUT routes have Zod validation
- `finance/service.ts` has ≥ 40% unit coverage on money-touching functions
- `as any` count in `modules/finance/*` reduced by ≥ 50% (from ~90 to ≤ 45)

---

## Phase 2 — Next sprint

_Deepen test coverage into the second-most-risky domains._

| # | Item | Priority | Status | Owner | PR | Notes |
|---|------|----------|--------|-------|-----|-------|
| P2-1 | Unit tests for `academics/service.ts` scoring paths | 18 | 🔴 | — | — | GPA/CGPA compute, attendance compute, grade card generation, CIE computation. |
| P2-2 | Unit tests for `hr/service.ts` payroll/attendance paths | 16 | 🔴 | — | — | Attendance summary, payroll extract, disciplinary actions. |
| P2-3 | `as any` cleanup, academics + hr | 15 | 🔴 | — | — | `academics/controller.ts` (38), `academics/service.ts` (17), `hr/controller.ts` (33), `hr/service.ts` (27). |

**Exit criteria for Phase 2:**
- `academics/service.ts` + `hr/service.ts` each ≥ 40% unit coverage on critical paths
- `as any` count in those modules reduced by ≥ 50%

---

## Phase 3 — This quarter (rolling)

_Fill remaining modules. Less urgent but still valuable._

| # | Item | Priority | Status | Owner | PR | Notes |
|---|------|----------|--------|-------|-----|-------|
| P3-1 | Unit tests for remaining 10 modules at ≥ 40% coverage | 14 | 🔴 | — | — | welfare, placement, campus-ops, admissions, student-dev, compliance, governance, juvi, colleges, platform. Roll one per week. |
| P3-2 | `as any` cleanup remainder | 12 | 🔴 | — | — | ~350 remaining casts across placement, student-dev, welfare, campus-ops. |
| P3-3 | Project-wide `Types.ObjectId` sweep in model interfaces | 9 | 🔴 | — | — | ~244 models remaining after partial fix in PR #18. Codemod-friendly. Write the codemod, dry-run, apply. |
| P3-4 | Cross-module event bus ADR | 8 | 🔴 | — | — | Currently 32 TODOs reference a nonexistent event bus. ADR first — decide BullMQ pub/sub vs in-process EventEmitter vs external (Kafka/NATS). Then implement. |

**Exit criteria for Phase 3:**
- All 15 modules have ≥ 40% unit test coverage
- Total `as any` count < 100 (from 509)
- Cross-module event bus ADR merged and first 5 TODOs closed via real events

---

## Phase 4 — Backlog / later

_Worth doing but not yet justified by immediate risk._

| # | Item | Priority | Status | Owner | PR | Notes |
|---|------|----------|--------|-------|-----|-------|
| P4-1 | Full project `Types.ObjectId` sweep | 6 | 🔴 | — | — | Superset of P3-3 — covers sub-document fields beyond top-level `collegeId`. |
| P4-2 | SMTP delivery worker (consumes email-channel Notifications from PR #19) | — | 🔴 | — | — | Nodemailer + BullMQ worker + exponential backoff. Unblocks real email delivery for the allocation-flow feature. |
| P4-3 | Supertest integration tests for the 6 modules with 0 e2e coverage | — | 🔴 | — | — | colleges, compliance, governance, juvi, placement, student-dev. |
| P4-4 | Performance / query-plan audit | — | 🔴 | — | — | Separate audit: N+1 detection, slow-query log, index coverage beyond `collegeId`. Was explicitly out of scope for the 2026-04 audit. |
| P4-5 | Accessibility audit of admin-portal | — | 🔴 | — | — | WCAG 2.1 AA; `design:accessibility-review` skill is appropriate. |
| P4-6 | Migration safety audit | — | 🔴 | — | — | Verify all migrations are idempotent and have been applied; orphan-FK check. |

---

## Done (this audit cycle)

_Items completed from the audit findings — keep for provenance._

| # | Item | Done | PR | Completion notes |
|---|------|------|-----|------------------|
| — | `AuditLog.action` enum extended with lifecycle semantics (#3) | 2026-04-18 | #18 | Ships as part of the same PR as #7. |
| — | `Types.ObjectId` alignment for 3 allocation models (#7 partial) | 2026-04-18 | #18 | Full project sweep tracked as P3-3. |
| — | Email-channel notification stub (flag-gated) (#6) | 2026-04-18 | #19 | Data side ready; SMTP delivery is P4-2. |
| — | Year-rollover + refund-automation draft specs (#4, #5) | 2026-04-18 | #20 | Draft only; owner review required before Phase 2. |
| — | CampusConfig duplicate collegeId index | 2026-04-18 | #17 | 6 more models still have this pattern (see P0-4). |
| — | HostelAllocation interface consolidation | 2026-04-18 | #17 | Cleanup after parallel-session merge. |

---

## Tracking conventions

- **Status**: update cell when starting (`🟡`), finishing (`🟢`), or abandoning (`⚪`)
- **Owner**: GitHub handle or name; leave `—` until assigned
- **PR**: merge-status PR link; leave `—` until branched
- **Notes**: what was tried, what's in flight, why blocked
- **Priority** is frozen from the audit — re-audit quarterly to refresh

**When an item is done:**
1. Move its row from its phase table to the "Done" section
2. Link the merged PR
3. Add a completion note if anything unexpected came up

**When new debt is discovered:**
1. Add a row to the appropriate phase
2. Score it on the Impact/Risk/Effort matrix (see audit doc)
3. If it's P0 or P1-grade, flag it in the next standup

---

## Dependency graph

Some items unblock others — ordering matters:

```
P0-1 (webhook HMAC) ──┐
P0-2 (npm audit)    ──┼──► safe-to-ship state
P0-3 (tsconfig)     ──┤
P0-4 (dup indexes)  ──┘

P1-2 (finance tests) ──► P1-3 (finance any cleanup)     ──► P2-3 (acad/hr any cleanup) ──► P3-2 (remaining any)
                         (tests lock behavior before
                          refactor cleans types)

P3-4 (event bus ADR) ──► closes ~12 of the 32 TODOs
```

Key insight: **don't cleanup `as any` before tests exist for that code.** Types are the *scaffold*; tests are the *truth*. Cleaning up types without tests means refactor bugs ship silently.
