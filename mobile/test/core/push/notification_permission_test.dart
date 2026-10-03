import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/push/notification_permission.dart';

import 'push_fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('openSettings asks MainActivity for the app notification settings', () async {
    final calls = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(PluginNotificationPermission.settingsChannel, (c) async {
      calls.add(c.method);
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(PluginNotificationPermission.settingsChannel, null));
    await const PluginNotificationPermission().openSettings();
    expect(calls, ['openNotificationSettings']);
  });

  test('with no Android plugin to ask, notifications count as allowed (never nag blind)', () async {
    expect(await const PluginNotificationPermission().isGranted(), isTrue);
  });

  test('NotificationsAllowed reads, re-checks and requests through the permission', () async {
    final permission = FakeNotificationPermission();
    final c = ProviderContainer(retry: (_, _) => null, overrides: [notificationPermissionProvider.overrideWithValue(permission)]);
    addTearDown(c.dispose);
    expect(await c.read(notificationsAllowedProvider.future), isFalse);
    permission.granted = true; // changed in the system settings while the app was away
    await c.read(notificationsAllowedProvider.notifier).recheck();
    expect(c.read(notificationsAllowedProvider).value, isTrue);
    permission.granted = false;
    expect(await c.read(notificationsAllowedProvider.notifier).request(), isTrue);
    expect(permission.requests, 1);
    expect(c.read(notificationsAllowedProvider).value, isTrue);
  });
}
