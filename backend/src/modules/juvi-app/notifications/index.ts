// backend/src/modules/juvi-app/notifications/index.ts
/**
 * Juvi notifications (notifications spec §5). Register the consumer with
 * registerNotificationConsumers(); routes.ts calls it next to registerNoticeConsumers().
 */
import { registerConsumer } from '../../../shared/outbox';
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';

export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';

export function registerNotificationConsumers(): void {
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
}
