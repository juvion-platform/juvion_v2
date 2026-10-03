import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'push_messaging.g.dart';

/// Firebase Cloud Messaging, behind an interface so tests never initialise Firebase
/// (`firebase_push.dart` is the real one). Messages arrive as FCM's data map.
abstract class PushMessaging {
  /// False when Firebase is not initialised (tests, a build that failed to set it up).
  bool get available;
  Future<String?> token();
  Stream<String> get tokenRefreshes;
  Future<void> deleteToken();

  /// The FCM-displayed message whose tap launched the app. Juvi's pushes are data-only and
  /// rendered by `LocalNotifications`, whose launch payload carries the usual cold start.
  Future<Map<String, dynamic>?> initialMessage();
  Stream<Map<String, dynamic>> get foregroundMessages;
  Stream<Map<String, dynamic>> get openedMessages;
}

class NoPushMessaging implements PushMessaging {
  const NoPushMessaging();
  @override
  bool get available => false;
  @override
  Future<String?> token() async => null;
  @override
  Stream<String> get tokenRefreshes => const Stream.empty();
  @override
  Future<void> deleteToken() async {}
  @override
  Future<Map<String, dynamic>?> initialMessage() async => null;
  @override
  Stream<Map<String, dynamic>> get foregroundMessages => const Stream.empty();
  @override
  Stream<Map<String, dynamic>> get openedMessages => const Stream.empty();
}

/// `main()` overrides these two with the Firebase and plugin implementations once
/// Firebase is up; everywhere else (tests included) push is inert.
@Riverpod(keepAlive: true)
PushMessaging pushMessaging(Ref ref) => const NoPushMessaging();

@Riverpod(keepAlive: true)
LocalNotifications localNotifications(Ref ref) => const NoLocalNotifications();

/// Receipts from the foreground, on the session-less Dio (spec §7.2).
@Riverpod(keepAlive: true)
Receipts receipts(Ref ref) => Receipts(ref.read(bareMobileApiProvider), ReceiptQueue());
