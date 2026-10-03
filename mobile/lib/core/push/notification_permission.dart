import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notification_permission.g.dart';

/// The OS notification permission (Android 13+ `POST_NOTIFICATIONS`, spec §8.4), behind an
/// interface so widget tests never reach the plugin.
abstract class NotificationPermission {
  Future<bool> isGranted();

  /// Shows the system prompt (a no-op returning the current answer once the OS stops
  /// asking) and returns whether notifications are now allowed.
  Future<bool> request();

  /// This app's notification page in the system settings (S12, S14 "Open settings").
  Future<void> openSettings();
}

class PluginNotificationPermission implements NotificationPermission {
  const PluginNotificationPermission();

  /// Handled in `android/app/src/main/kotlin/in/juvion/juvi/MainActivity.kt`.
  static const settingsChannel = MethodChannel('in.juvion.juvi/settings');

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      FlutterLocalNotificationsPlugin().resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  /// An answer the plugin cannot give (no Android implementation, as in a widget test)
  /// counts as allowed: the app never nags about a permission it cannot read.
  @override
  Future<bool> isGranted() async {
    try {
      return await _android?.areNotificationsEnabled() ?? true;
    } on Object {
      return true;
    }
  }

  @override
  Future<bool> request() async {
    try {
      return await _android?.requestNotificationsPermission() ?? true;
    } on Object {
      return false;
    }
  }

  @override
  Future<void> openSettings() async {
    try {
      await settingsChannel.invokeMethod<void>('openNotificationSettings');
    } on Object {
      // Nothing to open on this platform.
    }
  }
}

@Riverpod(keepAlive: true)
NotificationPermission notificationPermission(Ref ref) => const PluginNotificationPermission();

/// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
/// app resumes (the person may have changed it in the system settings); `PushRegistration`
/// registers the token on a denied → allowed change; S12 and the S14 card watch it.
@Riverpod(keepAlive: true)
class NotificationsAllowed extends _$NotificationsAllowed {
  @override
  Future<bool> build() => ref.read(notificationPermissionProvider).isGranted();

  Future<void> recheck() async {
    final allowed = await ref.read(notificationPermissionProvider).isGranted();
    if (ref.mounted && state.value != allowed) state = AsyncData(allowed);
  }

  Future<bool> request() async {
    final allowed = await ref.read(notificationPermissionProvider).request();
    if (ref.mounted) state = AsyncData(allowed);
    return allowed;
  }
}
