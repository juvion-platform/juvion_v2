// backend/src/modules/juvi-app/notifications/index.ts
/**
 * Juvi notifications (notifications spec §5). Register the consumer with
 * registerNotificationConsumers(); routes.ts calls it next to registerNoticeConsumers().
 */
import { registerConsumer, registerSweeper } from '../../../shared/outbox';
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';
import { runSender } from './sender';
import { pushTransportWarning } from './transport';

export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';

export function registerNotificationConsumers(): void {
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
  // After the events, on every dispatcher pass: rows the expansion just wrote go out in the same pass.
  registerSweeper(async () => { await runSender(); }, { afterEvents: true });
  const warning = pushTransportWarning();
  if (warning && process.env.NODE_ENV !== 'test') console.warn(`[juvi-push] ${warning}`);
}
