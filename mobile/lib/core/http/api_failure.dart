import 'package:dio/dio.dart';

enum ApiErrorCode {
  validationFailed, invalidCredentials, tokenExpired, sessionInvalidated, accountDeactivated,
  forbidden, notFound, gone, updateRequired, cooldown, institutionPaused, internal, offline, unknown;

  static ApiErrorCode fromWire(String? code) => switch (code) {
        'VALIDATION_FAILED' => validationFailed,
        'INVALID_CREDENTIALS' => invalidCredentials,
        'TOKEN_EXPIRED' => tokenExpired,
        'SESSION_INVALIDATED' => sessionInvalidated,
        'ACCOUNT_DEACTIVATED' => accountDeactivated,
        'FORBIDDEN' => forbidden,
        'NOT_FOUND' => notFound,
        'GONE' => gone,
        'UPDATE_REQUIRED' => updateRequired,
        'COOLDOWN' => cooldown,
        'INSTITUTION_PAUSED' => institutionPaused,
        'INTERNAL' => internal,
        _ => unknown,
      };
}

class ApiFailure implements Exception {
  const ApiFailure(this.code, this.message, {this.status, this.detail = const {}});

  factory ApiFailure.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
      // dio 5.11 added transformTimeout (a timeout while transforming the
      // request/response); it belongs in the same offline/timeout bucket as the others.
      case DioExceptionType.transformTimeout:
        return const ApiFailure(ApiErrorCode.offline, "You're offline.");
      case DioExceptionType.unknown:
        if (e.response == null) return const ApiFailure(ApiErrorCode.offline, "You're offline.");
      case DioExceptionType.badResponse:
      case DioExceptionType.badCertificate:
      case DioExceptionType.cancel:
        break;
    }
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = Map<String, dynamic>.from(data['error'] as Map);
      final code = ApiErrorCode.fromWire(err.remove('code') as String?);
      final message = (err.remove('message') as String?) ?? 'Something went wrong.';
      return ApiFailure(code, message, status: e.response?.statusCode, detail: err);
    }
    return ApiFailure(ApiErrorCode.unknown, 'Something went wrong.', status: e.response?.statusCode);
  }

  /// Normalises anything thrown by the client into an ApiFailure.
  factory ApiFailure.of(Object e) {
    if (e is ApiFailure) return e;
    if (e is DioException) return e.error is ApiFailure ? e.error! as ApiFailure : ApiFailure.fromDio(e);
    return ApiFailure(ApiErrorCode.unknown, e.toString());
  }

  final ApiErrorCode code;
  final String message;
  final int? status;
  final Map<String, dynamic> detail;

  bool get isOffline => code == ApiErrorCode.offline;
  int? get retryAfterSeconds => detail['retryAfterSeconds'] as int?;
  String? get reason => detail['reason'] as String?;
  List<Map<String, dynamic>> get fields => (detail['fields'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  @override
  String toString() => 'ApiFailure(${code.name}, $message)';
}
