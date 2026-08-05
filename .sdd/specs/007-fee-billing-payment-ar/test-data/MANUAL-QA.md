# Manual QA — five demo flows, end to end (007 T14)

Run the whole chain twice, once per CSV. Cohort A and Cohort B differ on
**branch** and **quota**, so they bind to two different fee structures — which is
what proves the fee-pin axis matcher is actually working, not just returning the
only structure in the database.

| | Cohort A | Cohort B |
|---|---|---|
| File | `cohort-a-cse-convener.csv` | `cohort-b-ece-management.csv` |
| Students | 5 | 5 |
| Programme / Branch | BTECH / **CSE** | BTECH / **ECE** |
| Quota | **convener** | **management** |
| Category | mixed (OC, SC, BC-A) | all OC |
| Annual fee | **₹1,20,000** | **₹2,40,000** |
| Per semester | ₹60,000 | ₹1,20,000 |
| Cohort semester total | **₹3,00,000** | **₹6,00,000** |

Cohort A deliberately carries three different categories against a structure
authored with **Category = blank**. All three must still pin — that is the
wildcard axis doing its job.

---

## Two facts that decide the whole test

1. **The import pins to the `isCurrent` academic year** — there is no picker in
   the drawer (`student-import-pin.ts:82`). In the seed that is **AY2024-25**.
   So the fee structures must be authored for **AY2024-25**, and the semester you
   bill must belong to AY2024-25 — i.e. *Semester 1 — 2024* or *Semester 2 — 2025*.
   Pick a semester from AY2025-26 and every row comes back
   `pinned-to-different-ay`.
2. **`batchCode` is blank in both files, on purpose.** With a batch,
   `resolveStudentYearOfStudy` derives year-of-study from the calendar (2026) and
   returns Year 4/5, which would not match the Year-1 pin. Blank makes it fall
   back to `studyYearAtAdmission` (`student-import-pin.ts:294-301`), so pinning
   and billing agree on Year 1. Do not fill it in.

---

## Step 0 — prerequisites

```bash
docker compose up -d mongodb redis     # or your local services
npm run seed -w backend                # optional; wipes and reseeds
npm run dev:backend                    # :3003 — allow ~60s cold start on WSL
npm run dev:portal                     # :5173
```

**Then register the fee quota and category catalogs.** `src/seed.ts` does *not*
call `seed-fee-quotas.ts` / `seed-fee-categories.ts`, so on a freshly seeded
database these registries are empty and **every import row is rejected** with
`unknown quota code "convener"` (`student-import-refs.ts:107-117`).

Fastest route — Finance → Fee Management:

- **Fee Quotas** tab → add `convener` and `management`
- **Fee Categories** tab → add `OC`, `SC`, `BC-A`

Or run the seeders directly:

```bash
npx ts-node -r dotenv/config src/scripts/seed-fee-quotas.ts       # from backend/
npx ts-node -r dotenv/config src/scripts/seed-fee-categories.ts
```

Log in as an admin or super_admin. A principal holds `finance:approve` +
`finance:read` only and cannot bill or record payments.

---

## Step 1 — author the two fee structures (Flow 2)

**Finance → Fee Management → Fee Structures.**

Create **FSI-A**:

| Field | Value |
|---|---|
| Academic Year | **AY2024-25** |
| Programme | BTECH |
| Branch | CSE |
| Quota | convener |
| Category | *(leave blank — wildcard)* |
| Year of Study | 1 |
| Total | **120000** |

Add components summing to exactly 120000, e.g. Tuition 90000 + Lab 15000 +
Library 8000 + Exam 7000.

Create **FSI-B** — identical except Branch **ECE**, Quota **management**,
Total **240000**.

Then for **each** structure click through **Submit → Approve → Activate**.

> ⚠️ Both must reach **`active`**. A pin only binds to `status: 'active'`
> (`fee-pin-service.ts:226`) — Approved is not enough.

**✅ Expected:** both rows show the `active` badge.

---

## Step 2 — import Cohort A (Flow 1)

**People → Students → Import** (drawer button, top right).

Upload `cohort-a-cse-convener.csv`.

**✅ Expected at preview:**

- 5 rows, all **Create**
- Resolved column echoes `Programme: Bachelor of Technology`, `Branch: Computer Science and Engineering`
- Each row notes **`will pin Year 1 → ₹1,20,000`**
- Each row notes `will create a guardian for 99000010xx`
- Banner shows `academic year Academic Year 2024-25`

> If rows read **`no matching fee structure for Year 1 — will import unpinned`**,
> FSI-A is not `active`, or its academic year is not AY2024-25, or an axis
> (branch/quota) does not match. Fix before committing — an unpinned student
> cannot be billed.

Click **Commit**.

**✅ Expected:** 5 created, 5 guardians created, 5 pinned.

---

## Step 3 — verify the pins (Flow 3)

**Finance → Fee Management → Pin Coverage.**

**✅ Expected:** coverage percentage rises; the five new students are **not**
listed under `never-pinned` or `no-fee-responsible-guardian` (the CSV supplies a
fee-responsible guardian for each).

Spot-check one: **People → Students → Aditya Nair** → fee pin shows Year 1,
₹1,20,000, FSI-A.

---

## Step 4 — generate bills (the step between mapping and payment)

**Finance → Fee Management → Generate Bills.**

- Semester: **Semester 1 — 2024** (this is the AY2024-25 one — see fact #1)
- Year of study: **Year 1**
- Click **Preview & Generate**

The confirm dialog reports the projected counts; confirm.

**✅ Expected:** `Generated 5`. The "Last run" card shows Generated 5, everything
else 0.

Total billed this run = 5 × ₹60,000 = **₹3,00,000** (half the ₹1,20,000 annual).

> The screen shows counts only, never names or amounts — that is the gap written
> up in `../generate-bills-ux-suggestions.md`.

**Cross-check — Finance → Fee Management → Invoices:** five new invoices, each
`₹60,000`, status `generated`, `INV-…` numbers.

---

## Step 5 — record a payment (Flow 4)

**Finance → Fee Management → Payments → Record payment.**

- Student: **Aditya Nair**
- **Apply to invoice**: his ₹60,000 invoice (defaults to the oldest open one)
- Amount: **25000** (a part payment — proves the balance maths, not just
  full settlement)
- Mode: cash / upi
- Save

**✅ Expected:** payment listed; the invoice moves to `partially_paid`.

**Cross-check — Fee Accounts tab → Aditya Nair:** `totalDue 60000`,
`totalPaid 25000`, `balance 35000`.

Now try the guard: record another payment for **50000** against the same invoice.

**✅ Expected:** rejected — overpayment guard (60000 − 25000 = 35000 remaining).

---

## Step 6 — real-time finances (Flow 5)

**Finance → Fee Dashboard.**

**✅ Expected:** **Total Outstanding = ₹2,75,000** (₹3,00,000 billed − ₹25,000
collected). `Due by Programme` attributes it to BTECH.

Record another payment, reload, and confirm outstanding drops by exactly that
amount. That is the "real time" claim — the figure is `Σ StudentFeeAccount.balance`,
not a cached number.

---

## Step 7 — repeat with Cohort B

Repeat **Steps 2 → 6** with `cohort-b-ece-management.csv`, unchanged except:

- Step 2 preview should read **`will pin Year 1 → ₹2,40,000`** (FSI-B, the
  management structure — *if it says ₹1,20,000 the matcher picked the wrong
  structure, which is a bug worth reporting*).
- Step 4: keep **Semester 1 — 2024**. Expect **`Generated 5`** *and*
  **`Already billed 5`** — cohort A is correctly skipped. That is the
  idempotency guard, and re-running is meant to be safe.
- Step 6: outstanding rises by 5 × ₹1,20,000 = **₹6,00,000**.

---

## Step 8 (optional) — the second installment

Back on **Generate Bills**, pick **Semester 2 — 2025** (also AY2024-25), Year 1.

**✅ Expected:** `Generated 10` — both cohorts billed their second half. Total
outstanding rises by ₹3,00,000 + ₹6,00,000.

Two invoices per student now sum to exactly the annual fee: 60000 + 60000 =
120000, and 120000 + 120000 = 240000.

---

## Known issues to expect (not regressions)

| What you'll see | Why |
|---|---|
| Import rejects every row with `unknown quota code` | `src/seed.ts` never calls the quota/category seeders — see Step 0 |
| Generate Bills shows counts, no student names or ₹ | Known gap, written up in `../generate-bills-ux-suggestions.md` |
| Payments student dropdown lists all students in one `<select>` | Pre-existing pattern across finance pages; needs a searchable picker at 500+ students |
| Approved-but-not-Activated structure silently fails to pin | Pins require `status: 'active'`; the UI does not warn |
