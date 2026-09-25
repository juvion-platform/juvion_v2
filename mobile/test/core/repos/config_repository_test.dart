import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/config_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/app_database.dart';

const Map<String, dynamic> _configJson = {
  'name': 'JIT College',
  'code': 'JIT',
  'logoUrl': null,
  'accentColor': '#0B5FA5',
  'supportContact': null,
  'quietHoursDefault': {'start': '22:00', 'end': '07:00'},
  'timezone': 'Asia/Kolkata',
  'featureFlags': {'languageRoadmap': false},
  'minAppVersion': null,
  'onboardingSteps': ['identity', 'spaces', 'notifications'],
};

const _account = AccountSummary(
  id: 'a',
  kind: 'student',
  status: 'active',
  onboardingStep: 3,
  onboardingSteps: ['identity', 'spaces', 'notifications'],
  onboardingComplete: true,
  mustChangePassword: false,
);

class _Session extends SessionController {
  _Session(this._initial);
  final SessionState _initial;
  @override
  SessionState build() => _initial;
  // A test hook mirroring the controller's own state transitions, not a property.
  // ignore: use_setters_to_change_properties
  void set(SessionState s) => state = s;
}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late AppDatabase db;
  late ApiConfigRepository repo;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    adapter = DioAdapter(dio: dio);
    db = AppDatabase.memory();
    repo = ApiConfigRepository(dio, db);
  });
  tearDown(() => db.close());

  group('refresh', () {
    // R61: this is the payload the real server actually sends whenever there's no
    // app-version gate or support contact configured — the common case, not an edge
    // case. Parsing it through the generated `wire.MobileApi.getConfig()` throws,
    // because `wire.Config` declares `minAppVersion`/`supportContact` non-nullable even
    // though the contract marks both `type: ["object", "null"]`. `refresh` reads the raw
    // Dio instead specifically so this payload parses.
    test('parses a payload with minAppVersion and supportContact null', () async {
      adapter.onGet(
        '/config',
        (s) => s.reply(200, {
          'name': 'JIT College',
          'code': 'JIT',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'supportContact': null,
          'quietHoursDefault': {'start': '22:00', 'end': '07:00'},
          'timezone': 'Asia/Kolkata',
          'featureFlags': {'languageRoadmap': false},
          'minAppVersion': null,
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
        }),
      );
      final cached = await repo.refresh();
      expect(cached.data.name, 'JIT College');
      expect(cached.data.supportContact, isNull);
    });

    test('parses a payload with minAppVersion and supportContact populated', () async {
      adapter.onGet(
        '/config',
        (s) => s.reply(200, {
          'name': 'JIT College',
          'code': 'JIT',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'supportContact': {'name': 'Office', 'phone': '080-1234', 'email': 'office@jit.test'},
          'quietHoursDefault': {'start': '22:00', 'end': '07:00'},
          'timezone': 'Asia/Kolkata',
          'featureFlags': {'languageRoadmap': true},
          'minAppVersion': {'android': '1.2.0', 'ios': '1.2.0'},
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
        }),
      );
      final cached = await repo.refresh();
      expect(cached.data.supportContact?.name, 'Office');
      expect(cached.data.supportContact?.phone, '080-1234');
    });

    test('caches the response so a later cached() read sees it', () async {
      adapter.onGet(
        '/config',
        (s) => s.reply(200, {
          'name': 'JIT College',
          'code': 'JIT',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'supportContact': null,
          'quietHoursDefault': {'start': '22:00', 'end': '07:00'},
          'timezone': 'Asia/Kolkata',
          'featureFlags': {'languageRoadmap': false},
          'minAppVersion': null,
          'onboardingSteps': ['identity', 'spaces', 'notifications'],
        }),
      );
      await repo.refresh();
      final cached = await repo.cached();
      expect(cached?.data.name, 'JIT College');
    });

    test('a 500 surfaces as an ApiFailure', () async {
      adapter.onGet(
        '/config',
        (s) => s.reply(500, {
          'error': {'code': 'INTERNAL', 'message': 'Server exploded'},
        }),
      );
      await expectLater(
        repo.refresh(),
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.internal)),
      );
    });
  });

  group('appConfigProvider', () {
    late List<String> requested;
    late _Session session;

    ProviderContainer containerFor(SessionState initial) {
      requested = [];
      dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
        requested.add(o.path);
        h.next(o);
      }));
      adapter.onGet('/config', (s) => s.reply(200, _configJson));
      session = _Session(initial);
      final c = ProviderContainer(
        retry: (_, _) => null,
        overrides: [
          dioProvider.overrideWithValue(dio),
          appDatabaseProvider.overrideWith((_) async => db),
          sessionControllerProvider.overrideWith(() => session),
        ],
      );
      addTearDown(c.dispose);
      return c;
    }

    // I1: `/config` needs a session; fetching it signed out gets a 401
    // SESSION_INVALIDATED, which the auth interceptor turns into a wipe and a
    // "Please sign in again." for a first-time user.
    test('while signed out, no /config request is made', () async {
      containerFor(const SessionState.signedOut()).listen(appConfigProvider, (_, _) {});
      await pumpEventQueue();
      expect(requested, isEmpty);
    });

    test('while signed out, the cached doc is still served', () async {
      await db.writeDoc('config', _configJson, DateTime.utc(2026));
      final c = containerFor(const SessionState.signedOut())..listen(appConfigProvider, (_, _) {});
      await pumpEventQueue();
      expect(c.read(appConfigProvider).value?.data.accentColor, '#0B5FA5');
      expect(requested, isEmpty);
    });

    test('signing in fetches /config', () async {
      final c = containerFor(const SessionState.signedOut())..listen(appConfigProvider, (_, _) {});
      await pumpEventQueue();
      expect(requested, isEmpty);
      session.set(const SessionState.signedIn(_account));
      await pumpEventQueue();
      expect(requested, ['/config']);
      expect(c.read(appConfigProvider).value?.data.name, 'JIT College');
    });
  });
}
