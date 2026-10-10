// backend/src/modules/juvi-app/notifications/index.ts
/**
 * Juvi notifications (notifications spec §5). Register the consumer with
 * registerNotificationConsumers(); routes.ts calls it next to registerNoticeConsumers().
 */
import { registerConsumer, registerSweeper } from '../../../shared/outbox';
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';
import { onClassChanged, CLASS_CHANGE_EVENT } from './class-change';
import { runSender } from './sender';
import { pushTransportWarning } from './transport';

export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';
export { requestClassChangeNotification } from './class-change';
export { notifyDeletionRequestedBestEffort, accountDeletionKey, ACCOUNT_DELETION_KIND } from './account-deletion';

export function registerNotificationConsumers(): void {
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
  registerConsumer(CLASS_CHANGE_EVENT, async (payload) => { await onClassChanged(payload); });
  // After the events, on every dispatcher pass: rows the expansion just wrote go out in the same pass.
  registerSweeper(async () => { await runSender(); }, { afterEvents: true });
  const warning = pushTransportWarning();
  if (warning && process.env.NODE_ENV !== 'test') console.warn(`[juvi-push] ${warning}`);
}
