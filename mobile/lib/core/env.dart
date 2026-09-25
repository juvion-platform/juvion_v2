import 'dart:io' show Platform;

class AppEnv {
  /// Android emulator reaches the host at 10.0.2.2; override with --dart-define.
  static const apiBaseUrl = String.fromEnvironment(
    'JUVI_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3003/api/juvi-app/v1',
  );
  static String get platform => Platform.isIOS ? 'ios' : 'android';
}
