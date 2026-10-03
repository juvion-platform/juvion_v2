import 'package:flutter/foundation.dart';

/// Where crashes go (Crashlytics in the app, `firebase_crash_sink.dart`; a fake in tests).
abstract class CrashSink {
  Future<void> setCollectionEnabled({required bool enabled});
  void recordFlutterFatalError(FlutterErrorDetails details);
  void recordError(Object error, StackTrace stack);
}

/// Crash reporting (notifications spec §8.6): collection is on only when [enabled] (`main()`
/// passes `!kDebugMode`), and only then are `FlutterError.onError` and
/// `PlatformDispatcher.instance.onError` routed to [sink]. Nothing identifies the person:
/// no user id and no custom keys are ever set.
Future<void> installCrashReporting(CrashSink sink, {required bool enabled}) async {
  await sink.setCollectionEnabled(enabled: enabled);
  if (!enabled) return;
  FlutterError.onError = sink.recordFlutterFatalError;
  PlatformDispatcher.instance.onError = (error, stack) {
    sink.recordError(error, stack);
    return true;
  };
}
