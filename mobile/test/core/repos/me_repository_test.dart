import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:mocktail/mocktail.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

class _MeRepo extends Mock implements MeRepository {}

/// A database whose reads fail — standing in for a locked or full local store at the moment a 204
/// arrives, which is the only way to reach the cache-write failure without racing the real one.
class _BrokenDb extends Mock implements AppDatabase {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
}

class _SpyAnalytics implements Analytics {
  final events = <(String, Map<String, Object?>)>[];
  @override
  void track(String event, [Map<String, Object?> props = const {}]) => events.add((event, props));
}

const Map<String, dynamic> meJson = {
  'account': {
    'id': 'a',
    'kind': 'student',
    'status': 'onboarding',
    'onboardingStep': 0,
    'onboardingSteps': ['identity', 'spaces', 'notifications'],
    'onboardingComplete': false,
    'mustChangePassword': false,
  },
  'person': {'name': 'Aditya Nair', 'firstName': 'Aditya', 'photoUrl': null},
  'student': {
    'rollNumber': '24JIT0001',
    'programme': 'B.Tech',
    'branch': 'CSE',
    'batch': '2024 Batch',
    'section': 'A',
    'department': 'Computer Science',
    'hostel': null,
    'isLateralEntry': false,
  },
  'faculty': null,
  'settings': {
    'quietHours': {'start': '22:00', 'end': '07:00'},
    'tiers': {'important': true, 'routine': true},
    'language': 'en',
  },
  'institution': {'name': 'JIT', 'code': 'JIT', 'logoUrl': null, 'accentColor': '#0B5FA5', 'supportContact': {'name': 'Office'}, 'timezone': 'Asia/Kolkata'},
  'asOf': '2026-09-23T08:14:00+05:30',
};

void main() {
  test('Me parses the /me payload, including nulls', () {
    final me = Me.fromJson(meJson);
    expect(me.person.firstName, 'Aditya');
    expect(me.student?.section, 'A');
    expect(me.faculty, isNull);
    expect(me.settings.tiers.routine, isTrue);
    expect(me.institution.supportContact?.name, 'Office');
    expect(me.toJson()['student'], isA<Map<String, dynamic>>());
  });

  // 011 T14 — the deletion banner's trigger has to survive parsing *here*, not just on the wire
  // model: /me is parsed into this local freezed `Me` (see `me_repository.dart`), and freezed drops
  // unknown keys silently, so a server-only field leaves the banner permanently dark with no error
  // anywhere to notice.
  test('Me exposes the nullable deletion-request fields', () {
    final pending = Me.fromJson({
      ...meJson,
      'deletionRequestedAt': '2026-11-03T04:00:00.000Z',
      'deletionRequestedVia': 'public_web',
    });
    expect(pending.deletionRequestedAt, '2026-11-03T04:00:00.000Z');
    expect(pending.deletionRequestedVia, 'public_web');

    // R61: an account with no request gets a real `null` from the server, for the key as well as the
    // value — so mock and assert `null`, never an omitted key.
    final none = Me.fromJson({...meJson, 'deletionRequestedAt': null, 'deletionRequestedVia': null});
    expect(none.deletionRequestedAt, isNull);
    expect(none.deletionRequestedVia, isNull);
  });

  // I3: offline, the optimistic value must survive the `meProvider` rebuild the patch
  // triggers; otherwise the switch snaps back and a second tap queues the opposite value.
  test('an offline settings patch keeps the new value and queues one action', () async {
    const offline = ApiFailure(ApiErrorCode.offline, "You're offline.");
    final db = AppDatabase.memory();
    addTearDown(db.close);
    await db.writeDoc('me', meJson, DateTime.utc(2026, 9, 23));
    final repo = _MeRepo();
    when(repo.cached).thenAnswer((_) async {
      final doc = await db.readDoc('me');
      return Cached(Me.fromJson(doc!.json), doc.asOf);
    });
    when(repo.refresh).thenThrow(offline);
    when(() => repo.updateSettings(any())).thenThrow(offline);
    final c = ProviderContainer(
      retry: (_, _) => null,
      overrides: [
        meRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(_NoopAnalytics()),
      ],
    );
    addTearDown(c.dispose);
    c
      ..listen(settingsControllerProvider, (_, _) {})
      ..listen(meProvider, (_, _) {});
    expect((await c.read(settingsControllerProvider.future))?.tiers.routine, isTrue);

    await c.read(settingsControllerProvider.notifier).patch({
      'tiers': {'routine': false},
    });
    await pumpEventQueue();

    expect(c.read(settingsControllerProvider).value?.tiers.routine, isFalse);
    expect(c.read(meProvider).value?.data.settings.tiers.routine, isFalse);
    final queued = await db.pendingActions();
    expect(queued, hasLength(1));
    expect(queued.single.type, 'settings.patch');
  });

  // The server takes one id-like `key` per event (§7.3); a comma-joined list would be dropped.
  test('a settings patch records settings.changed once per changed key', () async {
    const offline = ApiFailure(ApiErrorCode.offline, "You're offline.");
    final db = AppDatabase.memory();
    addTearDown(db.close);
    await db.writeDoc('me', meJson, DateTime.utc(2026, 9, 23));
    final repo = _MeRepo();
    when(repo.cached).thenAnswer((_) async {
      final doc = await db.readDoc('me');
      return Cached(Me.fromJson(doc!.json), doc.asOf);
    });
    when(repo.refresh).thenThrow(offline);
    when(() => repo.updateSettings(any())).thenThrow(offline);
    final analytics = _SpyAnalytics();
    final c = ProviderContainer(
      retry: (_, _) => null,
      overrides: [
        meRepositoryProvider.overrideWith((_) async => repo),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(analytics),
      ],
    );
    addTearDown(c.dispose);
    c
      ..listen(settingsControllerProvider, (_, _) {})
      ..listen(meProvider, (_, _) {});
    await c.read(settingsControllerProvider.future);

    await c.read(settingsControllerProvider.notifier).patch({
      'tiers': {'routine': false},
      'quietHours': {'start': '23:00', 'end': '06:00'},
    });
    await pumpEventQueue();

    expect([for (final (name, _) in analytics.events) name], ['settings.changed', 'settings.changed']);
    expect([for (final (_, props) in analytics.events) props], [
      {'key': 'tiers'},
      {'key': 'quietHours'},
    ]);
  });

  // 011 T21. The banner's trigger is the cached `me` document, and what makes it go away is this
  // write — not a lucky second `GET /me`: the 204 is the server's confirmation that it cleared
  // `deletionRequestedAt`, so the device stops showing the request in the same breath. A 409 (or
  // anything else) never reaches the write, which is why a too-late cancel leaves the banner up.
  group('cancelAccountDeletion', () {
    const requested = '2026-11-03T04:00:00.000Z';
    const serverTooLate = 'This deletion is already being processed and can no longer be cancelled.';

    late AppDatabase db;
    late ProviderContainer c;

    Future<void> open({AppDatabase? failing}) async {
      db = failing ?? AppDatabase.memory();
      if (failing == null) addTearDown(db.close);
      final storage = _Storage();
      when(() => storage.read(key: any(named: 'key'))).thenAnswer((_) async => null);
      // The authenticated Dio's interceptor stamps `X-Juvi-Device-Id` on every request, and
      // `SecureStore.deviceId()` mints one on first use — an unstubbed `write` here does not
      // surface as a storage error, it surfaces as a response-less `DioException` that
      // `ApiFailure.fromDio` reports as `offline`, i.e. a test failure that names the wrong cause.
      when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((_) async {});
      when(() => storage.delete(key: any(named: 'key'))).thenAnswer((_) async {});
      await db.writeDoc('me', {...meJson, 'deletionRequestedAt': requested, 'deletionRequestedVia': 'public_web'}, DateTime.utc(2026, 10, 9));
      c = ProviderContainer(retry: (_, _) => null, overrides: [
        secureStoreProvider.overrideWithValue(SecureStore(storage)),
        appDatabaseProvider.overrideWith((_) async => db),
        analyticsProvider.overrideWithValue(_NoopAnalytics()),
      ]);
      addTearDown(c.dispose);
    }

    Future<MeRepository> repoWith(void Function(DioAdapter) route) async {
      route(DioAdapter(dio: c.read(dioProvider)));
      return c.read(meRepositoryProvider.future);
    }

    Future<Map<String, dynamic>> cachedJson() async => (await db.readDoc('me'))!.json;

    test('a 204 clears the request fields and leaves the rest of the document alone', () async {
      await open();
      final repo = await repoWith((a) => a.onDelete('/me/account/deletion-request', (s) => s.reply(204, null)));

      await repo.cancelAccountDeletion();

      final json = await cachedJson();
      expect(json['deletionRequestedAt'], isNull);
      expect(json['deletionRequestedVia'], isNull);
      // Only the request goes: everything else in the document survives the write.
      expect((json['account'] as Map)['id'], 'a');
      expect(((json['settings'] as Map)['tiers'] as Map)['routine'], isTrue);
    });

    test('a 409 DELETION_NOT_CANCELLABLE throws and leaves the cached request untouched', () async {
      await open();
      final repo = await repoWith((a) => a.onDelete(
            '/me/account/deletion-request',
            (s) => s.reply(409, {
              'error': {'code': 'DELETION_NOT_CANCELLABLE', 'message': serverTooLate},
            }),
          ));

      await expectLater(
        repo.cancelAccountDeletion(),
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.deletionNotCancellable)),
      );

      final json = await cachedJson();
      expect(json['deletionRequestedAt'], requested);
      expect(json['deletionRequestedVia'], 'public_web');
    });

    test('an offline cancel throws and leaves the cached request untouched', () async {
      await open();
      final repo = await repoWith((a) => a.onDelete(
            '/me/account/deletion-request',
            (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
          ));

      await expectLater(
        repo.cancelAccountDeletion(),
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.offline)),
      );

      final json = await cachedJson();
      expect(json['deletionRequestedAt'], requested);
    });

    // The 204 has already cancelled the request, irreversibly. The cache write that follows only
    // stops this device showing a request the server has cleared, so a storage fault there is a
    // *cache* failure and must not be dressed up as a cancel failure: left inside `_guard`, the
    // thrown `SqliteException` would surface as `ApiFailure(unknown, e.toString())` and be rendered
    // verbatim under the banner, telling the user their cancel did not happen when it did.
    test('a 204 whose local cache write fails is still a success', () async {
      final broken = _BrokenDb();
      // `open()` seeds the document through the same database, so the write has to work; it is the
      // *read* that is broken, which is the first thing the cancel's cache step does.
      when(() => broken.writeDoc(any(), any(), any())).thenAnswer((_) async {});
      when(() => broken.readDoc(any())).thenThrow(StateError('database is locked'));
      await open(failing: broken);
      final repo = await repoWith((a) => a.onDelete('/me/account/deletion-request', (s) => s.reply(204, null)));

      await repo.cancelAccountDeletion(); // completes; does not throw

      verify(() => broken.readDoc('me')).called(1);
    });
  });
}
