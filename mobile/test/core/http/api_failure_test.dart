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

  test('notice codes map, and error.ack / error.reminders are read from the raw envelope', () {
    final ack = ApiFailure.fromDio(_dio(409, {
      'error': {'code': 'ALREADY_ACKNOWLEDGED', 'message': 'Already', 'ack': {'ackAt': '2026-10-01T05:00:00.000Z', 'late': false, 'method': 'hold', 'offline': false, 'comment': null, 'clientAt': null}},
    }));
    expect(ack.code, ApiErrorCode.alreadyAcknowledged);
    expect(ack.ackRecord?['method'], 'hold');
    expect(ack.reminders, isNull);
    final limit = ApiFailure.fromDio(_dio(409, {
      'error': {'code': 'REMINDER_LIMIT', 'message': 'At most two', 'reminders': {'used': 2, 'max': 2, 'lastAt': null}},
    }));
    expect(limit.code, ApiErrorCode.reminderLimit);
    expect(limit.reminders?['used'], 2);
    for (final (wire, code) in [
      ('NOTICE_NOT_FOUND', ApiErrorCode.noticeNotFound),
      ('NOTICE_ARCHIVED', ApiErrorCode.noticeArchived),
      ('NOT_PUBLISHER', ApiErrorCode.notPublisher),
      ('ACK_REQUIRED', ApiErrorCode.ackRequired),
      ('ACK_NOT_REQUIRED', ApiErrorCode.ackNotRequired),
    ]) {
      expect(ApiErrorCode.fromWire(wire), code);
    }
  });
}
