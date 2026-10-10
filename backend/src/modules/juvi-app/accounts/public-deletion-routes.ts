import { NextFunction, Request, Response, Router } from 'express';
import express from 'express';

import { createAuditLog } from '../../../shared/audit';
import { allowedOrigins } from '../../../shared/http/allowed-origins';
import { Person } from '../../../models/people/Person';
import { IJuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';
import { notifyDeletionRequestedBestEffort } from '../notifications';
import { lookupInstitutionByCode } from '../config/institution-config';
import { deletionVerifyLimiter } from '../middleware/rate-limits';
import { accountDeletionRequestSchema } from './schemas';
import { verifyCredentials } from './auth-service';
import { clearDeletionVerifyFailures, getDeletionVerifyDelayMs, recordDeletionVerifyFailure } from './deletion-verify-budget';
import { DELETION_GRACE_DAYS, requestPublicDeletion } from './deletion-service';

/**
 * `POST /v1/account-deletion` — the public web path (011 Story 3).
 *
 * This is the surface that satisfies Play's deletion requirement for someone who has already
 * uninstalled the app, so **nothing here may require a session**: no `authenticateMobile`, no
 * `Authorization` header, and no `MobileSession` on any branch (AC2, AC7). It deliberately lives at
 * `v1Router` root rather than under an authenticated sub-router, so it inherits the mobile JSON error
 * envelope without inheriting mobile auth.
 *
 * It is *not* a second deletion path. A successful verification here calls the same
 * `requestPublicDeletion`, which schedules the deletion that `runAccountDeletion` — the single
 * account-deletion implementation — later performs (§3.5).
 */

/** A single header, normalised. Node gives `string[]` for a repeated header; we take the first. */
function header(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** `Referer` is a full URL; only its origin is comparable to an allowlist entry. */
function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF predicate for the public form (AC8). **Every signal present must agree** — this is not
 * primary-with-fallback, because a fallback leaves an attacker who can suppress one header a way in:
 *
 *  - `Sec-Fetch-Site`, when present, must be `same-origin`. (`same-site` and `none` are rejected too:
 *    a sibling subdomain is not the page.)
 *  - `Origin`, else `Referer`, when present, must be in the CORS allowlist — the same list
 *    `app.ts` gives `cors()`, from the same function, so the two can never disagree.
 *  - **Neither present is a rejection.** A non-browser client cannot forge the first and has no
 *    reason to send the second, so it is out by construction rather than by a rule.
 *
 * CORS alone would not do: it stops the browser handing the *response* back to the attacker's script,
 * but the form POST is still *processed*, which here means an account scheduled for deletion. This
 * actively refuses instead.
 *
 * Exported because the full-app e2e case cannot exercise it: `app.ts`'s `cors()` rejects a disallowed
 * `Origin` before the route runs, so only a bare-router test can reach this predicate with an
 * arbitrary header set.
 */
export function isSameOriginSubmission(headers: Record<string, unknown>): boolean {
  const site = header(headers, 'sec-fetch-site');
  if (site !== undefined && site !== 'same-origin') return false;

  const origin = header(headers, 'origin') ?? originOf(header(headers, 'referer'));
  if (origin === undefined) return false;

  return allowedOrigins().includes(origin);
}

/**
 * An ObjectId that matches nothing. When the institution code is unknown we still run the credential
 * chain against *some* college so the response — status, body and the bcrypt work in between — is the
 * same as for a real institution with a wrong password (AC5). A sentinel college is what makes that
 * collapse structural rather than a second branch someone could later "optimise" away.
 */
const NO_COLLEGE = '000000000000000000000000';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestDeletionFromWeb(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!isSameOriginSubmission(req.headers as Record<string, unknown>)) {
      throw new MobileApiError(403, 'FORBIDDEN', 'This form must be submitted from the account-deletion page.');
    }
    const input = accountDeletionRequestSchema.parse(req.body ?? {});

    const institution = await lookupInstitutionByCode(input.institutionCode);
    const collegeId = institution?.collegeId ?? NO_COLLEGE;

    // AC6: a non-blocking tarpit, never a refusal. `getDeletionVerifyDelayMs` has no verdict to
    // return, so a hard block is unrepresentable here — it cannot become a way to deny sign-in.
    // Only a known institution is keyed: for an unknown code there is nothing to key on, and one
    // Redis key per bogus code would be an unbounded write an attacker controls.
    if (institution) {
      const delayMs = await getDeletionVerifyDelayMs(collegeId, input.identifier);
      if (delayMs > 0) await sleep(delayMs);
    }

    let account: IJuviAccount;
    try {
      ({ account } = await verifyCredentials(collegeId, input.identifier, input.password));
    } catch (err) {
      if (institution) await recordDeletionVerifyFailure(collegeId, input.identifier);
      // Sign-in's own generic failure, thrown unchanged: AC5 asks for the same one, not an equal one.
      throw err;
    }
    await clearDeletionVerifyFailures(collegeId, input.identifier);

    // The transition guard. `createAuditLog` is an unconditional `AuditLog.create` (`audit.ts:60-62`),
    // so a repeat POST is stopped by asking, not by the writer.
    if (await requestPublicDeletion(collegeId, String(account._id))) {
      // The account row carries no display name; the id is the documented actor and the fallback
      // label, and `Person` is looked up only so the college's ERP record names a human.
      const person = await Person.findById(account.personId).select('name').lean();
      await createAuditLog({
        collegeId,
        entityType: 'JuviAccountPublicDeletion',
        entityId: String(account._id),
        entityName: person?.name ?? String(account._id),
        action: 'request_deletion',
        changes: [],
        // The account id, never the submitted identifier: identifiers are hashed elsewhere in this
        // module precisely so they never reach Redis or a log (`cooldown.ts:7`).
        performedBy: String(account._id),
      });

      // Best-effort and last (§3.5.2): the notification goes out only on the transition, so a
      // repeat POST cannot make the phone buzz, and it cannot fail the request that just succeeded.
      await notifyDeletionRequestedBestEffort(collegeId, String(account._id));
    }

    // Identical on both branches — a repeat requester is not told that someone already asked, and a
    // wrong password never reaches here at all.
    res.json({
      requested: true,
      graceDays: DELETION_GRACE_DAYS,
      completesAt: new Date(Date.now() + DELETION_GRACE_DAYS * 86_400_000).toISOString(),
    });
  } catch (e) {
    next(e);
  }
}

export const publicDeletionRouter = Router();

// `express.urlencoded` on **this route only**: the public page carries no script at all (AC9), so it
// submits a native form, and `app.ts:46-51` registers `express.json` and nothing else. Mounting it
// app-wide would put a second body parser on every ERP and mobile route.
publicDeletionRouter.post('/account-deletion', deletionVerifyLimiter, express.urlencoded({ extended: false }), requestDeletionFromWeb);
