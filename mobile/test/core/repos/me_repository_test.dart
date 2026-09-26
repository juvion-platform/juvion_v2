import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:mocktail/mocktail.dart';

class _MeRepo extends Mock implements MeRepository {}

class _NoopAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {}
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
}
