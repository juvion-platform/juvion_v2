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
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {'X-Juvi-App-Version': appVersion, 'X-Juvi-Platform': platform},
  ));
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

    if (failure.code == ApiErrorCode.tokenExpired && err.requestOptions.extra['retried'] != true) {
      final priorAuth = err.requestOptions.headers['Authorization'] as String?;
      final currentToken = await accessToken();

      String? newAccessToken;
      if (currentToken != null && priorAuth != 'Bearer $currentToken') {
        // Another request already refreshed while this one was queued behind it
        // (QueuedInterceptorsWrapper runs onError one at a time) — reuse that
        // token instead of refreshing a second time.
        newAccessToken = currentToken;
      } else {
        final tokens = await refresh();
        newAccessToken = tokens?.accessToken;
      }

      if (newAccessToken != null) {
        final opts = err.requestOptions
          ..headers['Authorization'] = 'Bearer $newAccessToken'
          ..extra['retried'] = true;
        try {
          // Replay on a bare Dio that shares `_dio`'s transport but carries
          // none of its interceptors. QueuedInterceptorsWrapper's error queue
          // only advances when this onError call resolves (calls
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

    if (_fatalCodes.contains(failure.code)) onFatal?.call(failure);
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
