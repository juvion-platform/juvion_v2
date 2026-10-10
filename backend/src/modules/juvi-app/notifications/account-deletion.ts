/**
 * The account-deletion notification's request side (011 §3.5.2).
 *
 * A third source type beside `notice` and `class_change`, and the first one that is not about a
 * document at all — which is why the `source.id` convention is defined here rather than inherited.
 *
 * Best-effort by design, and the spec says so out loud: a person with no live device gets
 * `suppressed/no_device` in the sender, and that person *is* this path's audience (they are the one
 * who uninstalled the app). The dependable surfaces are the in-app banner, the ERP record and the
 * audit trail; the push is an extra. Nothing here may fail the deletion request.
 */
import { NotificationTier } from '../../../models/juvi/NotificationDelivery';
import { emit } from '../../../shared/outbox';
import { NOTIFICATION_REQUESTED } from './expand-consumer';

/** The only kind there is: the notification exists to say a request was made. */
export const ACCOUNT_DELETION_KIND = 'requested' as const;
/** Important, never Urgent: a seven-day deadline must not wake a campus. */
export const ACCOUNT_DELETION_TIER: NotificationTier = 'important';

/** Today&Teaching §8's `ClassChangeSource` shape: the tier travels in the request. */
export interface AccountDeletionSource {
  type: 'account_deletion';
  /** The account id — the only ObjectId this notification can point at. */
  id: string;
  kind: typeof ACCOUNT_DELETION_KIND;
  tier: NotificationTier;
}

/**
 * The dedupe key, and with it the whole idempotency of this notification: `OutboxEvent`'s unique
 * `dedupeKey` stops a second event, and `NotificationDelivery`'s unique `(source, accountId)` key
 * stops a second row. Both say "one deletion push per account", which is intended (see
 * `models/juvi/NotificationDelivery.ts`).
 */
export const accountDeletionKey = (accountId: string): string => `notif:account_deletion:${accountId}`;

/**
 * The tray key every deletion push shares. A constant, where the other two sources carry the id of
 * the thing they are about — because this one is about a *person*, and NFR-05's "opaque ids only"
 * rule bites hardest here. The collapse is per-device and the device belongs to the account, so the
 * entry this collapses is already that account's.
 */
export const ACCOUNT_DELETION_GROUP_KEY = 'account';

/**
 * Records `notification.requested` for an account-deletion request. Call it **only** on the
 * unset → set transition — the same guard that gates the `request_deletion` audit row — so a repeat
 * POST cannot be turned into a way to make someone's phone buzz.
 */
export async function requestAccountDeletionNotification(collegeId: string, accountId: string): Promise<boolean> {
  const source: AccountDeletionSource = {
    type: 'account_deletion', id: accountId, kind: ACCOUNT_DELETION_KIND, tier: ACCOUNT_DELETION_TIER,
  };
  return emit(NOTIFICATION_REQUESTED, { collegeId, source, accountId }, accountDeletionKey(accountId));
}

/**
 * The caller's shape, and the reason the wrapper exists at all: the public route calls this *after*
 * the request is already committed, and an outbox write must never be able to turn a successful
 * request into a 500 the requester would read as "it did not work" and retry, or worse, abandon.
 * Same precedent as `clearDeletionRequestBestEffort` (`accounts/deletion-service.ts`).
 */
export async function notifyDeletionRequestedBestEffort(collegeId: string, accountId: string): Promise<void> {
  try {
    await requestAccountDeletionNotification(collegeId, accountId);
  } catch (err) {
    console.warn('[juvi-app] best-effort deletion-request notification failed', accountId, err);
  }
}
