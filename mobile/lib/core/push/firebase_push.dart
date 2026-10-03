import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:juvi/core/push/push_messaging.dart';

/// The real [PushMessaging]. Constructed only in `main()`, after `Firebase.initializeApp()`.
class FirebasePushMessaging implements PushMessaging {
  FirebasePushMessaging([FirebaseMessaging? messaging]) : _m = messaging ?? FirebaseMessaging.instance;
  final FirebaseMessaging _m;

  @override
  bool get available => true;
  @override
  Future<String?> token() => _m.getToken();
  @override
  Stream<String> get tokenRefreshes => _m.onTokenRefresh;
  @override
  Future<void> deleteToken() => _m.deleteToken();
  @override
  Future<Map<String, dynamic>?> initialMessage() async => (await _m.getInitialMessage())?.data;
  @override
  Stream<Map<String, dynamic>> get foregroundMessages => FirebaseMessaging.onMessage.map((m) => m.data);
  @override
  Stream<Map<String, dynamic>> get openedMessages => FirebaseMessaging.onMessageOpenedApp.map((m) => m.data);
}
