import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:intl/date_symbol_data_local.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/crash/crash_reporting.dart';
import 'package:juvi/core/crash/firebase_crash_sink.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/push/background_handler.dart';
import 'package:juvi/core/push/firebase_push.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/push_messaging.dart';
import 'package:juvi/core/session/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  // R42: disable Riverpod 3's automatic provider retry; the app owns retry UX.
  final container = ProviderContainer(retry: (_, _) => null, overrides: await _startFirebase());
  // R52: the Dio built for the first request must carry the real app version,
  // not the "0.0.0" fallback, so this resolves before restore() (which can make
  // a network call on a cache miss) and before runApp.
  await container.read(appVersionProvider.future);
  // Cached state renders before any network round-trip (spec §11). restore() never
  // throws (unreadable storage or cache ends signed out), so runApp is always reached.
  await container.read(sessionControllerProvider.notifier).restore();
  runApp(UncontrolledProviderScope(container: container, child: const JuviApp()));
}

/// Firebase, Crashlytics and push (notifications spec §8). Any failure — no
/// google-services.json values, no Play services — leaves push inert and the app running:
/// the providers keep their no-op defaults.
Future<List<Override>> _startFirebase() async {
  try {
    await Firebase.initializeApp();
    await installCrashReporting(FirebaseCrashSink(), enabled: !kDebugMode);
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    return [
      pushMessagingProvider.overrideWithValue(FirebasePushMessaging()),
      localNotificationsProvider.overrideWithValue(PluginLocalNotifications(FlutterLocalNotificationsPlugin())),
    ];
  } on Object catch (e) {
    debugPrint('Push is off: Firebase did not start ($e)');
    return const [];
  }
}
