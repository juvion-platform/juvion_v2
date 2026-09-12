# Demo runbook — AI features and dashboards (JIT)

Seeded 2026-09-11 with `npm run seed:demo-ai -w backend -- --college-id=000000000000000000000001 --confirm-college-name="Juvion Institute of Technology"`
plus `src/scripts/seed-agent-findings.ts` (same flags). Both are re-runnable with `--clear-first`.
Login: `admin@jit.edu.in` / `admin123` (or `e2e_principal@juvion.test` / `E2ETestPassword!`).

**Before you start:** do NOT run the Playwright suite before the demo. Its seed marks a
fake `E2E-AY` academic year as current, which silently breaks fee mapping and billing.
If it has been run, re-run `seed:demo-ai` — step 0 restores `2026-2027` as current.

Forecast, situation cards, risk scores and card narrations are cached per day. Open each
page once on demo morning (or run the warm-up below) so they load instantly in the room.
The command bars call the model live. `JUVI_CHAT_MODEL` in `backend/.env` picks their
model: `gpt-4o` (about ₹0.65 a question) answers the four chip questions exactly;
gpt-4o-mini (₹0.01) skims a 15-row board and drops matches. Everything else stays on
gpt-4o-mini.

Warm-up (backend running):
```
curl -s -X POST localhost:3003/api/juvi/finance-agent/situations -H 'Content-Type: application/json' -d '{"force":true}' >/dev/null
curl -s -X POST localhost:3003/api/juvi/finance-agent/forecast-narrative -H 'Content-Type: application/json' -d "{\"monthAnchor\":\"$(date -u +%Y-%m-%dT00:00:00Z)\",\"force\":true}" >/dev/null
```
then open Student Risk once (narrations) and the Fee Dashboard once (risk scores).

## 1. Finance → Dashboard (`/finance/dashboard`)

- Six months of collection: ₹1.73 Cr across 428 payments, heavier in July/August after
  the semester bills, ₹9.0 L so far in September. UPI is the largest mode.
- **AI forecast** banner: month-end band with the model's driver sentence.
- **Agent findings**: three cards — holds awaiting review, Stage-4 transitions today,
  collection short of target. Dismiss one to show the snooze flow.
- **Students requiring action**: 9 defaulters, risk-sorted. Hover a risk badge for the
  factor breakdown and narrative. Priya Reddy is 120 days overdue at stage 2; Divya Bhat
  and Nisha Gowda are stage 4.
- **Draft reminders** → the review panel: language, tone, predicted read-rate, edit,
  approve. Say plainly that approval queues the reminder; nothing is sent from the demo.
- Command bar: "Summarize this month's collection performance and who needs escalation".

## 2. Welfare → Student Risk (`/welfare/student-risk`)

The story: the same students who default on fees are the ones academics and the hostel
are already worried about — and the board joins those signals before anyone would.

- 15 open alerts: 4 P1, 5 P2, 6 P3, across CSE and ECE, convener and management quota.
- Signals this month: 14 academic, 7 fees, 7 campus (warden, mess), 3 messaging, 2 counselling.
- Each card carries a one-sentence "why" from the agent. Open **Aarav Sharma (22B01A0501)**:
  P1, first-generation, attendance + fee default + warden concern, nobody has acted, 3 days open.
- Mentor workload: Dr. Ramesh Iyer carries 4 open / 2 P1; **Aditya Nair (25B01A0511)** is
  P1 with **no mentor** — the gap the dean should see.
- Cohort view: first-generation students average 77 vs 41 for ECE; 8 of 15 are hostel residents.
- Outreach effectiveness, last 90 days: 23 raised → 9 contacted → 7 resolved → 2 recurred.
- **Draft outreach** from a P1 breakdown: message drafted in the guardian's language
  (Telugu/Hindi/English on file), on their preferred channel. Approving records it on the
  alert and says nothing was sent — that honesty is deliberate.
- Command bar — the four questions the chips offer all have real answers:
  1. Which mentor has the most P1 students? → Dr. Ramesh Iyer (2).
  2. Which CSE second-years have both a fee signal and an attendance signal? → Aarav Sharma 22B01A0501 (and Priya Reddy 22B01A0502 if the model counts her scholarship loss as a fee signal).
  3. Who did we flag last month that nobody has contacted? → everyone with no action recorded: Aditya Nair (P1, no mentor), Aarav Sharma, then the P2s open 18–21 days.
  4. Show me first-generation students whose risk went up this week. → Aarav Sharma, Priya Reddy, Siddharth Rao, Karthik Shetty.
  Ask something the board cannot answer ("what does Aarav owe?") — it names the Finance screen instead of guessing.

## 3. People → Students → Aarav Sharma (Profile tab)

The **Risk** block: score 100 / P1, the agent sentence, the active signals, and a 90-day
score history climbing from 60 to 100. "Open on risk board" jumps back to the board.
The People hub has a Student Risk tile for registrars.

## 4. Admissions (`/admissions`)

25 inquiries over the last 60 days across website, walk-in, referral, WhatsApp, fairs,
with interactions and hot/warm/cold grades — the CRM funnel and pipeline are populated.
Lead scoring runs on new inquiries created through the UI, so create one live to show it.

## What is deliberately not seeded

Academics (marks, attendance registers) and placements are still thin — the risk signals
reference them but the module pages are not the demo's focus.
