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

/// The background isolate's whole body (Ruling R4): an error there has no handler and
/// nobody to show it to, so nothing thrown inside [body] escapes.
Future<void> runInBackgroundIsolate(Future<void> Function() body) async {
  try {
    await body();
  } on Object {
    // Swallowed: background isolate.
  }
}

/// A push received in the foreground (spec §8.2): Urgent and Important are rendered; every
/// tier refreshes what shows notices ([refresh]: the attention stack and Due badge, the
/// lists, any open S04), and `delivered` is posted. The app itself refreshed, so a tray
/// that fails to render costs neither the refresh nor the receipt.
Future<void> handleForegroundPush(
  Map<String, dynamic> data, {
  required LocalNotifications local,
  required Receipts receipts,
  required void Function() refresh,
  DateTime Function() now = DateTime.now,
}) async {
  final p = NoticePush.tryParse(data);
  if (p == null) return;
  refresh();
  if (p.tier != 'routine') {
    try {
      await local.show(p);
    } on Object {
      // The attention stack already shows it.
    }
  }
  await receipts.post(ReceiptItem(deliveryId: p.deliveryId, receipt: p.receipt, event: 'delivered', at: now().toUtc()));
}
