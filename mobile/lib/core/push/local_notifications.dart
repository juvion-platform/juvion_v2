// mobile/lib/core/push/local_notifications.dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';

/// The tray, behind an interface so tests never touch the plugin (spec §8.2).
abstract class LocalNotifications {
  /// Initialises the plugin and creates the three tier channels. [onTap] receives the
  /// payload of a notification tapped while the app is running.
  Future<void> init({void Function(String? payload)? onTap});

  /// Shows [p] on its tier's channel, grouped by `groupKey` under a summary, with an id
  /// derived from `deliveryId` so a duplicate send replaces rather than repeats.
  Future<void> show(NoticePush p);

  /// Removes every notification Juvi has in the tray: after a sign-out the next person on
  /// this phone must not see the previous account's titles.
  Future<void> cancelAll();

  /// The payload of the notification whose tap launched the app, if one did.
  Future<String?> launchPayload();
}

/// The default until `main()` initialises the plugin: widget tests and builds without
/// Firebase never render anything.
class NoLocalNotifications implements LocalNotifications {
  const NoLocalNotifications();
  @override
  Future<void> init({void Function(String? payload)? onTap}) async {}
  @override
  Future<void> show(NoticePush p) async {}
  @override
  Future<void> cancelAll() async {}
  @override
  Future<String?> launchPayload() async => null;
}

class PluginLocalNotifications implements LocalNotifications {
  PluginLocalNotifications(this._plugin);
  final FlutterLocalNotificationsPlugin _plugin;

  /// White on transparent (`res/drawable/ic_stat_juvi.xml`): Android 5+ draws the status-bar
  /// icon from its alpha only, so the launcher icon would show as a white square.
  static const smallIcon = '@drawable/ic_stat_juvi';

  static const Map<String, Importance> _importance = {'max': Importance.max, 'high': Importance.high, 'low': Importance.low};
  static const Map<String, Priority> _priority = {'max': Priority.max, 'high': Priority.high, 'low': Priority.low};

  @override
  Future<void> init({void Function(String? payload)? onTap}) async {
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings(smallIcon)),
      onDidReceiveNotificationResponse: onTap == null ? null : (r) => onTap(r.payload),
    );
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    for (final c in pushChannels) {
      await android?.createNotificationChannel(AndroidNotificationChannel(
        c.id,
        c.name,
        description: c.description,
        importance: _importance[c.importance]!,
        playSound: c.sound,
      ));
    }
  }

  AndroidNotificationDetails _details(PushChannel c, NoticePush p, {bool summary = false}) => AndroidNotificationDetails(
        c.id,
        c.name,
        channelDescription: c.description,
        icon: smallIcon,
        importance: _importance[c.importance]!,
        priority: _priority[c.importance]!,
        playSound: c.sound,
        groupKey: p.groupKey,
        setAsGroupSummary: summary,
        // Only the notification itself alerts; its group summary never rings a second time.
        groupAlertBehavior: GroupAlertBehavior.children,
      );

  @override
  Future<void> show(NoticePush p) async {
    final content = trayContent(p);
    final channel = channelFor(p);
    await _plugin.show(
      id: notificationIdFor(p),
      title: content.title,
      body: content.text,
      notificationDetails: NotificationDetails(android: _details(channel, p)),
      payload: p.toPayload(),
    );
    await _plugin.show(
      id: summaryIdFor(p),
      title: content.title,
      body: content.text,
      notificationDetails: NotificationDetails(android: _details(channel, p, summary: true)),
      payload: p.toPayload(),
    );
  }

  @override
  Future<void> cancelAll() => _plugin.cancelAll();

  @override
  Future<String?> launchPayload() async {
    final details = await _plugin.getNotificationAppLaunchDetails();
    return (details?.didNotificationLaunchApp ?? false) ? details?.notificationResponse?.payload : null;
  }
}
