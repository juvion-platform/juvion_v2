# Juvi account deletion — retention disclosure (draft)

**Status: draft. Not published.** Drafting this text is part of feature 011
(`.sdd/specs/011-account-deletion/`, §3.4); publishing it is not, because a published policy needs a
hosted URL for the Play listing to link to, and that URL is a deployment step, not a code change.

This is the **deletion section of the privacy policy**. It is also the text the Play Console
Data-safety answer is written from, so the operator notes at the end map each disclosure to the form.

What already exists and is *not* this document: the public deletion **request** form, served as a
static page at `/account-deletion.html`.

---

## Deleting your Juvi account

### What is deleted

When your Juvi account is deleted, the following is permanently removed from the college's Juvi
servers:

- your **Juvi account** itself;
- every **device session** — including the push-notification registration for each device, so no
  further notifications can be delivered to it;
- your **Spaces memberships**;
- any **temporary sign-in credential** that was issued to you;
- your **notification deliveries** — what was sent to you, whether it was opened, and its status;
- your **Juvi activity events** — the app's server-side usage analytics, including which notices you
  saw and acknowledged.

Your **notice audience rows** are emptied rather than deleted. These rows record who a published
notice was addressed to, and they exist for every member of the audience whether or not that person
ever used Juvi. Your personal state in them — the account it points at, when it was received, seen
or dismissed, whether you were reminded, and your acknowledgement — is cleared, and the notice's
"on Juvi" count is recomputed. The row itself is the college's record of who was informed.

On the device, deletion also removes everything the app had stored locally: your sign-in tokens, the
local copy of your account and preferences, queued notification receipts, and any held notification
destination.

**Deletion is not deactivation, and it is not reversible.** A deleted Juvi account cannot be restored
by signing in again, and it cannot be brought back by the app. Recovering access means the college
running a fresh provisioning run for you, which re-creates an account with none of the history above.

### What is retained

Deleting your Juvi account does **not** delete you from your college. These are college records, not
Juvi records, and they are retained under the college's own academic and financial record-keeping
obligations:

- your **person and user records** — your name, identifiers and contact details;
- your **student, faculty or staff record**, and the records every other ERP module holds about you
  (admissions, academics, fees and payments, HR, and the rest);
- your **profile photo**. A photo you upload through the app is written to your college record as
  that person's photo, not kept as app-local imagery — so it stays with the person record, and it is
  what the portal and the app will show if your account is provisioned again;
- the **notice audience rows** described above, with your Juvi state cleared.

Two smaller residues are worth naming rather than leaving to be discovered:

- a Spaces channel's **member count** stays stale until the next reconcile pass recomputes it;
- an internal identifier can remain inside a **queued outbox event payload** until that event's
  delivery record expires (30 days), since the payload is opaque to the retention sweep.

### When a deletion takes effect

There are two ways to delete a Juvi account and they are deliberately not the same speed.

**From inside the app — immediately.** Deleting from Settings requires a live signed-in session plus
a typed confirmation phrase, which is strong evidence that the request is really yours, so it takes
effect at once.

**From the public web page — after a 7-day grace period.** The public form can only ask for your
password, and that password is the same credential you use for the college ERP. On its own it is not
strong enough to justify an immediate, irreversible, silent deletion — one leaked or reused password
would be enough to destroy an account. A public request therefore only **schedules** the deletion:
it takes effect **7 days** after the request, whether or not anyone responds in the meantime. That
window is the whole point — it is time for you to notice a request you did not make and stop it.

**Cancelling.** A scheduled deletion is cancelled by signing in to the app, by changing your
password, or by using *Cancel deletion* on the banner or in Settings. The request is cleared from
your account and nothing else has to be disarmed, because the request is the only thing that triggers
the deletion. The window closes at the moment processing begins: once the deletion has started
committing, it can no longer be cancelled, and the app says so instead of pretending otherwise.

Deleting from inside the app while a public request is already pending deletes **immediately** — the
grace period exists only to substitute for proof of ownership, and a live session plus a typed
confirmation is stronger than that proof, so the window collapses the moment it arrives.

---

## Operator notes (not for publication)

**Maps to the Play Console Data-safety form as follows.**

| Data-safety question | Answer from this text |
|---|---|
| Is data deleted when the user requests it? | Yes — see *What is deleted*. The in-app path is immediate; the public path completes after a 7-day grace period. |
| What is **not** deleted on request? | College ERP records (person, user, student/faculty/staff and every module's own records) and the profile photo, which is part of the person record. Justification: regulatory record-keeping. |
| Account deletion URL | The public request page, once hosted. Until then the app's own Settings path is the deletion route. |
| Data types collected and their retention | The two lists above are the authoritative statement; anything that appears in one and not the other is a mistake in the form, not in this document. |

**Gate for this task (feature 011 T22):** all three disclosure classes are present — what is
deleted, what is retained, and the grace period, named as **7 days** — matching §3.1, §3.4 and §3.5
of the spec.

**Before publishing:**

1. A hosted URL the Play listing can link to (this document has no host yet).
2. Confirm the published text and the app's own copy still agree. The app states the cancellation
   boundary at the point of action; this document states it in prose. They are two renderings of one
   rule, and 011 Story 4 AC1 is where that rule is defined.
3. Confirm `DELETION_GRACE_DAYS` in `backend/src/modules/juvi-app/accounts/deletion-service.ts` is
   still 7. It is a constant because the sweep's timing and the public page's copy both quote it,
   and a drift between the two would be a promise the college never keeps.
