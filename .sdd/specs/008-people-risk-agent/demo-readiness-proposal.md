# Juvion — AI Demo Readiness: status, plan, and decisions needed

**Date:** 2026-08-22
**Context:** getting Juvion demo-ready for real universities, with the AI features
as the differentiator rather than the CRUD ERP.
**Demo college:** JIT (Juvion Institute of Technology) — demo-only, not a customer.

---

## 1. Where we actually are

**The AI features are built and tested — and have never once run.**

Four LLM-backed features are complete and green (278 unit tests passing):
fee forecast narratives, fee risk scoring, "situations" detection, and
HITL reminder drafting. Plus natural-language report queries, AI-assisted
config, and lead scoring.

But the audit log tells the real story. `agentactions` has **41 recorded AI
calls, and every one of them produced zero tokens at zero cost:**

| provider | model | feature | calls | tokens in | tokens out | cost |
|---|---|---|---|---|---|---|
| claude | `unknown` | forecast | 29 | 0 | 0 | ₹0 |
| claude | `unknown` | situations | 12 | 0 | 0 | ₹0 |

Cause: `backend/.env` has `AI_API_KEY=change-` — a placeholder. The code checks
the key is non-empty, not that it's real, so it builds a client and fails at
call time. The system degrades gracefully to rule-based fallback text, which is
why nobody noticed across 41 attempts.

**Implication:** anyone who has demoed the forecast or situations screens so far
has been demoing the non-AI fallback. The AI has not yet been seen by anyone.

**Second finding: the demo data is asymmetric.**

JIT has 47 students. The finance side is coherent; the academic side is empty.

| Finance (works) | | Academics / Welfare (empty) | |
|---|---|---|---|
| students | 47 | attendance summaries | 3 |
| fee accounts | 24 | attendance records | 6 |
| invoices | 20 | internal marks | 4 |
| invoice line items | 66 | backlogs | 1 |
| payments | 10 | enrollments | 5 |
| concessions | 2 | mentor assignments | 4 |

Invoice status spread is realistic (4 paid, 4 part-paid, 1 overdue, 10 generated).
The fee module has a small but genuine story. The academic module has nothing to
tell a story about.

---

## 2. What this means

Two conclusions:

1. **We are one configuration change away from the AI working at all.** This is
   the highest-return item in the project and it is not an engineering task.
2. **The demo gap is data depth, not missing features.** 47 students cannot
   produce a "wow." "1 overdue invoice" is not a moment. "₹42 lakh outstanding
   across 180 students, and here are the 12 most likely to slip next month" is
   the same code over more data.

We should not build new AI features before doing these two things.

---

## 3. Recommended plan

### Phase 1 — "Make it speak" (Week 1)

| Task | Days |
|---|---|
| Live API key wired; placeholder-key guard so this cannot silently recur | 0.5 |
| Move the spend gate + cost audit inside the shared LLM client, so every AI feature is metered and capped (today only the fee agent is) | 1 |
| Update the model ID and pricing constants (currently a previous-generation model) | 0.5 |
| Deepen JIT finance data: 47 → ~600 students with realistic payment behaviour, defaulter clusters, guardian language/contact preferences | 3 |

**Exit:** the fee agent demo works end-to-end with a real model over believable
volume. This alone is a presentable demo.

### Phase 2 — "Make it connect" (Weeks 2-3)

| Task | Days |
|---|---|
| Extend the data generator into academics: attendance histories with deliberate shape, marks, backlogs, enrollments, mentor assignments | 3 |
| Student risk scorer — deterministic weighted score across attendance + backlogs + mentor concerns + fee status, with a visible factor breakdown | 3 |
| Section-level "situation" detection (e.g. attendance cliff concentrated in one subject) | 2 |
| Front-end surface for both, on the existing People screens | 2 |

**Exit:** the strongest differentiator in the demo — the system connects
attendance, exams, welfare and fees to flag a student six weeks before anyone
currently would. No competitor does cross-module.

Note: the risk scoring itself is deterministic arithmetic, not an LLM. It is
auditable — we can show a parent exactly which five factors flagged their child.
The LLM only writes the explanatory text and the outreach messages.

### Phase 3 — Demo hardening (Week 4)

Pre-warm the daily AI cache before each demo so no screen depends on a live API
call; rehearse the full script weekly on the demo laptop; freeze features two
weeks before the demo date.

**Total: ~4 weeks.** Phase 1 is independently presentable, so the demo date is
protected even if Phase 2 slips.

---

## 4. Decisions needed from you

**1. Approve a live LLM API key — this is the blocker.**
Nothing works without it. Cost is not a concern: at current rates a typical AI
call costs roughly ₹1.50, and dev + rehearsals + demos would run **under ₹5,000
per month**. The platform already enforces a configurable per-college weekly
spend cap and blocks at 100%, so overspend is not possible.
*Need: whose account, which provider, and who owns the credential.*

**2. Confirm the demo date.**
Under ~3 weeks → Phase 1 only, fee-agent demo, and we drop Phase 2.
4+ weeks → both phases, which is a materially stronger demo.

**3. Who is in the room?**
Chairman/Correspondent → lead with money and risk (fee collection, defaulters).
Principal/Dean → lead with academics and student retention.
IT head present → we move the governance screen (data masking, audit trail,
spend cap) forward; it is built and it is a strong close.

**4. One or many demo colleges?**
JIT is demo-only, so I propose we parameterise the data generator by college
name and branches now — a small change today, an annoying one later — so a
prospect can be shown their own college name if that helps the pitch.

---

## 5. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| Live API call fails or lags during the demo | Every AI screen caches daily; we pre-warm before presenting. One screen (chat) currently has no fallback — fixing in Phase 1. |
| AI states something false on stage | Architecturally prevented: no number shown on screen is generated by a model. Scores and counts are deterministic; the model only narrates. Keeping this rule absolute. |
| Prospect types their own question and gets refused | Natural-language queries only cover a defined report set. Either broaden coverage in Phase 2 or have the presenter state the scope aloud. Decision needed if this moment is in the script. |
| Demo data looks synthetic to academics in the room | Need to confirm the target university type (affiliated vs autonomous) so semester structure, attendance rules and exam patterns are right. |
| We build demo-only shortcuts we later throw away | Firm rule: **fake in data, never in code.** Everything impressive runs through the real code path over seeded data — so it is all shippable to a real college, and "can I try it myself?" is always answerable with yes. |

---

## 6. What I recommend we do this week

1. Get the API key approved and wired — half a day, and it converts a built-but-silent
   feature set into a working one.
2. Start the JIT data generator, finance first.
3. Write the demo script — the 20 minutes in the presenter's own words, with the
   exact numbers that will be on screen — and build only what the script needs.

The script should be written before the remaining code, so we build for the demo
rather than building and then hunting for a story.
