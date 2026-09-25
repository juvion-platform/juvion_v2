import 'package:dio/dio.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'me_repository.g.dart';

abstract class MeRepository {
  Future<Cached<Me>?> cached();
  Future<Cached<Me>> refresh();
  Future<Settings> updateSettings(Map<String, dynamic> patch);
  Future<OnboardingStateData> advanceOnboarding(int step);
  Future<List<DeviceRow>> devices();
  Future<void> revokeDevice(String sessionId);
  Future<int> revokeOtherDevices();
  Future<String?> uploadPhoto(List<int> bytes, String filename);
}

class ApiMeRepository implements MeRepository {
  ApiMeRepository(this._api, this._dio, this._db);
  final wire.MobileApi _api;
  final Dio _dio;
  final AppDatabase _db;

  Future<T> _guard<T>(Future<T> Function() f) async {
    try {
      return await f();
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Cached<Me>?> cached() async {
    final doc = await _db.readDoc('me');
    return doc == null ? null : Cached(Me.fromJson(doc.json), doc.asOf);
  }

  /// Fetches `/me` on the shared authenticated Dio rather than through
  /// `wire.MobileApi.getMe()`. The generated `wire.Me` declares `student`/`faculty`
  /// (and `institution.supportContact`) non-nullable and unconditionally casts them
  /// to `Map<String, dynamic>`, even though the contract marks all three
  /// `type: ["object", "null"]` — a generator gap for nullable object properties (see
  /// task-7-report.md). Since exactly one of `student`/`faculty` is null on every real
  /// account, `wire.Me.fromJson` throws a TypeError on every real payload. Parsing the
  /// raw body with our own (correctly nullable) `Me` model avoids that crash; the
  /// authenticated `dio` provider still carries the same auth/refresh/error-mapping
  /// interceptor `wire.MobileApi` uses, so failures surface as the same `ApiFailure`s.
  @override
  Future<Cached<Me>> refresh() => _guard(() async {
        final response = await _dio.get<Map<String, dynamic>>('/me');
        final json = response.data!;
        final asOf = DateTime.tryParse(json['asOf'] as String? ?? '')?.toUtc() ?? DateTime.now().toUtc();
        await _db.writeDoc('me', json, asOf);
        return Cached(Me.fromJson(json), asOf);
      });

  @override
  Future<Settings> updateSettings(Map<String, dynamic> patch) => _guard(() async {
        final r = await _api.updateSettings(settingsPatch: wire.SettingsPatch.fromJson(patch));
        final settings = Settings.fromJson(r.data!.toJson());
        final doc = await _db.readDoc('me');
        if (doc != null) await _db.writeDoc('me', {...doc.json, 'settings': settings.toJson()}, doc.asOf);
        return settings;
      });

  @override
  Future<OnboardingStateData> advanceOnboarding(int step) => _guard(() async {
        final r = await _api.advanceOnboarding(onboardingAdvance: wire.OnboardingAdvance(step: step));
        return OnboardingStateData.fromJson(r.data!.toJson());
      });

  @override
  Future<List<DeviceRow>> devices() => _guard(() async {
        final json = (await _api.listDevices()).data!.toJson();
        return (json['items'] as List).map((e) => DeviceRow.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      });

  @override
  Future<void> revokeDevice(String sessionId) => _guard(() async {
        await _api.revokeDevice(id: sessionId);
      });

  @override
  Future<int> revokeOtherDevices() => _guard(() async => (await _api.revokeOtherDevices()).data!.revoked);

  /// Uploads the photo on the shared authenticated Dio rather than through
  /// `wire.MobileApi.uploadPhoto()`: its generated body-building branch never assigns
  /// the required `file` parameter to the request body (a generator gap for this
  /// multipart/binary request — see task-7-report.md), so calling it sends an empty
  /// body. Building the `FormData` ourselves is the only way this endpoint works.
  @override
  Future<String?> uploadPhoto(List<int> bytes, String filename) => _guard(() async {
        final form = FormData.fromMap({'file': MultipartFile.fromBytes(bytes, filename: filename)});
        final response = await _dio.post<Map<String, dynamic>>('/me/photo', data: form);
        final url = response.data?['photoUrl'] as String?;
        final doc = await _db.readDoc('me');
        if (doc != null) {
          await _db.writeDoc('me', {...doc.json, 'person': {...(doc.json['person'] as Map), 'photoUrl': url}}, doc.asOf);
        }
        return url;
      });
}

@Riverpod(keepAlive: true)
Future<MeRepository> meRepository(Ref ref) async =>
    ApiMeRepository(ref.read(mobileApiProvider), ref.read(dioProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network. A fresh /me also refreshes the session's account summary.
@riverpod
Stream<Cached<Me>> me(Ref ref) async* {
  final repo = await ref.read(meRepositoryProvider.future);
  final c = await repo.cached();
  if (c != null) yield c;
  try {
    final fresh = await repo.refresh();
    await ref.read(sessionControllerProvider.notifier).updateAccount(fresh.data.account);
    yield fresh;
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

/// Optimistic settings with an offline queue (spec §11 pending actions).
@riverpod
class SettingsController extends _$SettingsController {
  @override
  Future<Settings?> build() async => (await ref.watch(meProvider.future)).data.settings;

  Future<void> patch(Map<String, dynamic> p) async {
    final repo = await ref.read(meRepositoryProvider.future);
    final current = state.value;
    final optimistic = current == null ? null : _merge(current, p);
    if (optimistic != null) state = AsyncData(optimistic);
    ref.read(analyticsProvider).track('settings.changed', {'key': p.keys.join(',')});
    try {
      state = AsyncData(await repo.updateSettings(p));
    } on ApiFailure catch (f) {
      if (f.isOffline) {
        final db = await ref.read(appDatabaseProvider.future);
        await db.enqueueAction(PendingAction.create('settings.patch', p));
        // Like `toggleMute`: write the optimistic value into the cached `me` doc, so the
        // rebuild after `invalidate` below reads it back instead of the old settings.
        final doc = await db.readDoc('me');
        if (doc != null && optimistic != null) {
          await db.writeDoc('me', {...doc.json, 'settings': optimistic.toJson()}, doc.asOf);
        }
      } else {
        state = AsyncData(current);
        rethrow;
      }
    }
    ref.invalidate(meProvider);
  }

  Settings _merge(Settings s, Map<String, dynamic> p) => Settings(
        quietHours: p['quietHours'] != null ? QuietHours.fromJson(Map<String, dynamic>.from(p['quietHours'] as Map)) : s.quietHours,
        tiers: Tiers(
          important: (p['tiers'] as Map?)?['important'] as bool? ?? s.tiers.important,
          routine: (p['tiers'] as Map?)?['routine'] as bool? ?? s.tiers.routine,
        ),
        language: p['language'] as String? ?? s.language,
      );
}
