# Demo runbook — Juvion Institute of Technology (prod)

Built by `npm run seed:demo`. Everything on screen runs the real product code over seeded
rows — nothing is faked in code, so "can I try that?" is always yes.

## 1. Setting it up on prod (manager, ~10 minutes, once)

**First merge PR #100 (the RBAC fix).** Without it, faculty can't take attendance and the
warden can't open Welfare on prod. Then, on the prod server, from the repo checkout:

```
npm run deploy                 # pulls main (with the RBAC fix and this script), builds, restarts
npm run seed:demo -- --check   # optional: shows what is there now, writes nothing
npm run seed:demo              # builds the demo — about 3 minutes
```

The run ends with **"All self-checks passed."**, the login table, and the students on the risk
board. If it ends with ✗ lines instead, send the whole output to the team. The command is safe
to run again: it only adds to JIT, and rebuilds the risk story from scratch each time.

It reads `backend/.env`, so it writes to the database the app uses. Check its first lines:
`AI key: set` and `redis: reachable`. Without the key the AI falls back to rules; without
Redis, a new inquiry won't be scored and AI answers aren't cached.

For sharper command-bar answers put `JUVI_CHAT_MODEL=gpt-4o` in `backend/.env` (about ₹0.65 a
question; everything else stays on gpt-4o-mini) and `npm run deploy` again.

## 2. Demo morning

AI answers are cached per day and reset at midnight UTC (5:30 am IST). After 5:30 am, log in
as admin and open **Finance → Dashboard**, **Welfare → Student Risk** and **Admissions** once
each. The walkthrough then loads instantly.

Do not run the Playwright e2e suite or `seed:e2e-users` against prod — it makes a fake
`E2E-AY` the current year and breaks fees. If someone did, re-run `npm run seed:demo`.

## 3. Logins

| Seat | Email | Password |
|---|---|---|
| College admin (lead) | admin@jit.edu.in | admin123 |
| Principal | principal@jit.edu.in | principal123 |
| HOD, CSE | hod.cse@jit.edu.in | hod123 |
| Faculty, CSE | faculty.cse@jit.edu.in | faculty123 |
| Finance | accounts@jit.edu.in | finance123 |
| Super admin (all colleges) | super@juvion.dev | super123 |

Also: exam@ / exam123, warden@ / warden123, registrar@ / registrar123, admissions@ / admissions123
(all `@jit.edu.in`).

## 4. Walkthrough — three seats, one story (~30 min)

### Seat 1 — Admin (15 min)

**Welfare → Student Risk.** 15 open alerts: 4 P1, 5 P2, 6 P3, across all four branches.

Open **Sai Kiran Bandaru (25B01A0501, CSE year 2)** — P1, first-generation, hostel resident.
Three signals from three different modules inside two weeks:

- **Academics:** attendance collapsed — normal for five weeks, then ~30% over the last three
- **Finance:** fee default
- **Hostel:** warden report (curfew)

The score is the engine's own arithmetic: signals from 3+ modules ×1.5, landing within 14 days
×1.5, capped at 100. That is "what triggers what". Then follow each signal to its module:
People → Sai Kiran → attendance; Finance → defaulters; Campus → hostel reports. The records are
there because the signals came from them.

- **The gap the dean should see:** Harshitha Mekala (25B01A0503) is P1 with **no mentor**.
- **Mentor load:** Dr. Ramesh Iyer (HOD, CSE) carries the most P1s.

**Command bar — the four chips, and what they answer:**

1. *Which CSE second-years have both a fee signal and an attendance signal?* → Sai Kiran Bandaru.
2. *Who did we flag last month that nobody has contacted?* → the P2s left untouched 18–21 days (Rakesh Thota, Divya Kandula, Swapna Boda, …).
3. *Which mentor has the most P1 students?* → Dr. Ramesh Iyer (2).
4. *Show me first-generation students whose risk went up this week.* → Sai Kiran Bandaru, Naveen Gundu, Swapna Boda, Anusha Kolli.

Ask something the board can't answer ("what does Sai Kiran owe?") — it points to Finance
instead of guessing.

**Draft outreach** from a P1: written in the guardian's language (Telugu/Hindi/English on file),
on their preferred channel. Approving records it on the alert and says nothing was sent.

**Finance → Dashboard.** Six months of collection (~₹1.77 Cr across ~440 payments), the AI
month-end forecast, and the agent's finding cards: stale partial payments, a concession spike,
holds nobody reviewed for 48h, welfare referrals ignored, holds waived without a reason, UPI
share falling this week, collection behind target. Dismiss one to show the snooze.

**Admissions.** 25 inquiries over 60 days, each with a lead score and its reasons. Creating a
new inquiry live scores it too (needs Redis — see §1).

**Reports → plain English.** Only these five work today: admissions funnel, lead-source
performance, backlogs, hostel occupancy, student roster. E.g. *"How many backlogs does each
branch have?"*, *"Show hostel occupancy by block"*, *"Which lead sources convert best?"*.
Do **not** ask for defaulters, collections, attendance or placements here — those reports are
not built yet and show "unimplemented". Ask fee questions in the Finance command bar.

### Seat 2 — Faculty (7 min) — `faculty.cse@jit.edu.in`

- The sidebar shrinks to what a teacher uses.
- **People → Students** lists only her students: the two CSE sections she teaches (years 2 and
  3) and her mentees. Other departments aren't in her list.
- **Academics:** take attendance for today's class, enter marks.
- She **cannot** see the Student Risk board: faculty have no welfare access today, by design.
  Don't open it from this login. (A mentor seeing their own flagged mentees is a planned change.)

### Seat 3 — Finance (7 min) — `accounts@jit.edu.in`

- Only **Finance** in the sidebar.
- **Students requiring action:** defaulters sorted by the AI risk score. Hover a badge for the
  factors — some show **"stopped responding to reminders"**.
- **Draft reminders** → the review panel: language, tone, edit, approve. Say it plainly:
  approval queues the reminder; nothing is sent from the demo.
- Finance command bar: *"Summarize this month's collection and who needs escalation."*

Close: the same students, seen from three seats, each seeing only what their role needs.

## 5. Known limits — say them before they're found

- Nothing fires live: marking attendance or escalating a defaulter doesn't raise a risk score
  in the room. The board is built from those modules' records.
- Reminders and outreach are recorded, not delivered (no SMS/email/WhatsApp provider yet).
- The "Stage-4 transitions today" finance card only appears on the day the demo was seeded.
- Risk signals expire 30 days after seeding. For a demo after that, run `npm run seed:demo` again.
