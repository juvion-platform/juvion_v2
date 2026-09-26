import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi_api/juvi_api.dart' as wire;

void main() {
  late Dio bareDio;
  late DioAdapter adapter;
  late ApiAuthRepository repo;

  setUp(() {
    bareDio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    adapter = DioAdapter(dio: bareDio);
    // Only `lookupInstitution` (backed by `bareDio`) is under test here; the other three
    // constructor args are never exercised by these tests.
    repo = ApiAuthRepository(wire.MobileApi(Dio()), wire.MobileApi(Dio()), Dio(), bareDio);
  });

  group('lookupInstitution', () {
    // R61: this is the payload the real server actually sends whenever there's no
    // app-version gate configured — the common case, not an edge case. Parsing it
    // through the generated `wire.MobileApi.lookupInstitution()` throws, because
    // `wire.InstitutionLookup` declares `minAppVersion` non-nullable even though the
    // contract marks it `type: ["object", "null"]`. `lookupInstitution` reads the raw
    // Dio instead specifically so this payload parses.
    test('parses a payload with minAppVersion null', () async {
      adapter.onGet(
        '/institutions/JIT',
        (s) => s.reply(200, {
          'collegeId': 'c1',
          'name': 'JIT College',
          'logoUrl': null,
          'accentColor': '#0B5FA5',
          'paused': false,
          'pausedMessage': null,
          'minAppVersion': null,
        }),
      );
      final identity = await repo.lookupInstitution('jit');
      expect(identity.collegeId, 'c1');
      expect(identity.name, 'JIT College');
      expect(identity.paused, isFalse);
      expect(identity.logoUrl, isNull);
    });

    test('parses a payload with minAppVersion populated', () async {
      adapter.onGet(
        '/institutions/JIT',
        (s) => s.reply(200, {
          'collegeId': 'c1',
          'name': 'JIT College',
          'logoUrl': 'https://cdn.example/logo.png',
          'accentColor': '#0B5FA5',
          'paused': true,
          'pausedMessage': 'Back Monday',
          'minAppVersion': {'android': '1.2.0', 'ios': '1.2.0'},
        }),
      );
      final identity = await repo.lookupInstitution('jit');
      expect(identity.paused, isTrue);
      expect(identity.pausedMessage, 'Back Monday');
      expect(identity.logoUrl, 'https://cdn.example/logo.png');
    });

    test('uppercases and trims the code to build the path', () async {
      adapter.onGet(
        '/institutions/JIT',
        (s) => s.reply(200, {
          'collegeId': 'c1',
          'name': 'JIT College',
          'logoUrl': null,
          'accentColor': null,
          'paused': false,
          'pausedMessage': null,
          'minAppVersion': null,
        }),
      );
      final identity = await repo.lookupInstitution('  jit  ');
      expect(identity.collegeId, 'c1');
    });

    test('a 404 surfaces as an ApiFailure', () async {
      adapter.onGet(
        '/institutions/NOPE',
        (s) => s.reply(404, {
          'error': {'code': 'NOT_FOUND', 'message': "We couldn't find that college code."},
        }),
      );
      await expectLater(
        repo.lookupInstitution('nope'),
        throwsA(isA<ApiFailure>().having((f) => f.code, 'code', ApiErrorCode.notFound)),
      );
    });
  });
}
