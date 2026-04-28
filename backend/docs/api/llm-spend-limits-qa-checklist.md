# Per-College LLM Spend Limits — QA & Deploy Checklist

**Complement:** `./llm-spend-limits.md` (API reference)

This checklist is the **operational handoff** for deploying the per-college LLM spend-limit feature to production. Every item must be verified by Admin + SRE + Product before declaring the feature live. Each line is a **verifiable boolean** — copy-paste the command or run the explicit assertion to confirm.

---

## 0. Prerequisites

- [ ] All 8 tasks marked `Done` in `.captain/specs/llm-spend-limits/tasks.md`:
  ```bash
  grep -c '| Done' .captain/specs/llm-spend-limits/tasks.md
  # expect: 8
  ```

- [ ] Backend unit suite green (≥ 885 individual tests passing — 856 baseline + 29 from L4/L5):
  ```bash
  npm test -w backend
  # expect: Test Files <N> passed; Tests >= 885 passed
  ```

- [ ] Backend e2e suite green (≥ 12 ai-spend-limits e2e tests passing):
  ```bash
  npm run test:e2e -w backend -- ai-spend-limits
  # expect: Test Files 1 passed (1); Tests 12 passed (12)
  ```

- [ ] Admin portal build clean:
  ```bash
  npm run build -w admin-portal
  # expect: '✓ built in <Ns>' with no errors
  ```

- [ ] Admin portal tests green (≥ 57 passing — 43 baseline + 14 from L7):
  ```bash
  npm test -w admin-portal
  # expect: Test Files 6 passed; Tests >= 57 passed
  ```

- [ ] TypeScript strict check returns 0 errors:
  ```bash
  npm run typecheck -w backend     # expect: 0 errors
  npx tsc -b admin-portal --noEmit # expect: exit 0, no output
  ```

- [ ] No open P0/P1 bugs against the `llm-spend-limits` feature.

---

## 1. Schema verification

### 1.1 College.aiSpendLimits

- [ ] All existing College documents read with defaults populated:
  ```js
  // mongo shell
  db.colleges.find({}, { name: 1, aiSpendLimits: 1 }).limit(5)
  // expect: every doc has aiSpendLimits = { weeklyInr: 0, alertThresholdPct: 80 } (no nulls)
  ```

- [ ] Schema validation rejects bad values:
  ```js
  db.colleges.update({ _id: <test-id> }, { $set: { 'aiSpendLimits.weeklyInr': -1 } })
  // expect: validation error (min: 0)
  db.colleges.update({ _id: <test-id> }, { $set: { 'aiSpendLimits.alertThresholdPct': 101 } })
  // expect: validation error (max: 100)
  ```

- [ ] No migration was required for existing colleges (defaults populate on read):
  ```bash
  grep -r 'aiSpendLimits' backend/src/migrations/ 2>/dev/null
  # expect: empty (no migration file)
  ```

### 1.2 LLMUsageSnapshot collection

- [ ] Index exists on `(collegeId, weekStart desc)`:
  ```js
  db.llmusagesnapshots.getIndexes()
  // expect: an index { collegeId: 1, weekStart: -1 } and the default _id index
  ```

- [ ] No unique constraint on the compound index (admin re-runs are upserts):
  ```js
  db.llmusagesnapshots.getIndexes().forEach(i => printjson({ name: i.name, unique: !!i.unique }))
  // expect: every index has unique: false (except _id_)
  ```

---

## 2. Default behavior — no regression for tenants without limits

- [ ] Pick a college with `aiSpendLimits.weeklyInr === 0`. Hit the dashboard:
  - [ ] Forecast renders with narrative — no banner shown
  - [ ] Risk scores render — no banner
  - [ ] Situations render — no banner
  - [ ] Chat works end-to-end

- [ ] Server log shows the gate fired but bypassed (no `[llm-budget:warn]` or `[llm-budget:blocked]`):
  ```bash
  tail -50 backend.log | grep '\[llm-budget'
  # expect: no warn / blocked lines for this college during the test
  ```

---

## 3. Soft-alert (80%) banner test

Use a low-traffic test college to drive coverage cleanly.

- [ ] Set the test college's limit to ₹10:
  ```bash
  curl -X PATCH https://<backend>/api/colleges/<test-id>/ai-spend-limits \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d '{ "weeklyInr": 10, "alertThresholdPct": 80 }'
  # expect: 200 with { aiSpendLimits, currentSpend }
  ```

- [ ] Drive cost to ~₹8 (e.g. 4 × forecast calls at ~₹2 each — exact numbers vary by model/prompt size):
  - [ ] Open the dashboard for the test college
  - [ ] Refresh forecast 4 times
  - [ ] Observe `currentSpend.pct` cross 80% in the College Management → AI Spend Limits panel

- [ ] **Banner check:**
  - [ ] Amber `<BudgetBanner />` appears above the page header
  - [ ] Copy reads "AI usage at NN% of weekly budget. ₹X remaining. Resets in <relative time>."
  - [ ] Banner can be dismissed (per-session); reappears on hard reload
  - [ ] Forecast still loads (call proceeds; warning, not block)

- [ ] Server log emits the warn line:
  ```bash
  tail -100 backend.log | grep '\[llm-budget:warn\]' | head -5
  # expect: lines with college=<test-id> spent=<n> pct=8X.X
  ```

---

## 4. Hard-block (100%) test + degraded mode

- [ ] Tighten the limit to ₹5 (existing spend already exceeds it):
  ```bash
  curl -X PATCH https://<backend>/api/colleges/<test-id>/ai-spend-limits \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d '{ "weeklyInr": 5 }'
  # expect: 200; currentSpend.pct now > 100
  ```

- [ ] Wait > 60s (cache TTL) OR confirm `updateSpendLimits` invalidated the cache (it does).

- [ ] Trigger a forecast refresh:
  - [ ] Dashboard receives 429 with `detail: { spent, limit, pct, resetsAt }`
  - [ ] **Red `<BudgetBanner />`** appears: "AI usage exceeded weekly budget. Contact admin to increase the limit."

- [ ] **Degraded mode UX:**
  - [ ] `<AICommandBar />` chat input → disabled
  - [ ] `<AIForecastBanner />` narrative → hidden (numeric projection still rendered)
  - [ ] `<SituationCards />` → hidden
  - [ ] `<RiskHoverPopover />` → factors visible; "Narrative unavailable" tooltip when hovering

- [ ] Server log:
  ```bash
  tail -100 backend.log | grep '\[llm-budget:blocked\]' | head -5
  # expect: lines with college=<test-id> pct=>100
  ```

- [ ] 429 body shape via curl:
  ```bash
  curl -i -X POST https://<backend>/api/juvi/finance-agent/forecast-narrative \
    -H "Authorization: Bearer $OFFICER_JWT" \
    -H "x-college-id: <test-id>" \
    -H "Content-Type: application/json" \
    -d '{ "monthAnchor": "2026-04-30T00:00:00Z" }'
  # expect: HTTP/1.1 429
  # expect body: { "error": "Weekly LLM budget exceeded", "detail": { "spent": <n>, "limit": 5, "pct": <p>, "resetsAt": "<iso>" } }
  ```

---

## 5. Admin override unblocks within 60s

- [ ] With the test college still at 100%+, bump the limit:
  ```bash
  curl -X PATCH https://<backend>/api/colleges/<test-id>/ai-spend-limits \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d '{ "weeklyInr": 1000 }'
  ```

- [ ] Within 5 seconds (cache invalidated by the PATCH itself), refresh the dashboard:
  - [ ] Forecast call succeeds (no 429)
  - [ ] Banner clears (no `budgetWarning` in the response — `pct` is now far below threshold)
  - [ ] Degraded mode lifts: chat input enabled, narratives visible, situations rendered

- [ ] AuditLog row exists for the bump:
  ```js
  db.auditlogs.find({
    entityType: 'College',
    entityId: '<test-id>',
    action: 'update',
    'changes.field': 'aiSpendLimits.weeklyInr'
  }).sort({ timestamp: -1 }).limit(1)
  // expect: changes[].oldValue == 5, changes[].newValue == 1000
  ```

---

## 6. Weekly cron verification

Cron runs Mondays at 06:00 UTC. To verify ad-hoc, trigger the worker manually OR wait for the next scheduled run.

- [ ] Cron is registered in BullMQ:
  ```bash
  # Inspect via your BullMQ dashboard or:
  redis-cli KEYS 'bull:platform:llm-usage-weekly:*' | head -5
  # expect: at least one key matching the pattern
  ```

- [ ] Cron pattern matches `0 6 * * 1`:
  ```bash
  grep -A2 'LLM_USAGE_WEEKLY_JOB_OPTS' backend/src/workers/llm-usage-weekly.worker.ts
  # expect: cronPattern: '0 6 * * 1' (or LLM_BUDGET_WEEKLY_SUMMARY_CRON env override)
  ```

- [ ] After a run, verify a snapshot row was written for each active college:
  ```js
  db.llmusagesnapshots.find({}).sort({ createdAt: -1 }).limit(5)
  // expect: one row per active college for the just-completed week, with byType + totalCostInr + totalCalls + limitAtTime + alertThresholdAtTime populated
  ```

- [ ] Inactive colleges were skipped:
  ```js
  // For an inactive test college:
  db.llmusagesnapshots.find({ collegeId: <inactive-id> }).count()
  // expect: 0 (no row written)
  ```

- [ ] Per-college error tolerance was exercised at least once (check logs):
  ```bash
  tail -500 backend.log | grep '\[llm-budget:weekly\]' | wc -l
  # expect: count == active-college count (one log line per college, even on failure)
  ```

---

## 7. Rollback plan

If the gate misbehaves in production:

1. **Disable globally** by setting all colleges' limits to 0:
   ```js
   db.colleges.updateMany({}, { $set: { 'aiSpendLimits.weeklyInr': 0 } })
   // verify: db.colleges.find({}, { 'aiSpendLimits.weeklyInr': 1 }) — every doc shows weeklyInr: 0
   ```
   Within 60s (cache TTL), every gate call bypasses. No backend restart required.

2. **Disable the cron** by removing the BullMQ registration. The cron is non-critical (snapshots are nice-to-have, not load-bearing). Worker file: `backend/src/workers/llm-usage-weekly.worker.ts`.

3. **Revert the integration commit** if a hard regression (`b151129`):
   ```bash
   git revert b151129
   git revert c95fe74   # if you also want the foundation slice gone
   ```
   Reverting the foundation will also remove `aiSpendLimits` from the College schema; existing docs keep the field but no code reads it.

4. **Rollback safety:**
   - The gate is the only new write path (other than the snapshot collection). Disabling it cannot corrupt existing data.
   - `LLMUsageSnapshot` rows are append-only; safe to leave on a rollback.
   - `College.aiSpendLimits` is additive; existing reads of `College` don't depend on it.

---

## 8. Sign-off

- [ ] **Admin** (defines the per-college budget policy):
  - [ ] Confirmed dev test colleges have known-good limits
  - [ ] Communicated rollout to college operators
  - [ ] Confirmed escalation path when an officer hits a 429
  - **Signed:** ___________________________ Date: ____________

- [ ] **SRE** (operational ownership):
  - [ ] Cron monitoring wired (alert if Monday run is missed)
  - [ ] Log routing for `[llm-budget:*]` lines confirmed in the log aggregator
  - [ ] Rollback steps tested in staging
  - **Signed:** ___________________________ Date: ____________

- [ ] **Product** (UX + customer-facing communication):
  - [ ] Banner copy approved
  - [ ] Degraded-mode UX validated against the AI Command Bar / Forecast / Situations / Risk surfaces
  - [ ] Customer-facing announcement scheduled
  - **Signed:** ___________________________ Date: ____________

---

## Appendix — Useful one-liners

**See current spend for a college:**
```bash
mongosh juvion_v2 --eval 'db.agentactions.aggregate([
  { $match: { collegeId: ObjectId("<id>"), createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } } },
  { $group: { _id: null, total: { $sum: "$costInr" }, calls: { $sum: 1 } } }
])'
```

**Drive a small synthetic spend for testing:**
Run the baseline measurement script in interactive mode to see current totals:
```bash
npx ts-node backend/src/scripts/measure-llm-baseline.ts --days=7
# CSV mode for spreadsheet capture:
npx ts-node backend/src/scripts/measure-llm-baseline.ts --days=7 --csv
```

**Inspect the AuditLog trail for spend-limit changes on a college:**
```js
db.auditlogs.find({
  entityType: 'College',
  entityId: '<college-id>',
  'changes.field': /^aiSpendLimits\./
}).sort({ timestamp: -1 })
```

**Force-clear the in-process cache (e.g. after manual DB edits):**
The cache is in-process. Restart the backend pod / process to clear, OR wait 60s for TTL.
