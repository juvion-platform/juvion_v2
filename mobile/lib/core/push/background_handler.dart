// mobile/lib/core/push/background_handler.dart
import 'dart:ui' show DartPluginRegistrant;

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:package_info_plus/package_info_plus.dart';

/// FCM's background entry point (spec §8.2), registered in `main()` with
/// `FirebaseMessaging.onBackgroundMessage`. It runs in its own isolate, often after the app
/// was killed, with no providers, no database and usually an expired access token — so it
/// builds a plain Dio on the compile-time base URL and posts the HMAC receipt without a
/// session.
///
/// Ruling R4: the plugins it uses (package_info_plus, flutter_local_notifications,
/// shared_preferences) register their Dart implementations only once
/// `DartPluginRegistrant.ensureInitialized()` has run in this isolate; without it the
/// permission check answers "allowed" and the tray calls do nothing, so `delivered` would be
/// claimed for a notification nobody saw. Nothing may escape the isolate.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) => runInBackgroundIsolate(() async {
      DartPluginRegistrant.ensureInitialized();
      String version;
      try {
        version = (await PackageInfo.fromPlatform()).version;
      } on Object {
        version = '0.0.0';
      }
      final dio = Dio(juviBaseOptions(baseUrl: AppEnv.apiBaseUrl, appVersion: version, platform: AppEnv.platform));
      final api = wire.JuviApi(dio: dio, basePathOverride: AppEnv.apiBaseUrl).getMobileApi();
      final local = PluginLocalNotifications(FlutterLocalNotificationsPlugin());
      await local.init();
      await handleBackgroundPush(
        message.data,
        local: local,
        receipts: Receipts(api, ReceiptQueue()),
        allowed: const PluginNotificationPermission().isGranted,
      );
    });
