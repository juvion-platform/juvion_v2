# Tasks: Per-College LLM Spend Limits

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-28
**Total tasks:** 8 (7 Code, 1 Doc)

---

## Task DAG

```
Foundation (parallel):
  L1  College schema extension                ◄── (none)
       └─ aiSpendLimits.{weeklyInr, alertThresholdPct}; defaults; validation
  L2  LLMUsageSnapshot model + indexes        ◄── (none)
       └─ weekly per-college usage rows

Service:
  L3  Spend-limits service + 60s in-process cache  ◄── L1
       └─ assertWithinSpendLimit, getCurrentSpend, updateSpendLimits

Integration:
  L4  Pre-call gate wired into agent endpoints    ◄── L3
       └─ Inserted in finance-agent service.ts; budgetWarning shape

Cron:
  L5  Weekly summary cron worker                  ◄── L1, L2
       └─ Mon 06:00; aggregates AgentAction; writes LLMUsageSnapshot

Admin API + UI:
  L6  PATCH /colleges/:id/ai-spend-limits         ◄── L3
  L7  College Management UI section + dashboard banner  ◄── L6

Docs:
  L8  API reference + QA/deploy checklist         ◄── all
```

### Parallelism opportunities
- **L1 + L2** parallel
- **L5 + L6** parallel after L3 lands
- **L7** lands once L6 is done

### Front-loaded risks
- **L3 (service)** is the load-bearing piece — every LLM call goes through it. The 60s cache + cross-college isolation + DB-error fallback all need to be right.
- **L4 (integration)** must NOT cause regressions on cache-hit path (which doesn't pass through the gate). Easy to mis-wire if not careful.

---

## Task List

| # | Task | Type | Depends | Tests | Status |
|---|---|---|---|---:|---|
| L1 | College schema: aiSpendLimits nested field + validation | Code | — | 8+ | Done |
| L2 | LLMUsageSnapshot model + indexes | Code | — | 6+ | Done |
| L3 | spend-limits service + 60s in-process cache | Code | L1 | 14+ | Done |
| L4 | Pre-call gate integrated into agent endpoints | Code | L3 | 10+ | Done |
| L5 | Weekly summary cron worker (Mon 06:00) | Code | L1, L2 | 8+ | Done |
| L6 | PATCH /api/colleges/:id/ai-spend-limits + Zod | Code | L3 | 8+ (e2e) | Done |
| L7 | College Management UI section + dashboard budget banner | Code | L6 | build-clean | Pending |
| L8 | API reference + QA/deploy checklist | Doc | L4, L5, L6, L7 | — | Pending |

**Total:** ~54 backend tests + frontend build-clean.

---

## Task Details

---

### Task L1: College schema extension
**Type:** Code → captain-tdd · **Depends:** — · **Tests:** 8+

**Acceptance Criteria:**

Extend `backend/src/models/College.ts`:
```ts
aiSpendLimits: {
  weeklyInr: { type: Number, default: 0, min: 0 },
  alertThresholdPct: { type: Number, default: 80, min: 1, max: 100 },
}
```

- Both fields optional; missing → defaults
- Existing colleges read with the default values populated by Mongoose
- Validation: rejects negative `weeklyInr`; rejects `alertThresholdPct` outside `[1, 100]`
- Update the `ICollege` interface to match

**Tests (8+):**
- College creates with no aiSpendLimits → defaults `{ weeklyInr: 0, alertThresholdPct: 80 }`
- College creates with explicit `weeklyInr=500` → stored value
- Negative `weeklyInr` rejected
- `alertThresholdPct=0` rejected (min 1)
- `alertThresholdPct=101` rejected (max 100)
- Existing College document without the field reads with defaults populated
- Update `aiSpendLimits.weeklyInr` only → other field unchanged
- Update `aiSpendLimits.alertThresholdPct` only → other field unchanged

---

### Task L2: LLMUsageSnapshot model
**Type:** Code → captain-tdd · **Depends:** — · **Tests:** 6+

**Acceptance Criteria:**

New file `backend/src/models/juvi/LLMUsageSnapshot.ts` per plan §1.3.

Indexes: `{ collegeId: 1, weekStart: -1 }`

**Tests (6+):**
- Validates with all required fields
- Rejects when collegeId missing
- byType is a free-form Map (or Mixed); accepts arbitrary type keys
- Index present and unique not enforced (one row per (collegeId, weekStart) but no unique constraint — admin re-runs are upserts)
- `weekEnd > weekStart` invariant (validation)
- `totalCostInr >= 0` validation

---

### Task L3: spend-limits service + 60s in-process cache
**Type:** Code → captain-tdd · **Depends:** L1 · **Tests:** 14+

**Acceptance Criteria:**

New module `backend/src/modules/platform/spend-limits/`:

- `service.ts`:
  ```ts
  export async function assertWithinSpendLimit(collegeId: string): Promise<SpendCheckResult>;
  export async function getCurrentSpend(collegeId: string): Promise<{ spent: number; cachedUntil: Date }>;
  export async function updateSpendLimits(collegeId: string, updates: { weeklyInr?: number; alertThresholdPct?: number }, userId: string): Promise<{ aiSpendLimits, currentSpend }>;
  ```

- `cache.ts`: two TTL maps (collegeLimits, currentSpend), both 60s
  - Public: `getCachedLimits(collegeId)`, `getCachedSpend(collegeId)`, `invalidateLimits(collegeId)`, `invalidateSpend(collegeId)`
  - Default TTL from `LLM_BUDGET_CACHE_TTL_SECONDS` env (default 60)

- 7-day rolling spend aggregation: `AgentAction.aggregate([{ $match: { collegeId, createdAt: { $gte: now - 7d } } }, { $group: { _id: null, total: { $sum: '$costInr' } } }])`

**Tests (14+):**

assertWithinSpendLimit (8):
- weeklyInr=0 → bypass: returns `{ blocked: false, warning: false, spent: 0, limit: 0, pct: 0 }`
- spent < threshold → returns `warning: false, blocked: false`
- spent >= threshold but < 100% → returns `warning: true, blocked: false`
- spent >= 100% → throws `AppError(429, 'Weekly LLM budget exceeded')` with body details
- DB error → default-allow (returns no-warning state)
- Cache hit on second call within 60s → no DB query
- Cache invalidation: limit update → next call refetches
- Cache invalidation: 60s TTL → auto-refetch

cache (3):
- TTL expiry triggers refetch
- Manual invalidate clears entry
- Cross-college: invalidating A doesn't affect B

updateSpendLimits (3):
- Updates aiSpendLimits + invalidates cache
- Emits AuditLog entry with `from→to` change
- Returns updated limits + current spend

---

### Task L4: Pre-call gate integration
**Type:** Code → captain-tdd · **Depends:** L3 · **Tests:** 10+

**Acceptance Criteria:**

Integrate `assertWithinSpendLimit` into the LLM call site. Cleanest place: in `finance-agent/service.ts`, immediately before each `llmClient.complete(...)` or `llmClient.stream(...)` call.

The cache layer (`withCache` from finance-agent-summary-cache) bypasses the gate on cache hits — this MUST work because cache hits cost ₹0.

Add `budgetWarning` shape to API responses:
- forecast/situations/risk-scores responses gain optional `budgetWarning?: { spent, limit, pct, resetsAt }` field
- The 429 thrown from `assertWithinSpendLimit` propagates as a 429 HTTP response with structured body

**Tests (10+):**
- Cache hit bypasses gate (no spend check fired)
- Cache miss fires gate
- Gate at 79% → no warning, call proceeds
- Gate at 81% → warning flag set on response, call proceeds
- Gate at 100% → 429 thrown, no LLM call made
- 429 response body includes `{ spent, limit, resetsAt }`
- Spend computation reflects ALL agent endpoints (chat + forecast + risk + reminders)
- Streaming chat: gate fires at request entry; mid-stream not gated
- Default-allow on DB error (no false 429 due to flaky DB)
- College without `aiSpendLimits` set → defaults populated, weeklyInr=0 = bypass

---

### Task L5: Weekly summary cron worker
**Type:** Code → captain-tdd · **Depends:** L1, L2 · **Tests:** 8+

**Acceptance Criteria:**

New file `backend/src/workers/llm-usage-weekly.worker.ts`:

```ts
export const LLM_USAGE_WEEKLY_JOB_OPTS = { attempts: 3, backoff: ..., cronPattern: '0 6 * * 1' };
export async function llmUsageWeeklyCronWorker(job: Job): Promise<void>;
export function registerLLMUsageWeeklyCronWorker(): Queue;
```

Logic per plan §1.9:
- Iterates active colleges, bounded concurrency 10
- Per-college: aggregates last completed week's AgentAction by type
- Writes `LLMUsageSnapshot` row
- Logs structured `[llm-budget:weekly]` line per college
- Failure tolerance: per-college try/catch; other colleges continue

QueueManager update: add `LLM_USAGE_WEEKLY` entry.

**Tests (8+):**
- Cron iterates active colleges
- Per-college: snapshot written with correct totals
- byType keys correctly populated from AgentAction
- Limit at time of snapshot captured (not the current limit)
- Per-college error tolerance
- Skips inactive colleges
- Concurrency: max 10 colleges in flight at any time
- Cron job options exported correctly

---

### Task L6: PATCH endpoint — admin updates spend limits
**Type:** Code → captain-tdd · **Depends:** L3 · **Tests:** 8+ (e2e)

**Acceptance Criteria:**

```
PATCH /api/colleges/:id/ai-spend-limits
Permission: ('platform', 'update')
Rate-limit:  60/min/user
Body (Zod): { weeklyInr?: number ≥ 0; alertThresholdPct?: number ∈ [1, 100] }
```

Existing `colleges/routes.ts` + `colleges/controller.ts` get a new endpoint. Use existing super_admin + cross-college pattern.

Returns: `{ aiSpendLimits, currentSpend: { spent, limit, pct } }`.

**Tests (8+ e2e):**
- 200 happy: admin updates weeklyInr → DB reflects + AuditLog entry
- 200 happy: admin updates alertThresholdPct only
- 200 happy: admin updates both fields
- 400: invalid weeklyInr (negative)
- 400: invalid alertThresholdPct (101)
- 401: no auth
- 403: non-admin (e.g. finance officer)
- 404: college not found
- Cross-college: super_admin via x-college-id works; non-super_admin can't override

---

### Task L7: Admin UI section + dashboard banner
**Type:** Code → captain-tdd · **Depends:** L6 · **Tests:** build-clean (frontend)

**Acceptance Criteria:**

### 7a. Admin UI on College Management screen

Modify `admin-portal/src/pages/CollegeManagement.tsx` (or wherever the College config form is):
- New "AI Spend Limits" section at the bottom of the form
- Two number inputs: weekly budget (₹), alert threshold (%); helper text + defaults
- Below: usage bar (color-coded: green/amber/red)
- Save button POST→ `/api/colleges/:id/ai-spend-limits`
- Role gate: admin/super_admin only

### 7b. Dashboard budget banner

Modify `admin-portal/src/pages/finance/FeeDashboardPage.tsx`:
- New `BudgetBanner` component above page header
- Hydrated from `budgetWarning` field on the latest agent endpoint response
- Two states: warning (amber, ≥80%) and exceeded (red, ≥100%)
- 429 response → switch all AI surfaces to degraded mode (chat input disabled, forecast narrative hidden, situations hidden, risk-narrative tooltips show only deterministic factors)

### 7c. New service helper

`admin-portal/src/services/colleges.ts`:
- `updateAISpendLimits(collegeId, { weeklyInr, alertThresholdPct })`

**Verification:**
- `npx tsc -b admin-portal` → 0 errors
- `npm run build -w admin-portal` → clean
- Manual test: set limit to ₹1, hit dashboard → see 429 banner

---

### Task L8: API reference + QA checklist
**Type:** Doc → captain-spec direct · **Depends:** L4, L5, L6, L7

**Expected state:**

Create `backend/docs/api/llm-spend-limits.md`:
- Concepts (per-college rolling 7-day window, 80% warn / 100% block)
- College.aiSpendLimits field shape
- LLMUsageSnapshot collection
- Pre-call gate flow
- 1 new endpoint documented
- Frontend banner UX
- Weekly cron schedule
- Open questions (timezone, etc.)

Create `backend/docs/api/llm-spend-limits-qa-checklist.md`:
- §0 Prerequisites (L1-L7 done; tests green)
- §1 Schema verification (College.aiSpendLimits + LLMUsageSnapshot)
- §2 Default behavior: existing colleges without limit → no block (no regressions)
- §3 80% banner test (set tight limit, drive cost to 80%, verify banner)
- §4 100% block test (set tighter limit, exceed, verify 429 + degraded UI)
- §5 Admin override test (admin bumps limit → unblock within 60s)
- §6 Weekly cron verification (Mon 06:00; LLMUsageSnapshot written)
- §7 Rollback plan (set all limits to 0; cron is safe to disable)
- §8 Sign-off (Admin, SRE, Product)

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §Journey 1 Admin sets limit | L1, L6, L7a |
| §Journey 2 Officer at 80% | L3, L4, L7b |
| §Journey 3 Officer at 100% | L3, L4, L7b |
| §Journey 4 Admin bumps limit | L6, L7a |
| §Journey 5 Window rolls over | L3 (rolling 7d) |
| §Journey 6 Brand-new college | L1 (defaults) |
| §Journey 7 Weekly summary | L5 |
| §AC College schema | L1 |
| §AC Spend computation | L3 |
| §AC Pre-call gate | L3, L4 |
| §AC Admin endpoint | L6 |
| §AC Admin UI | L7a |
| §AC Frontend banner | L7b |
| §AC Weekly summary cron | L5 |
| §AC LLMUsageSnapshot collection | L2 |
| §AC Multi-tenancy | L1, L3, L6 |
| §AC Observability | L3, L4, L5 |

All 16+ ACs trace to ≥1 task.

---

## Changelog

- **2026-04-28** — Initial task list, sibling to `finance-agent-summary-cache`. 8 tasks, 2 parallel foundation starters (L1 + L2). Front-loaded risk: L3 (service + cache) — every LLM call goes through it.
