import 'dart:async';

import 'package:dio/dio.dart';
import 'package:juvi/core/env.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'api_providers.g.dart';

@Riverpod(keepAlive: true)
SecureStore secureStore(Ref ref) => SecureStore();

@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(Ref ref) async => AppDatabase.openEncrypted(await ref.read(secureStoreProvider).databaseKey());

@Riverpod(keepAlive: true)
Future<String> appVersion(Ref ref) async => (await PackageInfo.fromPlatform()).version;

/// No interceptors, no Bearer token: used for calls made before a session exists
/// (institution lookup, sign-in, refresh). `lib/core/repos/auth_repository.dart`'s
/// `lookupInstitution` also reads this directly (see its doc comment for why). Same
/// timeouts and version/platform headers as [dio], so a black-holed refresh times out.
@Riverpod(keepAlive: true)
Dio bareDio(Ref ref) => Dio(juviBaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      appVersion: ref.read(appVersionProvider).value ?? '0.0.0',
      platform: AppEnv.platform,
    ));

@Riverpod(keepAlive: true)
wire.MobileApi bareMobileApi(Ref ref) => wire.JuviApi(dio: ref.read(bareDioProvider), basePathOverride: AppEnv.apiBaseUrl).getMobileApi();

@Riverpod(keepAlive: true)
Dio dio(Ref ref) {
  final store = ref.read(secureStoreProvider);
  return buildDio(
    baseUrl: AppEnv.apiBaseUrl,
    accessToken: () async => (await store.readTokens())?.accessToken,
    refresh: () => ref.read(sessionControllerProvider.notifier).refreshTokens(),
    deviceId: store.deviceId,
    appVersion: ref.read(appVersionProvider).value ?? '0.0.0',
    platform: AppEnv.platform,
    onFatal: (f) => unawaited(ref.read(sessionControllerProvider.notifier).handleFailure(f)),
  );
}

@Riverpod(keepAlive: true)
wire.MobileApi mobileApi(Ref ref) => wire.JuviApi(dio: ref.read(dioProvider), basePathOverride: AppEnv.apiBaseUrl).getMobileApi();
