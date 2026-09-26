import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';

DioException _dio(int status, Map<String, dynamic> body) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: status, data: body),
      type: DioExceptionType.badResponse,
    );

void main() {
  test('parses the envelope into code, message and detail', () {
    final f = ApiFailure.fromDio(_dio(429, {'error': {'code': 'COOLDOWN', 'message': 'Wait', 'retryAfterSeconds': 540}}));
    expect(f.code, ApiErrorCode.cooldown);
    expect(f.message, 'Wait');
    expect(f.status, 429);
    expect(f.retryAfterSeconds, 540);
    expect(f.detail.containsKey('code'), isFalse);
  });

  test('unknown wire codes become unknown; connection errors become offline', () {
    expect(ApiFailure.fromDio(_dio(500, {'error': {'code': 'WHATEVER', 'message': 'x'}})).code, ApiErrorCode.unknown);
    final off = ApiFailure.fromDio(DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError));
    expect(off.code, ApiErrorCode.offline);
    expect(off.isOffline, isTrue);
  });

  test('of() unwraps a DioException carrying an ApiFailure', () {
    const inner = ApiFailure(ApiErrorCode.notFound, 'gone');
    final wrapped = DioException(requestOptions: RequestOptions(path: '/x'), error: inner);
    expect(ApiFailure.of(wrapped), same(inner));
    expect(ApiFailure.of(StateError('boom')).code, ApiErrorCode.unknown);
  });
}
