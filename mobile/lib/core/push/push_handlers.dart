// mobile/lib/core/push/push_handlers.dart
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/receipts.dart';

/// A push received while the app is in the background or killed (spec §8.2): render it on
/// its tier's channel, whatever the tier, then post `delivered` (queued when offline).
/// While the OS blocks notifications nothing can reach the tray, so nothing is posted and
/// Reach keeps the person under "Not delivered". Called from
/// `firebaseMessagingBackgroundHandler` in its own isolate.
Future<void> handleBackgroundPush(
  Map<String, dynamic> data, {
  required LocalNotifications local,
  required Receipts receipts,
  required Future<bool> Function() allowed,
  DateTime Function() now = DateTime.now,
}) async {
  final p = NoticePush.tryParse(data);
  if (p == null || !await allowed()) return;
  await local.show(p);
  await receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'delivered', at: now().toUtc()));
}

/// A push received in the foreground (spec §8.2): Urgent and Important are rendered; every
/// tier refreshes what shows notices ([refresh]: the attention stack and Due badge, the
/// lists, any open S04), and `delivered` is posted.
Future<void> handleForegroundPush(
  Map<String, dynamic> data, {
  required LocalNotifications local,
  required Receipts receipts,
  required void Function() refresh,
  DateTime Function() now = DateTime.now,
}) async {
  final p = NoticePush.tryParse(data);
  if (p == null) return;
  if (p.tier != 'routine') await local.show(p);
  refresh();
  await receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'delivered', at: now().toUtc()));
}
