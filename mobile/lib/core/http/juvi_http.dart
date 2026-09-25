import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';

typedef RefreshFn = Future<Tokens?> Function();

const Set<ApiErrorCode> _fatalCodes = {
  ApiErrorCode.sessionInvalidated,
  ApiErrorCode.accountDeactivated,
  ApiErrorCode.institutionPaused,
  ApiErrorCode.updateRequired,
};

/// Timeouts and the `X-Juvi-*` version/platform headers every Juvi request carries —
/// shared by [buildDio] and the unauthenticated `bareDio`.
BaseOptions juviBaseOptions({required String baseUrl, required String appVersion, required String platform}) => BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'X-Juvi-App-Version': appVersion, 'X-Juvi-Platform': platform},
    );

/// Dio configured for the Juvi mobile API: headers, one refresh per expiry, ApiFailure errors.
Dio buildDio({
  required String baseUrl,
  required Future<String?> Function() accessToken,
  required RefreshFn refresh,
  required Future<String> Function() deviceId,
  required String appVersion,
  required String platform,
  void Function(ApiFailure failure)? onFatal,
}) {
  final dio = Dio(juviBaseOptions(baseUrl: baseUrl, appVersion: appVersion, platform: platform));
  dio.interceptors
      .add(_AuthInterceptor(dio, accessToken: accessToken, refresh: refresh, deviceId: deviceId, onFatal: onFatal));
  return dio;
}

/// QueuedInterceptorsWrapper serialises onError, so parallel 401s share one refresh:
/// the first failure to reach onError performs the refresh; any other request that
/// was already in flight with the same (now-stale) token queues behind it and, once
/// its turn comes, notices the access token has moved on and replays with that
/// instead of refreshing again.
class _AuthInterceptor extends QueuedInterceptorsWrapper {
  _AuthInterceptor(
    this._dio, {
    required this.accessToken,
    required this.refresh,
    required this.deviceId,
    this.onFatal,
  });

  final Dio _dio;
  final Future<String?> Function() accessToken;
  final RefreshFn refresh;
  final Future<String> Function() deviceId;
  final void Function(ApiFailure)? onFatal;

  /// The access token a refresh most recently confirmed dead (refresh()
  /// returned null for it). QueuedInterceptorsWrapper runs onError one at a
  /// time, so by the time a second queued request carrying the same stale
  /// token gets its turn, the first refresh has already run to completion and
  /// already failed — there is no in-flight future left to await, so the
  /// outcome has to be remembered instead of re-derived. Cleared on the next
  /// successful refresh.
  String? _deadToken;

  static String? _tokenOf(String? authHeader) =>
      authHeader != null && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await accessToken();
    if (token != null && options.headers['Authorization'] == null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    options.headers['X-Juvi-Device-Id'] = await deviceId();
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    var failure = ApiFailure.fromDio(err);
    var resolvedErr = err;
    var suppressOnFatal = false;

    // Guards a request that re-enters this interceptor carrying a
    // RequestOptions we've already retried once. The replay below runs on a
    // bare Dio (see its comment), so it can't loop back into this onError by
    // itself; this defends against re-entry from *outside* this interceptor —
    // e.g. a caller (a sync/retry queue) resubmitting the same RequestOptions
    // through `_dio` after we've already retried it — so a persistently
    // expired token still can't trigger more than one refresh for a single
    // logical request.
    if (failure.code == ApiErrorCode.tokenExpired && err.requestOptions.extra['retried'] != true) {
      final priorAuth = err.requestOptions.headers['Authorization'] as String?;
      final priorToken = _tokenOf(priorAuth);

      String? newAccessToken;

      if (priorToken != null && priorToken == _deadToken) {
        // Another queued request already ran refresh() for this exact token
        // and it came back null. Don't refresh again for a token already
        // known dead, and don't notify onFatal a second time for it — the
        // request that first discovered it dead already did.
        suppressOnFatal = true;
      } else {
        final currentToken = await accessToken();
        if (currentToken != null && priorAuth != 'Bearer $currentToken') {
          // Another request already refreshed while this one was queued behind
          // it (QueuedInterceptorsWrapper runs onError one at a time) — reuse
          // that token instead of refreshing a second time.
          newAccessToken = currentToken;
        } else {
          final tokens = await refresh();
          newAccessToken = tokens?.accessToken;
          _deadToken = newAccessToken == null ? priorToken : null;
        }
      }

      if (newAccessToken != null) {
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer $newAccessToken'
          ..extra['retried'] = true;
        try {
          // Replay on a bare Dio that shares `_dio`'s transport (adapter) but
          // carries none of its interceptors or other config — buildDio never
          // sets a custom Transformer, so the default one this fresh Dio gets
          // is equivalent. QueuedInterceptorsWrapper's error queue only
          // advances when this onError call resolves (calls
          // handler.resolve/reject); calling `_dio.fetch(opts)` here would
          // reenter that same queue, and if the replay itself errors, its
          // onError task would queue behind this still-running one — which is
          // waiting on the replay to finish. That's a deadlock, not a corner
          // case: any replay that also fails (expired-again token, blip)
          // would hang forever instead of surfacing an ApiFailure.
          final replay = Dio(_dio.options)..httpClientAdapter = _dio.httpClientAdapter;
          final response = await replay.fetch<dynamic>(opts);
          return handler.resolve(response);
        } on DioException catch (e) {
          failure = ApiFailure.fromDio(e);
          resolvedErr = e;
        }
      } else {
        failure = const ApiFailure(
          ApiErrorCode.sessionInvalidated,
          'Please sign in again.',
          status: 401,
          detail: {'reason': 'expired'},
        );
      }
    }

    if (!suppressOnFatal && _fatalCodes.contains(failure.code)) onFatal?.call(failure);
    handler.reject(
      DioException(
        requestOptions: resolvedErr.requestOptions,
        response: resolvedErr.response,
        type: resolvedErr.type,
        error: failure,
      ),
    );
  }
}
