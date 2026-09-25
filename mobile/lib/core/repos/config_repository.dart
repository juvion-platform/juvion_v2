import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'config_repository.g.dart';

abstract class ConfigRepository {
  Future<Cached<AppConfigData>?> cached();
  Future<Cached<AppConfigData>> refresh();
}

class ApiConfigRepository implements ConfigRepository {
  ApiConfigRepository(this._api, this._db);
  final wire.MobileApi _api;
  final AppDatabase _db;

  @override
  Future<Cached<AppConfigData>?> cached() async {
    final doc = await _db.readDoc('config');
    return doc == null ? null : Cached(AppConfigData.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<AppConfigData>> refresh() async {
    try {
      final json = (await _api.getConfig()).data!.toJson();
      final now = DateTime.now().toUtc();
      await _db.writeDoc('config', json, now);
      return Cached(AppConfigData.fromJson(json), now);
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
}

@Riverpod(keepAlive: true)
Future<ConfigRepository> configRepository(Ref ref) async => ApiConfigRepository(ref.read(mobileApiProvider), await ref.read(appDatabaseProvider.future));

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
