import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/crash/crash_reporting.dart';

class _Sink implements CrashSink {
  bool? enabled;
  final flutterErrors = <FlutterErrorDetails>[];
  final errors = <Object>[];
  @override
  Future<void> setCollectionEnabled({required bool enabled}) async => this.enabled = enabled;
  @override
  void recordFlutterFatalError(FlutterErrorDetails details) => flutterErrors.add(details);
  @override
  void recordError(Object error, StackTrace stack) => errors.add(error);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('debug builds: collection off and the error hooks untouched', () async {
    final before = FlutterError.onError;
    final sink = _Sink();
    await installCrashReporting(sink, enabled: false);
    expect(sink.enabled, isFalse);
    expect(FlutterError.onError, same(before));
  });

  test('release builds: Flutter and platform errors reach the sink', () async {
    final flutterBefore = FlutterError.onError;
    final platformBefore = PlatformDispatcher.instance.onError;
    try {
      final sink = _Sink();
      await installCrashReporting(sink, enabled: true);
      expect(sink.enabled, isTrue);
      FlutterError.onError!(FlutterErrorDetails(exception: StateError('build')));
      expect(PlatformDispatcher.instance.onError!(StateError('async'), StackTrace.current), isTrue);
      expect(sink.flutterErrors.single.exception, isA<StateError>());
      expect(sink.errors.single, isA<StateError>());
    } finally {
      FlutterError.onError = flutterBefore;
      PlatformDispatcher.instance.onError = platformBefore;
    }
  });
}
