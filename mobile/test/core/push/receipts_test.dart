// mobile/test/core/push/receipts_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The generated client sends the body already encoded.
Map<String, dynamic> decoded(Object? body) => jsonDecode(body! as String) as Map<String, dynamic>;

ReceiptItem item(String id, {String event = 'delivered'}) =>
    ReceiptItem(deliveryId: id, receipt: 'sig.1760000000', event: event, at: DateTime.utc(2026, 10, 3, 5));

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late List<Object?> bodies;
  late Receipts receipts;
  final queue = ReceiptQueue();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    bodies = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      bodies.add(o.data);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio);
    receipts = Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), queue);
  });

  void offline() => adapter.onPost(
        '/notifications/receipts',
        (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
        data: Matchers.any,
      );

  test('posts one item in the contract shape and queues nothing on success', () async {
    adapter.onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000001'));
    expect(decoded(bodies.single), {
      'items': [
        {'deliveryId': 'd00000000000000000000001', 'receipt': 'sig.1760000000', 'event': 'delivered', 'at': '2026-10-03T05:00:00.000Z'},
      ],
    });
    expect(await queue.read(), isEmpty);
  });

  test('offline: the receipt is queued, once per delivery and event', () async {
    offline();
    await receipts.post(item('d00000000000000000000001'));
    await receipts.post(item('d00000000000000000000001'));
    await receipts.post(item('d00000000000000000000001', event: 'opened'));
    expect([for (final i in await queue.read()) i.key], ['d00000000000000000000001:delivered', 'd00000000000000000000001:opened']);
  });

  test('a server error or 429 keeps the receipt; a 401 RECEIPT_INVALID drops it', () async {
    adapter.onPost('/notifications/receipts', (s) => s.reply(503, {'error': {'code': 'INTERNAL', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000001'));
    adapter.onPost('/notifications/receipts', (s) => s.reply(429, {'error': {'code': 'COOLDOWN', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000002'));
    adapter.onPost('/notifications/receipts', (s) => s.reply(401, {'error': {'code': 'RECEIPT_INVALID', 'message': 'x'}}), data: Matchers.any);
    await receipts.post(item('d00000000000000000000003'));
    expect([for (final i in await queue.read()) i.deliveryId], ['d00000000000000000000001', 'd00000000000000000000002']);
  });

  test('drain sends the queue in batches of 50 and empties it', () async {
    for (var n = 0; n < 60; n++) {
      await queue.add(item('d${n.toString().padLeft(23, '0')}'));
    }
    adapter.onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 50, 'rejected': 0}), data: Matchers.any);
    await receipts.drain();
    expect([for (final b in bodies) (decoded(b)['items'] as List).length], [50, 10]);
    expect(await queue.read(), isEmpty);
  });

  test('drain stops at the first batch that cannot be sent and keeps it', () async {
    await queue.add(item('d00000000000000000000001'));
    offline();
    await receipts.drain();
    expect(await queue.read(), hasLength(1));
  });

  test('the queue keeps the newest 200', () async {
    for (var n = 0; n < 205; n++) {
      await queue.add(item('d${n.toString().padLeft(23, '0')}'));
    }
    final kept = await queue.read();
    expect(kept, hasLength(200));
    expect(kept.first.deliveryId, 'd${5.toString().padLeft(23, '0')}');
  });
}
