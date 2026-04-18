# Juvion v2 — Tech Debt & Gap Audit

**Date:** 2026-04-18
**Scope:** Backend (`backend/src/`) + admin-portal + captain specs
**Method:** `engineering:tech-debt` skill — systematic scan across 6 debt categories × focus areas (multi-tenancy, RBAC/security, test coverage, type safety, audit logging, dead code, convention drift)
**Owner:** Review and triage — no fixes applied in this pass

---

## Executive summary

The codebase is **large** (247 data models, 15 modules, ~80k LOC of module code, 9.6k LOC of model code) and has **strong fundamentals on data integrity and auth basics**, but carries **material test-coverage and type-safety debt** and harbors **at least one critical security bug** in the payment-webhook path.

| Category | Debt level | Notes |
|---|---|---|
| Multi-tenancy | ✅ Strong | 100% of data models have `collegeId: required` |
| Authentication | ✅ Strong | JWT secret prod-guard, password properly `.select('-password')`'d |
| Audit logging | ✅ Strong | Sampled services consistently call `createAuditLog` |
| Authorization (RBAC) | ⚠️ Moderate | 3+ endpoints un-`authorize`d; webhook entirely unauthenticated |
| Input validation | ⚠️ Moderate | 169 POST/PUT routes with no Zod validation |
| Type safety | ⚠️ Moderate | **509** `as any` casts across 50 files |
| Test coverage | 🔴 Weak | 32 test files total for 80k LOC; **10 of 15 modules have 0 unit tests** |
| Webhook security | 🔴 **Critical** | Payment gateway webhook trusts caller-supplied data |
| Dependency health | 🟡 Minor | 2 moderate vulnerabilities (both fix-available) |
| Documentation | 🟡 Minor | 32 TODO markers mostly flagging cross-module integration gaps |

---

## Prioritized findings

Scored per `engineering:tech-debt` framework:
**Priority = (Impact + Risk) × (6 − Effort)** — higher = tackle first.

### P0 — Fix this week

#### 1. Payment-gateway webhook has no signature verification
**File:** `backend/src/modules/finance/service.ts:1755`
**What:** `processGatewayWebhook` sets `gatewayLog.signatureVerified = true;` unconditionally. The webhook endpoint (`POST /api/finance/payments/gateway-webhook`) has **no authentication middleware and no HMAC verification**. Any unauthenticated caller on the internet can POST a fake payment confirmation and the system will mark the invoice paid, credit the student's fee account, and generate a Receipt.

**Impact:** 5 · **Risk:** 5 · **Effort:** 2 → **Priority: 40**

**Business justification:** Direct financial fraud vector. One curl command from a tech-savvy student could zero out their own fee dues. The fact that it's live in production (or will be on first deploy) makes this a critical blocker, not a debt item.

**Fix shape:**
1. Add HMAC signature header verification in the route handler, with the secret in `CampusConfig.paymentGateway.webhookSecret`
2. Reject requests with bad/missing signature (401)
3. Only set `signatureVerified = true` after the HMAC check passes
4. Add a test that verifies unsigned requests are rejected

---

### P1 — Fix this sprint

#### 2. Test coverage catastrophically thin for ERP scale
**Scope:** Backend-wide
**What:** 32 test files total across 80,000 LOC of module code. **10 of 15 modules have zero unit tests**:

```
  academics: unit=0, e2e=1       ← 5,391-line service file
  admissions: unit=0, e2e=1
  auth: unit=0, e2e=1
  campus-ops: unit=3, e2e=0
  colleges: unit=0, e2e=0
  compliance: unit=0, e2e=0
  finance: unit=0, e2e=1         ← 4,509-line service file
  governance: unit=0, e2e=0
  hr: unit=0, e2e=1
  juvi: unit=0, e2e=0
  people: unit=0, e2e=1
  placement: unit=0, e2e=0
  platform: unit=1, e2e=1
  student-dev: unit=0, e2e=0
  welfare: unit=0, e2e=1
```

Largest untested service files:
- `academics/service.ts` — 5,391 LOC
- `finance/service.ts` — 4,509 LOC
- `finance/fee-lifecycle-service.ts` — 2,163 LOC
- `campus-ops/hostel-service.ts` — 1,861 LOC (covered partially by optional-allotment tests)
- `hr/service.ts` — 1,521 LOC

**Impact:** 5 · **Risk:** 4 · **Effort:** 4 → **Priority: 18**

**Business justification:** Any non-trivial refactor is high-risk. Regressions ship silently — e2e tests catch HTTP-contract smoke but miss branch logic. In finance/academics, a silent bug could mean wrong GPA calculations or wrong fee amounts.

**Fix shape:** Not "test everything at once" — phased:
- **Phase 1 (1 sprint):** add unit tests for `finance/service.ts` money-touching functions (payments, refunds, fee line items). Set a coverage floor via `vitest --coverage` threshold in CI.
- **Phase 2 (1 sprint):** academics — attendance compute, GPA/CGPA, grade card generation.
- **Phase 3:** fill remaining modules to ≥40% per-module coverage.

---

#### 3. 509 `as any` casts across 50 files
**Scope:** Backend-wide
**What:** Heavy concentration in the larger services:

```
  modules/academics/controller.ts: 38 casts
  modules/hr/controller.ts: 33
  modules/academics/service.ts: 17
  modules/finance/fee-lifecycle-service.ts: 29
  modules/hr/service.ts: 27
  modules/placement/controller.ts: 25
  modules/finance/controller.ts: 25
  modules/student-dev/controller.ts: 28
  ...
```

**Impact:** 3 · **Risk:** 3 · **Effort:** 3 → **Priority: 18**

**Business justification:** `as any` is a black hole for TypeScript's safety net — it silently hides downstream type errors, so refactors feel safe but aren't. Concentrated in money-handling code (finance, fee-lifecycle) where type mismatches have real consequences.

**Fix shape:**
- **Inventory first:** grep each `as any` and classify — "model type friction" (Schema.Types vs Types.ObjectId), "Express req/body type escape", "legitimate unknown input from external API", "laziness"
- Tackle "laziness" bucket first (typically 40-60% of cases, lowest effort)
- Model type friction addressed at source (`Types.ObjectId` in interfaces — partially started in feat/audit-log-semantic-actions PR)

---

#### 4. 169 POST/PUT routes without Zod validation
**Scope:** Backend-wide
**What:** `router.post(...)` and `router.put(...)` calls with no `validate(schema)` middleware. A significant portion are legitimately body-less (e.g. `/:id/publish`, `/compute-cie`, `/:id/approve-vacate` with empty body), but spot-check reveals many that DO take body payloads:

```
  modules/campus-ops/routes.ts:359: POST /hostel/clearance/:studentId
  modules/academics/routes.ts:218: POST /attendance-records/bulk
  modules/academics/routes.ts:234: POST /internal-marks/bulk
```

**Impact:** 3 · **Risk:** 4 · **Effort:** 3 → **Priority: 21**

**Business justification:** Unvalidated input reaches service layer as `any`, which combined with #3 means shapes drift silently. Malformed payloads either 500 or (worse) corrupt data. Low-effort per-route fix; high cumulative value.

**Fix shape:**
- Audit the 169 against "takes body" vs "body-less admin action"
- For body-taking routes without a schema: add one
- Enforce via a lint rule / CI check that POST/PUT always has `validate(...)` (whitelist body-less paths explicitly)

---

### P2 — Fix this quarter

#### 5. Dependency vulnerabilities (2 moderate)
**What:**
- `axios <=1.8.1` — SSRF via NO_PROXY hostname normalization bypass (GHSA-3p68-rc4w-qgx5); cloud metadata exfiltration via header injection (GHSA-fvcv-3m26-pcqx)
- `follow-redirects <=1.15.11` — leaks custom auth headers on cross-domain redirects (GHSA-r4q5-vmmm-2653)

**Impact:** 3 · **Risk:** 3 · **Effort:** 1 → **Priority: 30**

**Business justification:** Both fix-available via `npm audit fix`. Literal 30-second remediation. Upward priority because effort is trivial.

**Fix shape:** `npm audit fix` in CI + verify tests pass. If a major-version bump is needed, eyeball breaking changes.

---

#### 6. Duplicate `collegeId` index warnings (6 models)
**What:** Models declare `collegeId: { ..., index: true }` at field level AND `schema.index({ collegeId: 1 }, ...)` separately. Mongoose logs "Duplicate schema index" on every startup/test run. Only 6 models are affected after recent cleanup (PR #17 fixed CampusConfig).

**Impact:** 1 · **Risk:** 1 · **Effort:** 1 → **Priority: 10**

**Business justification:** Log noise, no functional impact. Easy sweep once someone has a free hour.

**Fix shape:** Grep the 6 files, drop field-level `index: true` where a compound index already covers it.

---

#### 7. Admin-portal: pre-existing TypeScript strict issues
**What:** Earlier passes showed ~20 TS errors in `App.tsx`, `layouts/DashboardLayout.tsx`, `stores/authStore.ts`, `CollegeSelector.tsx` etc. — all "parameter implicitly has 'any' type." Current typecheck returns 0 errors, meaning either fixes landed or the project uses lax TSConfig for the frontend.

**Impact:** 2 · **Risk:** 2 · **Effort:** 2 → **Priority: 16**

**Business justification:** The admin-portal handles sensitive data and JWT handling. Strict TS catches real bugs. Worth confirming `admin-portal/tsconfig.json` has `strict: true` and `noImplicitAny: true`.

**Fix shape:** Read `admin-portal/tsconfig.json`, compare to `tsconfig.base.json`, align if drifted.

---

#### 8. 32 TODO markers flagging unfinished cross-module integrations
**Locations concentrated in:**
- `campus-ops/hostel-service.ts` (10 TODOs) — gender filtering, fee emit, welfare signals, parent notifications
- `campus-ops/maintenance-crossmodule-service.ts` (4)
- `campus-ops/library-service.ts` (4) — fee emit, reservation notifications

**What's consistent across TODOs:** "emit X to M04 via BullMQ" (fee events), "notify via M12.2" (platform notification), "trigger readiness recompute when cross-module event bus is available."

**Impact:** 2 · **Risk:** 2 · **Effort:** 4 → **Priority: 8** (low if accepted as known gaps)

**Business justification:** These aren't defects — they're explicit "feature gaps, not yet wired." The concerning one is that there's apparently no cross-module event bus, which forces modules to either import each other directly (coupling) or leave these TODOs open (integration gaps). Worth a separate architecture discussion.

**Fix shape:** Separate ADR on cross-module event bus (BullMQ-based pub/sub or similar). Close TODOs as features are actually needed.

---

### P3 — Nice to have

#### 9. `Schema.Types.ObjectId` in model interfaces (project-wide)
**What:** 247 models; most use `Schema.Types.ObjectId` in their TS interfaces where `Types.ObjectId` would be more correct. Not a bug — TypeScript is lenient — but it causes friction for helper functions that accept loaded documents (we hit this in the optional-allotment feature).

**Impact:** 2 · **Risk:** 1 · **Effort:** 3 → **Priority: 9**

Partial fix shipped in `feat/audit-log-semantic-actions` PR for 3 allocation models. A sweep across the remaining ~244 models is mechanical; an AST-aware codemod would make it trivial.

---

#### 10. No skipped/TODO tests (strong)
**What:** Grep for `.skip` / `.todo` in test files → none found. 100% of authored tests run.

**Non-issue — flagged as a strength.**

---

## Aggregate scorecard

| Item | Priority | Est. effort | Suggested phase |
|---|---|---|---|
| 1. Payment webhook HMAC verification | **40** | 0.5 day | **Now / this week** |
| 5. `npm audit fix` | 30 | 0.25 day | This week |
| 4. Zod validate coverage | 21 | 1 sprint | Next sprint |
| 2. Test coverage buildout | 18 | 3+ sprints | Rolling, phased |
| 3. `as any` cleanup (money code first) | 18 | 2 sprints | Rolling |
| 7. Admin-portal TS strict verification | 16 | 0.5 day | This sprint |
| 6. Duplicate-index sweep | 10 | 1 hour | Cleanup Friday |
| 9. `Types.ObjectId` sweep | 9 | 1 day (with codemod) | Backlog |
| 8. Cross-module event bus ADR | 8 | 1 day (just the spec) | Backlog |

---

## Remediation plan (phased)

### Week 1 — emergency + quick wins
- [ ] P0 #1: Payment webhook HMAC verification — **blocker for production**
- [ ] P2 #5: `npm audit fix`
- [ ] P2 #7: Verify admin-portal TSConfig matches strict base
- [ ] P2 #6: Duplicate-index sweep across 6 models

### Sprint 1
- [ ] P1 #4: Zod validation audit — classify the 169 missing-validate routes, fix body-taking ones
- [ ] P1 #2 Phase 1: Unit tests for `finance/service.ts` money paths (payments, refunds, fee line items). Set CI coverage floor.

### Sprint 2
- [ ] P1 #2 Phase 2: Unit tests for `academics/service.ts` scoring paths (GPA/CGPA, attendance compute).
- [ ] P1 #3 Phase 1: `as any` cleanup in money-handling code.

### Sprint 3+
- [ ] Phase 3 test coverage rollout across remaining modules
- [ ] Continue `as any` cleanup by category (model-type friction, Express escapes, external API inputs)

### Backlog
- [ ] Project-wide `Types.ObjectId` sweep (codemod-friendly)
- [ ] Cross-module event bus ADR and implementation
- [ ] SMTP delivery worker (complements the email-notification stub already in PR #19)

---

## What this audit did NOT check (gaps in the gap analysis)

Called out honestly so the next audit pass can cover them:

- **Performance**: no query-plan inspection, no N+1 detection, no slow-query log analysis
- **Indexes beyond `collegeId`**: didn't check if frequently-queried fields (studentId, status, academicYearId) are properly indexed per model
- **Migration safety**: didn't audit whether existing migrations are idempotent and whether they've all been applied
- **Monitoring / observability**: no check for structured logging consistency, metrics emission, or alert coverage
- **API contract stability**: no check for breaking changes in request/response shapes across versions
- **Frontend bundle size / code splitting**: didn't look at admin-portal Vite output
- **Accessibility**: no a11y audit of admin-portal
- **Data model sanity**: didn't check for orphaned foreign keys or cascade-delete gaps
- **E2E coverage on critical flows**: e2e files exist for 8 of 15 modules but I didn't verify they hit the key user journeys
- **Specific RBAC policy conflicts**: didn't exhaustively verify that every (role, module, action) tuple resolves deterministically

Each of these could be its own audit — flagging rather than fabricating.
