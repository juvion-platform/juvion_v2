# Fee Collection Dashboard — AI-Native Upgrade — QA & Deploy Checklist

**Complement:** `./fee-analytics-ai-native.md` (API reference)

This checklist is the **operational handoff** for deploying the AI-native finance agent to production. Every item must be verified by Finance + SRE + Security before declaring the feature live. Each line is a **verifiable boolean** — copy-paste the command or run the explicit assertion to confirm.

---

## 0. Prerequisites

- [ ] All 11 tasks marked `Done` in `.captain/specs/fee-analytics-ai-native/tasks.md`:
  ```
  grep -c '| Done' .captain/specs/fee-analytics-ai-native/tasks.md
  # expect a count >= 11 (one per task A1..A11)
  ```

- [ ] Backend unit suite green: at least 668 individual tests passing (the +20 from A4 should land cleanly):
  ```
  npm test -w backend
  # expect: Test Files <N> passed; Tests >=668 passed
  ```

- [ ] Backend e2e suite green: at least 36 finance-agent-http e2e tests passing:
  ```
  npm run test:e2e -w backend -- finance-agent-http
  # expect: Test Files 1 passed (1); Tests 36 passed (36)
  ```

- [ ] Admin portal builds clean:
  ```
  npm run build -w admin-portal
  # expect: '✓ built in <Ns>' with no errors
  ```

- [ ] TypeScript strict check returns 0 errors:
  ```
  npm run typecheck -w backend
  # expect: 0 errors
  cd admin-portal && npx tsc -b
  # expect: exit 0, no output
  ```

- [ ] No open P0/P1 bugs against this feature.

---

## 1. Environment configuration

- [ ] **`LLM_PROVIDER` is set to a valid value** (`claude` or `openai`) in the backend environment:
  ```
  echo "$LLM_PROVIDER"
  # expect: 'claude' or 'openai' — anything else falls back to claude
  ```

- [ ] **API key for the active provider is populated:**
  ```
  # If LLM_PROVIDER=claude:
  test -n "$ANTHROPIC_API_KEY" && echo OK || echo MISSING
  # If LLM_PROVIDER=openai:
  test -n "$OPENAI_API_KEY" && echo OK || echo MISSING
  ```

- [ ] **(Optional) `LLM_MODEL` env var unset OR matches a valid provider model:**
  ```
  # Acceptable: '' (defaults to claude-sonnet-4-5 / gpt-4o-mini)
  # Or: 'claude-sonnet-4-5', 'gpt-4o-mini', or any model name accepted by the SDK
  ```

- [ ] **(Optional) `LLM_RATE_LIMIT_PER_MINUTE` unset** — the shipped feature uses a single shared 60/min/user limit (per [Known limitations](#10-known-limitations) item 1); this env var is reserved for future per-endpoint shaping.

- [ ] **(Optional) `LLM_INR_RATE` defaults to 85.0** — set explicitly only if the deployment needs a different USD-to-INR conversion rate:
  ```
  echo "${LLM_INR_RATE:-85.0}"
  ```

- [ ] **Backend boots cleanly with `LLM_PROVIDER=claude` and a valid `ANTHROPIC_API_KEY`:**
  ```
  LLM_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-... npm run dev:backend &
  curl -fsS http://localhost:3003/health
  # expect: 200 OK
  ```

- [ ] **Backend boots cleanly with `LLM_PROVIDER=openai` and a valid `OPENAI_API_KEY`** (repeat the above with the openai env vars).

---

## 2. Schema + indexes

- [ ] **`agentconversations` collection exists** with the expected compound index:
  ```
  db.agentconversations.getIndexes()
  # expect an index whose key is { collegeId: 1, userId: 1, updatedAt: -1 }
  ```

- [ ] **`agentactions` collection exists** with both compound indexes:
  ```
  db.agentactions.getIndexes()
  # expect:
  #   { collegeId: 1, createdAt: -1 }
  #   { userId: 1, createdAt: -1 }
  ```

- [ ] **`situationdismissals` collection exists** with the expected compound index:
  ```
  db.situationdismissals.getIndexes()
  # expect: { collegeId: 1, userId: 1, snoozedUntil: 1 }
  ```

- [ ] **All three collections accept their respective insert shapes** — boot the backend and run one query per endpoint that exercises the audit write path (see §3).

- [ ] **No existing `AgentConversation` / `AgentAction` / `SituationDismissal` schema validation errors** in startup logs:
  ```
  grep -i 'SchemaTypeOptionsError\|enum.*mismatch' <backend-log>
  # expect: no matches
  ```

---

## 3. Provider verification (run for each provider)

### 3a. Claude

- [ ] Configure `LLM_PROVIDER=claude` and a valid `ANTHROPIC_API_KEY`; restart backend.

- [ ] Hit `/forecast-narrative` with a valid `monthAnchor`:
  ```
  curl -sS -X POST http://localhost:3003/api/juvi/finance-agent/forecast-narrative \
    -H "Authorization: Bearer $JWT" \
    -H "x-college-id: $COLLEGE_ID" \
    -H "Content-Type: application/json" \
    --data '{"monthAnchor":"2026-04-15T00:00:00.000Z"}'
  # expect: 200, body shape { projection: {...}, narrative: "...", generatedAt: "..." }
  # narrative is a non-empty string when LLM succeeds
  ```

- [ ] Spot-check the `AgentAction` row written for that call:
  ```
  db.agentactions.find({ type: 'forecast' }).sort({ createdAt: -1 }).limit(1)
  # expect: provider === 'claude', model startsWith 'claude-', costInr > 0
  ```

### 3b. OpenAI

- [ ] Switch to `LLM_PROVIDER=openai` (and `OPENAI_API_KEY=...`); restart backend.

- [ ] Repeat the `/forecast-narrative` POST above.
  ```
  # expect: 200 with the same body shape as Claude
  ```

- [ ] Spot-check the latest `AgentAction`:
  ```
  db.agentactions.find({ type: 'forecast' }).sort({ createdAt: -1 }).limit(1)
  # expect: provider === 'openai', model startsWith 'gpt-', costInr > 0
  ```

- [ ] **Both `provider=claude` AND `provider=openai` rows are visible in `agentactions`:**
  ```
  db.agentactions.distinct('provider')
  # expect: ['claude', 'openai']
  ```

---

## 4. PII masking spot-check (security gate)

- [ ] **Trigger `/risk-scores` with a real student that has a guardian phone on file** + `includeNarrative: true`:
  ```
  curl -sS -X POST http://localhost:3003/api/juvi/finance-agent/risk-scores \
    -H "Authorization: Bearer $JWT" -H "x-college-id: $COLLEGE_ID" \
    -H "Content-Type: application/json" \
    --data '{"studentIds":["<real-student-id>"],"includeNarrative":true}'
  # expect: 200, response narrative may include the unmasked guardian phone
  ```

- [ ] **`AgentAction.maskedPrompt` for that call contains a `{guardian_phone_*}` token, NOT the raw phone:**
  ```
  db.agentactions.find({ type: 'risk' }).sort({ createdAt: -1 }).limit(1)
  // assert maskedPrompt regex match: /\{guardian_phone_\d+\}/
  // assert maskedPrompt does NOT contain the raw phone digits
  ```

- [ ] **The unmasked phone IS visible in the API response narrative** (frontend sees the real value via the unmasker — only the prompt + audit log carry the masked tokens).

- [ ] **Repeat for chat:** type a prompt referencing a student with a guardian phone in the dashboard, then inspect the `AgentAction(type='chat')` row:
  ```
  db.agentactions.find({ type: 'chat' }).sort({ createdAt: -1 }).limit(1)
  // assert maskedPrompt does NOT contain raw guardian phone
  // assert maskedPrompt OR maskedResponse contains a {guardian_*_<n>} token
  ```

- [ ] **Random spot-check across 10 audit rows:** none contain raw email or phone:
  ```
  db.agentactions.find().sort({ createdAt: -1 }).limit(10).forEach(r => {
    const txt = r.maskedPrompt + ' ' + r.maskedResponse;
    assert(!/\+?\d{10,}/.test(txt));         // no 10+ digit sequences
    assert(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(txt));  // no email pattern
  })
  ```

---

## 5. Streaming verification

- [ ] **In a browser:** open `/finance/dashboard` on the admin portal; type a chat prompt in the AI Command Bar and submit.

- [ ] **Network tab confirms SSE wire format:**
  ```
  Content-Type: text/event-stream
  Cache-Control: no-cache
  X-Accel-Buffering: no
  ```

- [ ] **Multiple `event: delta` chunks arrive incrementally** before the `event: done` chunk:
  ```
  # Expect at least 2 'event: delta' lines visible in the streamed response
  ```

- [ ] **Cancel mid-stream** (press Esc OR click the X button on the message). Verify in backend logs that the AbortController fires:
  ```
  # In the dev console, `AICommandBar` aborts via abortRef.current.abort()
  # Backend log should show no further LLM tokens after the abort point
  # `AgentConversation` is NOT updated for the cancelled call (per A6 spec gap §10)
  ```

- [ ] **Behind nginx (production):** verify `X-Accel-Buffering: no` is set on the response and the first delta arrives within 3 seconds:
  ```
  curl -N -X POST https://<prod>/api/juvi/finance-agent/query \
    -H "Authorization: Bearer $JWT" -H "x-college-id: $COLLEGE_ID" \
    -H "Accept: text/event-stream" -H "Content-Type: application/json" \
    --data '{"prompt":"What is the pending amount this month?"}' \
    -w '%{time_starttransfer}\n'
  # expect: time_starttransfer < 3.0s
  ```

---

## 6. Cost tracking

- [ ] **Tail backend logs while making 3 chat queries:**
  ```
  tail -f <backend-log>
  ```

  The shipped build does NOT emit a per-call `[llm] provider=... model=... in=... out=... ms=... costInr=...` log line (see [Known limitations](#10-known-limitations) item 2). Use the `AgentAction` collection as the cost ledger instead.

- [ ] **Each chat call produces exactly one `AgentAction(type='chat')` row** with non-zero `inputTokens`, `outputTokens`, `costInr`, `durationMs`:
  ```
  db.agentactions.find({ type: 'chat' }).sort({ createdAt: -1 }).limit(3).forEach(r => {
    assert(r.inputTokens > 0);
    assert(r.outputTokens > 0);
    assert(r.costInr > 0);
    assert(r.durationMs > 0);
    assert(r.provider === 'claude' || r.provider === 'openai');
  })
  ```

- [ ] **Sum of `AgentAction.costInr` for these 3 calls equals the corresponding `AgentConversation.totalCostInr` increment:**
  ```
  // Pick the conversationId from the test session
  const convo = db.agentconversations.findOne({ conversationId: '<test-uuid>' });
  const sum = db.agentactions.aggregate([
    { $match: { type: 'chat', /* same conversation */ } },
    { $group: { _id: null, total: { $sum: '$costInr' } } }
  ]).next();
  // assert sum.total ≈ convo.totalCostInr (rounding tolerance)
  ```

---

## 7. Fallback tests (degraded states)

For each of the four scenarios below, restart the backend with the indicated env override.

### 7a. Invalid `ANTHROPIC_API_KEY` with `LLM_PROVIDER=claude`

- [ ] Set `ANTHROPIC_API_KEY=invalid` (or empty); restart backend.

- [ ] Backend boots cleanly (no crash on startup).

- [ ] `POST /forecast-narrative` returns 200 with `narrative: null` and a populated `projection`:
  ```
  curl -sS -X POST http://localhost:3003/api/juvi/finance-agent/forecast-narrative \
    -H "Authorization: Bearer $JWT" -H "x-college-id: $COLLEGE_ID" \
    -H "Content-Type: application/json" \
    --data '{"monthAnchor":"2026-04-15T00:00:00.000Z"}'
  # expect: 200; body has projection.{lower, mean, upper, confidence}; narrative === null
  ```

- [ ] `POST /risk-scores` (without `includeNarrative`) returns deterministic scores:
  ```
  curl -sS -X POST http://localhost:3003/api/juvi/finance-agent/risk-scores \
    -H "Authorization: Bearer $JWT" -H "x-college-id: $COLLEGE_ID" \
    -H "Content-Type: application/json" \
    --data '{"studentIds":["<id>"]}'
  # expect: 200; each row has score+tier+factors; no narrative key
  ```

- [ ] `POST /risk-scores` with `includeNarrative=true` returns scores; narrative undefined per item:
  ```
  curl ... --data '{"studentIds":["<id>"],"includeNarrative":true}'
  # expect: 200; each row has score+tier+factors; r.narrative === undefined
  ```

- [ ] `POST /situations` returns `[]`:
  ```
  curl -sS -X POST http://localhost:3003/api/juvi/finance-agent/situations \
    -H "Authorization: Bearer $JWT" -H "x-college-id: $COLLEGE_ID" \
    -H "Content-Type: application/json" --data '{}'
  # expect: 200; body === []
  ```

- [ ] `POST /reminder-drafts` returns deterministic-template drafts (still valid `templateVersion: 'agent-draft-v1'`):
  ```
  curl ... --data '{"studentIds":["<id>"]}'
  # expect: 200; each row has subject, body, tone, language, predictedReadRate, templateVersion === 'agent-draft-v1'
  ```

- [ ] `POST /query` (SSE) emits an `event: error` with message "AI assistant temporarily unavailable" or similar:
  ```
  # Frontend: chat bubble shows the error inline; dashboard's other queries continue
  # AgentConversation NOT updated for the failed call
  ```

### 7b. Restore valid key — all features come back

- [ ] Reset `ANTHROPIC_API_KEY` to a valid value; restart.

- [ ] Re-run §7a happy paths and confirm `narrative` is populated, `/situations` returns up to 5 cards, etc.

---

## 8. Smoke tests (5 manual flows)

Execute these in the admin portal on a seeded pilot college (run the demo seed for the parent fee-analytics-and-alerts feature first if needed):

- [ ] **1. Chat flow:** Open `/finance/dashboard` → in the AI Command Bar, type "What's the pending amount this month?" → verify the response streams in (visible delta-by-delta) and the metadata footer shows `✦ <provider> · <model> · <duration>s · <in>→<out> tokens`.

- [ ] **2. Risk score popover:** Hover a defaulter card's risk badge → after a 300ms delay, a popover appears with header `Risk score: <N> / 100 (<tier>)`, narrative paragraph, and factor breakdown table. Insufficient-data students show `Risk —` with no narrative.

- [ ] **3. Situation cards + dismiss:** Open dashboard → "Agent findings" section renders 3-5 situation cards above the Risk list → click `[Dismiss]` on one → snooze dialog opens → select 7 days → confirm → card disappears with a success toast → reload the dashboard → the dismissed card is still gone.

- [ ] **4. Reminder drafts approval:** Click `[Draft reminders]` in the Risk list header → side panel slides in → 10 drafts (or `N` ≤ visible defaulters) load → review one card → click `[Approve recommended (M)]` → toast confirms `M` FeeReminders created.

- [ ] **5. FeeReminder docs verification:** Confirm in the database:
  ```
  db.feereminders.find({ 'metadata.source': 'agent-draft-v1' }).sort({ createdAt: -1 }).limit(M)
  // assert metadata.source === 'agent-draft-v1' on every doc
  // assert metadata.approvedBy === <test-officer-id>
  // assert metadata.subject and metadata.body are non-empty strings
  ```

---

## 9. Rollback plan

If the feature misbehaves post-deploy:

### Disable LLM (graceful)

- [ ] **Set `LLM_PROVIDER=invalid` (or unset both API keys); restart backend.** All AI endpoints fall back gracefully:
  - `/forecast-narrative` → projection only, narrative null
  - `/risk-scores` → deterministic scores only
  - `/situations` → `[]`
  - `/reminder-drafts` → deterministic templates
  - `/query` → SSE error event

- [ ] **No data corruption:** no `FeeReminder` is dispatched without an Officer approval click (HITL discipline preserved). Confirm:
  ```
  db.feereminders.find({
    'metadata.source': 'agent-draft-v1',
    'metadata.approvedBy': { $exists: false }
  }).count() === 0
  ```

### Drop collections (full reset)

- [ ] All three new collections can be dropped without affecting existing fee-analytics or core student/payment data:
  ```
  db.agentconversations.drop();
  db.agentactions.drop();
  db.situationdismissals.drop();
  ```
  No foreign-key relationships exist; existing `FeeReminder` docs with `metadata.source: 'agent-draft-v1'` remain valid (the source tag is informational).

### Revert PRs

- [ ] **Revert all 12 task PRs in reverse order** (A11 → A1). The schema additions are additive; existing data continues to read/write without the new collections.

- [ ] **Feature flag (none currently):** to add an off-switch, gate `mountFinanceAgentRouter()` in `backend/src/modules/juvi/routes.ts` behind an env var (e.g. `FEATURE_FINANCE_AGENT=true`).

---

## 10. Known limitations

Communicate these to Finance + Product before sign-off:

1. **Single shared rate-limit (60/min/user)** instead of per-endpoint limits per plan §1.9. If production traffic shows abuse on a specific endpoint, layer a per-endpoint limiter on that route.

2. **No per-call `[llm]` log line.** Plan §5 spec'd `[llm] provider=X model=Y in=N out=M ms=K costInr=Z`; cost is captured in `AgentAction.costInr` but no per-call log. Use the audit collection as the source of truth.

3. **Skip-draft action is client-state-only.** No `/reminder-drafts/skip` endpoint; clicking `[Skip]` flips the card state locally without writing an `AgentAction` row.

4. **Recall window (5 min) is informational only.** No `[Recall]` button shipped; the success toast surfaces the window as text. Real recall would need `DELETE` against a still-queued `platform:sms` job.

5. **Cost admin dashboard deferred.** `AgentAction.costInr` is captured but no `/platform/ai-usage` page renders it.

6. **Cross-college LLM context isolation enforced; no cross-college learning.** Each college's agent sees only its own data.

7. **No streaming for non-chat endpoints.** Forecast / risk / situations / drafts are request/response.

8. **No autopilot mode.** Every write requires HITL approval.

9. **Risk score is rule-based; no trained ML model.** Insufficient-data tier returned for new students with `daysOverdue < 0`.

10. **Holts-Winters confidence drops to 0.5 with < 30 days of history.** Linear-trend fallback when < 7 days; zero-band when 0 days of payments in window.

11. **All approved drafts route to the SMS queue (`platform:sms`).** Future iteration should read `guardian.communicationPreference` and route to email/whatsapp accordingly.

12. **`FeeReminder.dueAmount = 0` for agent-approved reminders.** The agent flow doesn't carry an invoice-level amount through the draft. Future iteration can pull `defaulter.overdueAmount`.

13. **`AgentAction.userId` for forecast/risk/reminder-draft batches is set to `collegeId`** (placeholder for batched calls). Per-user tracing for these actions requires lifting `userId` into the orchestrator signatures.

14. **Top-level `name` is NOT masked** — only `guardian.name`. Update `MASK_RULES` in `pii.ts` if Finance disagrees.

15. **Chat user prompt is NOT masked; only the context bundle is.** If an Officer pastes raw PII into the prompt, that text reaches the LLM verbatim and lands in `AgentAction.maskedPrompt` literally.

---

## 11. Post-deploy monitoring (2-week window)

- [ ] **LLM cost per day per college < ₹500** (target):
  ```
  db.agentactions.aggregate([
    { $match: { createdAt: { $gte: ISODate('<today-1d>') } } },
    { $group: { _id: '$collegeId', dailyInr: { $sum: '$costInr' } } }
  ])
  // assert each row's dailyInr < 500
  ```

- [ ] **Reminder draft approval rate > 70%** (approved-as-is — no edits):
  ```
  // Compare metadata.subject/body to metadata.originalDraft.subject/body
  // for FeeReminders with metadata.source === 'agent-draft-v1'
  // approved-as-is = subject equals originalDraft.subject AND body equals originalDraft.body
  // assert: count(approved-as-is) / count(all approved) > 0.70
  ```

- [ ] **Situation card dismissal rate < 40%:**
  ```
  const dismissed = db.situationdismissals.countDocuments({});
  const surfaced = db.agentactions.countDocuments({ type: 'situations' });
  // assert dismissed / surfaced < 0.40
  ```

- [ ] **Chat response p50 latency to first token < 2s.** Measure via APM or by sampling `AgentAction(type='chat').durationMs` (durationMs is end-to-end, not first-token; use it as a ceiling proxy):
  ```
  // p50 of AgentAction.durationMs for type='chat' should be <= 8000ms (per spec total budget)
  // First-token sub-2s requires browser-side instrumentation
  ```

- [ ] **Zero PII leaks in audit logs** (random spot-check weekly):
  ```
  // Sample 50 AgentAction rows; assert no raw 10+ digit sequences or email patterns
  // in maskedPrompt + maskedResponse
  ```

- [ ] **`/situations` returns 3-5 cards on average per call** (fewer indicates heuristics aren't surfacing enough; more indicates the LLM is over-picking):
  ```
  // Average length of latest 50 maskedResponse JSON arrays for type='situations'
  ```

- [ ] **`AgentAction.errors`-equivalent pattern (LLM 5xx / timeouts):**
  ```
  // Count AgentAction rows where maskedResponse === '(llm-failed; projection-only)' or similar
  // High count signals provider instability — investigate
  ```

---

## 12. Sign-off

- [ ] **Finance Lead** — verified §3 (provider switch), §6 (cost tracking), §8 (smoke tests); confirms LLM cost ceiling and HITL approval discipline are acceptable.
- [ ] **SRE** — verified §1 (env), §2 (schema/indexes), §5 (streaming through proxy), §7 (fallback paths), §9 (rollback); confirms feature can be disabled via env var with no data corruption.
- [ ] **Security** — verified §4 (PII masking spot-check) on at least 10 random `AgentAction` rows; signed off on no raw PII reaching the LLM or the audit log.
- [ ] **Product** — verified §8 smoke tests; accepts the §10 known limitations (especially items 1, 3, 4, 5).
- [ ] **Principal** (if their dashboard surfaces the agent UI) — verified the Finance Officer flow end-to-end.
