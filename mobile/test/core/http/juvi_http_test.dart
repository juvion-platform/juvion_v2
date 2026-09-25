import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/juvi_http.dart';
import 'package:juvi/core/models/models.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  String? token;
  var refreshes = 0;
  ApiFailure? fatal;
  var fatalCalls = 0;

  setUp(() {
    token = 'old';
    refreshes = 0;
    fatal = null;
    fatalCalls = 0;
    dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => token,
      refresh: () async {
        refreshes++;
        token = 'new';
        return const Tokens(accessToken: 'new', refreshToken: 'r2');
      },
      deviceId: () async => 'dev-1',
      appVersion: '1.0.0',
      platform: 'android',
      onFatal: (f) {
        fatal = f;
        fatalCalls++;
      },
    );
    adapter = DioAdapter(dio: dio);
  });

  test('sends the mobile headers', () async {
    adapter.onGet('/me', (s) => s.reply(200, {'ok': true}), headers: {
      'Authorization': 'Bearer old',
      'X-Juvi-App-Version': '1.0.0',
      'X-Juvi-Platform': 'android',
      'X-Juvi-Device-Id': 'dev-1',
    });
    final r = await dio.get<Map<String, dynamic>>('/me');
    expect(r.data, {'ok': true});
  });

  test('refreshes once on TOKEN_EXPIRED and replays with the new token', () async {
    // http_mock_adapter evaluates the registration callback once, at
    // registration time (`onGet` calls it immediately to configure a fixed
    // `reply()`), not per incoming request — so a `calls`-counter closure that
    // branches on its own invocation count can't distinguish "first call" from
    // "replay". Registering two mocks differentiated by the Authorization
    // header (which genuinely changes between the original request and the
    // post-refresh replay) is the mechanism this adapter version actually
    // supports; `replyCallback`'s data callback *is* invoked per request, so it
    // still gives an accurate dispatch count.
    var calls = 0;
    adapter
      ..onGet(
        '/me',
        (s) => s.replyCallback(401, (options) {
          calls++;
          return {
            'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
          };
        }),
        headers: {'Authorization': 'Bearer old'},
      )
      ..onGet(
        '/me',
        (s) => s.replyCallback(200, (options) {
          calls++;
          return {'ok': true};
        }),
        headers: {'Authorization': 'Bearer new'},
      );
    final r = await dio.get<Map<String, dynamic>>('/me');
    expect(r.data, {'ok': true});
    expect(refreshes, 1);
    expect(calls, 2);
  });

  test('SESSION_INVALIDATED is fatal and surfaces as ApiFailure', () async {
    adapter.onGet(
      '/spaces',
      (s) => s.reply(401, {
        'error': {'code': 'SESSION_INVALIDATED', 'message': 'x', 'reason': 'signed_out_elsewhere'},
      }),
    );
    try {
      await dio.get<void>('/spaces');
      fail('should throw');
    } on DioException catch (e) {
      final f = ApiFailure.of(e);
      expect(f.code, ApiErrorCode.sessionInvalidated);
      expect(f.reason, 'signed_out_elsewhere');
    }
    expect(fatal?.code, ApiErrorCode.sessionInvalidated);
    expect(refreshes, 0);
  });

  test('a failed refresh turns into SESSION_INVALIDATED', () async {
    dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => 'old',
      refresh: () async => null,
      deviceId: () async => 'd',
      appVersion: '1',
      platform: 'ios',
      onFatal: (f) => fatal = f,
    );
    adapter = DioAdapter(dio: dio)
      ..onGet(
        '/me',
        (s) => s.reply(401, {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
        }),
      );
    await expectLater(dio.get<void>('/me'), throwsA(isA<DioException>()));
    expect(fatal?.code, ApiErrorCode.sessionInvalidated);
  });

  test('two concurrent requests that both hit TOKEN_EXPIRED share a single refresh', () async {
    // Both requests are in flight before either fails, so both are sent with
    // the pre-refresh token; both then 401. QueuedInterceptorsWrapper
    // serialises onError, so whichever reaches it first performs the refresh,
    // and the other — finding the access token has already moved on — must
    // reuse it instead of refreshing again.
    for (final path in ['/a', '/b']) {
      adapter
        ..onGet(
          path,
          (s) => s.reply(401, {
            'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
          }),
          headers: {'Authorization': 'Bearer old'},
        )
        ..onGet(
          path,
          (s) => s.reply(200, {'ok': path}),
          headers: {'Authorization': 'Bearer new'},
        );
    }

    final results = await Future.wait([
      dio.get<Map<String, dynamic>>('/a'),
      dio.get<Map<String, dynamic>>('/b'),
    ]);

    expect(results[0].data, {'ok': '/a'});
    expect(results[1].data, {'ok': '/b'});
    expect(refreshes, 1);
  });

  test('a refresh that throws (e.g. offline) surfaces that failure and does not touch the session', () async {
    // ApiAuthRepository.refresh() rethrows an offline ApiFailure instead of
    // returning null, because "the session is gone" and "we couldn't reach the
    // server to find out" are different outcomes: only the former should wipe
    // the session and fire onFatal. The RefreshFn contract only documents a
    // `Tokens?` return, so a `refresh()` that *throws* has to be handled by
    // whatever dio does when an onError callback's Future rejects instead of
    // completing — this pins that behaviour down.
    dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => 'old',
      refresh: () async => throw const ApiFailure(ApiErrorCode.offline, "You're offline."),
      deviceId: () async => 'd',
      appVersion: '1',
      platform: 'ios',
      onFatal: (f) {
        fatal = f;
        fatalCalls++;
      },
    );
    adapter = DioAdapter(dio: dio)
      ..onGet(
        '/me',
        (s) => s.reply(401, {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
        }),
      );
    await expectLater(
      dio.get<void>('/me'),
      throwsA(isA<DioException>().having((e) => ApiFailure.of(e).code, 'code', ApiErrorCode.offline)),
    );
    expect(fatalCalls, 0);
  });

  test('two concurrent requests that both hit TOKEN_EXPIRED with a dead refresh share one refresh and one onFatal',
      () async {
    // Unlike the successful-refresh case, a failed refresh doesn't change the
    // access token — so the second queued request can't tell "already
    // refreshed" apart from "haven't tried yet" just by comparing tokens. The
    // interceptor has to remember that this exact token is confirmed dead so
    // it doesn't call refresh() (or onFatal) again for it.
    dio = buildDio(
      baseUrl: 'https://api.test/v1',
      accessToken: () async => token,
      refresh: () async {
        refreshes++;
        return null;
      },
      deviceId: () async => 'dev-1',
      appVersion: '1.0.0',
      platform: 'android',
      onFatal: (f) {
        fatal = f;
        fatalCalls++;
      },
    );
    adapter = DioAdapter(dio: dio);
    for (final path in ['/a', '/b']) {
      adapter.onGet(
        path,
        (s) => s.reply(401, {
          'error': {'code': 'TOKEN_EXPIRED', 'message': 'x'},
        }),
        headers: {'Authorization': 'Bearer old'},
      );
    }

    final futures = [
      dio.get<Map<String, dynamic>>('/a'),
      dio.get<Map<String, dynamic>>('/b'),
    ];

    for (final f in futures) {
      await expectLater(
        f,
        throwsA(isA<DioException>().having((e) => ApiFailure.of(e).code, 'code', ApiErrorCode.sessionInvalidated)),
      );
    }

    expect(refreshes, 1);
    expect(fatalCalls, 1);
    expect(fatal?.code, ApiErrorCode.sessionInvalidated);
  });
}
