import 'dart:async';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:juvi/core/crash/crash_reporting.dart';

/// Crashlytics behind [CrashSink]. Constructed only in `main()`, after `Firebase.initializeApp()`.
class FirebaseCrashSink implements CrashSink {
  FirebaseCrashSink([FirebaseCrashlytics? crashlytics]) : _c = crashlytics ?? FirebaseCrashlytics.instance;
  final FirebaseCrashlytics _c;

  @override
  Future<void> setCollectionEnabled({required bool enabled}) => _c.setCrashlyticsCollectionEnabled(enabled);
  @override
  void recordFlutterFatalError(FlutterErrorDetails details) => unawaited(_c.recordFlutterFatalError(details));
  @override
  void recordError(Object error, StackTrace stack) => unawaited(_c.recordError(error, stack, fatal: true));
}
