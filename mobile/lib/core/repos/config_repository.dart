import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'config_repository.g.dart';

abstract class ConfigRepository {
  Future<Cached<AppConfigData>?> cached();
  Future<Cached<AppConfigData>> refresh();
}

class ApiConfigRepository implements ConfigRepository {
  ApiConfigRepository(this._dio, this._db);
  final Dio _dio;
  final AppDatabase _db;

  @override
  Future<Cached<AppConfigData>?> cached() async {
    final doc = await _db.readDoc('config');
    return doc == null ? null : Cached(AppConfigData.fromJson(doc.json), doc.asOf);
  }

  /// Fetches `/config` on the shared authenticated Dio rather than through
  /// `wire.MobileApi.getConfig()`: the generated `wire.Config` declares `minAppVersion`
  /// and `supportContact` non-nullable and unconditionally casts both to
  /// `Map<String, dynamic>`, even though the contract marks both `type: ["object",
  /// "null"]` — the same generator gap `auth_repository.dart`'s `lookupInstitution` and
  /// `fetchAccount` document. The real server sends both as `null` whenever there's no
  /// app-version gate or support contact configured, so `wire.Config.fromJson` throws on
  /// that (common) payload. Parsing the raw body with our own `AppConfigData` (which
  /// declares `supportContact` nullable and never looks at `minAppVersion` at all) avoids
  /// the crash.
  @override
  Future<Cached<AppConfigData>> refresh() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/config');
      final json = response.data!;
      final now = DateTime.now().toUtc();
      await _db.writeDoc('config', json, now);
      return Cached(AppConfigData.fromJson(json), now);
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
}

@Riverpod(keepAlive: true)
Future<ConfigRepository> configRepository(Ref ref) async => ApiConfigRepository(ref.read(dioProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network config; the theme reads the accent from here.
@Riverpod(keepAlive: true)
Stream<Cached<AppConfigData>> appConfig(Ref ref) async* {
  final repo = await ref.read(configRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try {
    yield await repo.refresh();
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}
