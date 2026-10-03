// mobile/test/core/push/push_handlers_test.dart
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/push_handlers.dart';
import 'package:juvi/core/push/receipts.dart';
import 'package:juvi_api/juvi_api.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'push_fixtures.dart';

class _Plugin extends Mock implements FlutterLocalNotificationsPlugin {}

class _Android extends Mock implements AndroidFlutterLocalNotificationsPlugin {}

void main() {
  late DioAdapter adapter;
  late List<Map<String, dynamic>> posted;
  late Receipts receipts;
  late FakeLocalNotifications local;
  final at = DateTime.utc(2026, 10, 3, 5);
  Future<bool> allowed() async => true;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test/v1'));
    posted = [];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      posted.add(jsonDecode(o.data as String) as Map<String, dynamic>);
      h.next(o);
    }));
    adapter = DioAdapter(dio: dio)
      ..onPost('/notifications/receipts', (s) => s.reply(200, {'accepted': 1, 'rejected': 0}), data: Matchers.any);
    receipts = Receipts(JuviApi(dio: dio, basePathOverride: 'https://api.test/v1').getMobileApi(), ReceiptQueue());
    local = FakeLocalNotifications();
  });

  group('background', () {
    test('renders every tier and posts delivered with no session', () async {
      for (final tier in ['urgent', 'important', 'routine']) {
        await handleBackgroundPush(pushData(tier: tier), local: local, receipts: receipts, allowed: allowed, now: () => at);
      }
      expect(local.shown.map((p) => p.tier), ['urgent', 'important', 'routine']);
      expect(posted.first, {
        'items': [
          {'deliveryId': 'd00000000000000000000001', 'receipt': 'sig.1760000000', 'event': 'delivered', 'at': '2026-10-03T05:00:00.000Z'},
        ],
      });
    });

    test('a confidential notice is rendered with only the office', () async {
      await handleBackgroundPush(pushData(title: null), local: local, receipts: receipts, allowed: allowed, now: () => at);
      expect(trayContent(local.shown.single), const TrayContent('New notice from Exam Section'));
    });

    test('offline: the delivered receipt is queued for the foreground', () async {
      adapter.onPost(
        '/notifications/receipts',
        (s) => s.throws(0, DioException.connectionError(requestOptions: RequestOptions(), reason: 'offline')),
        data: Matchers.any,
      );
      await handleBackgroundPush(pushData(), local: local, receipts: receipts, allowed: allowed, now: () => at);
      expect(local.shown, hasLength(1));
      expect([for (final i in await ReceiptQueue().read()) i.key], ['d00000000000000000000001:delivered']);
    });

    test('while the OS blocks notifications nothing is shown and no receipt is posted', () async {
      await handleBackgroundPush(pushData(), local: local, receipts: receipts, allowed: () async => false, now: () => at);
      expect(local.shown, isEmpty);
      expect(posted, isEmpty);
      expect(await ReceiptQueue().read(), isEmpty);
    });

    test('a message that is not a notice push is ignored', () async {
      await handleBackgroundPush({'kind': 'post'}, local: local, receipts: receipts, allowed: allowed);
      expect(local.shown, isEmpty);
      expect(posted, isEmpty);
    });
  });

  group('foreground', () {
    test('Urgent and Important are rendered, Routine is not; every tier refreshes and posts delivered', () async {
      var refreshed = 0;
      for (final tier in ['urgent', 'important', 'routine']) {
        await handleForegroundPush(pushData(tier: tier), local: local, receipts: receipts, refresh: () => refreshed++, now: () => at);
      }
      expect(local.shown.map((p) => p.tier), ['urgent', 'important']);
      expect(refreshed, 3);
      expect(posted, hasLength(3));
    });

    test('a tray that throws still refreshes and still posts delivered, and nothing escapes', () async {
      var refreshed = 0;
      await handleForegroundPush(pushData(tier: 'urgent'), local: _ThrowingLocal(), receipts: receipts, refresh: () => refreshed++, now: () => at);
      expect(refreshed, 1);
      expect(posted, hasLength(1));
      expect(((posted.single['items'] as List).single as Map)['event'], 'delivered');
    });
  });

  group('background isolate', () {
    test('nothing thrown in the body escapes the background entry point', () async {
      final failing = Receipts(_ThrowingApi(), _ThrowingQueue());
      await expectLater(
        runInBackgroundIsolate(() => handleBackgroundPush(pushData(), local: FakeLocalNotifications(), receipts: failing, allowed: allowed)),
        completes,
      );
      await expectLater(
        runInBackgroundIsolate(() => handleBackgroundPush(pushData(), local: _ThrowingLocal(), receipts: receipts, allowed: allowed)),
        completes,
      );
      await expectLater(runInBackgroundIsolate(() async => throw StateError('SharedPreferences')), completes);
      await expectLater(runInBackgroundIsolate(() => throw StateError('sync throw')), completes);
    });
  });

  group('PluginLocalNotifications', () {
    late _Plugin plugin;
    late _Android android;
    setUpAll(() {
      registerFallbackValue(const AndroidNotificationChannel('x', 'x'));
      registerFallbackValue(const InitializationSettings());
    });
    setUp(() {
      plugin = _Plugin();
      android = _Android();
      when(() => plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()).thenReturn(android);
      when(() => android.createNotificationChannel(any())).thenAnswer((_) async {});
      when(() => plugin.initialize(settings: any(named: 'settings'), onDidReceiveNotificationResponse: any(named: 'onDidReceiveNotificationResponse')))
          .thenAnswer((_) async => true);
      when(() => plugin.show(
            id: any(named: 'id'),
            title: any(named: 'title'),
            body: any(named: 'body'),
            notificationDetails: any(named: 'notificationDetails'),
            payload: any(named: 'payload'),
          )).thenAnswer((_) async {});
    });

    test('init creates the three channels at their importance', () async {
      await PluginLocalNotifications(plugin).init();
      final channels = verify(() => android.createNotificationChannel(captureAny())).captured.cast<AndroidNotificationChannel>();
      expect([for (final c in channels) (c.id, c.importance, c.playSound)], [
        ('juvi_urgent', Importance.max, true),
        ('juvi_important', Importance.high, true),
        ('juvi_routine', Importance.low, false),
      ]);
    });

    test('the small icon is the monochrome ic_stat_juvi, by default and on every notification', () async {
      final local = PluginLocalNotifications(plugin);
      await local.init();
      final settings = verify(() => plugin.initialize(settings: captureAny(named: 'settings'), onDidReceiveNotificationResponse: any(named: 'onDidReceiveNotificationResponse')))
          .captured
          .single as InitializationSettings;
      expect(settings.android!.defaultIcon, '@drawable/ic_stat_juvi');
      await local.show(NoticePush.tryParse(pushData())!);
      final details = verify(() => plugin.show(
            id: any(named: 'id'),
            title: any(named: 'title'),
            body: any(named: 'body'),
            notificationDetails: captureAny(named: 'notificationDetails'),
            payload: any(named: 'payload'),
          )).captured.cast<NotificationDetails>();
      expect([for (final d in details) d.android!.icon], ['@drawable/ic_stat_juvi', '@drawable/ic_stat_juvi']);
    });

    test('cancelAll empties the tray', () async {
      when(() => plugin.cancelAll()).thenAnswer((_) async {});
      await PluginLocalNotifications(plugin).cancelAll();
      verify(() => plugin.cancelAll()).called(1);
    });

    test('show posts the notification and its group summary on the tier channel, with stable ids', () async {
      final p = NoticePush.tryParse(pushData(tier: 'urgent'))!;
      await PluginLocalNotifications(plugin).show(p);
      final calls = verify(() => plugin.show(
            id: captureAny(named: 'id'),
            title: captureAny(named: 'title'),
            body: captureAny(named: 'body'),
            notificationDetails: captureAny(named: 'notificationDetails'),
            payload: captureAny(named: 'payload'),
          )).captured;
      // Five captures per call: id, title, body, details, payload.
      expect(calls[0], notificationIdFor(p));
      expect([calls[1], calls[2]], ['Exam Section', 'Hall tickets are out']);
      final details = (calls[3] as NotificationDetails).android!;
      expect([details.channelId, details.importance, details.priority, details.groupKey, details.setAsGroupSummary],
          ['juvi_urgent', Importance.max, Priority.max, 'notice:66f1c0ffee0000000000abcd', false]);
      expect(NoticePush.fromPayload(calls[4] as String)!.deliveryId, p.deliveryId);
      expect(calls[5], summaryIdFor(p));
      final summary = (calls[8] as NotificationDetails).android!;
      expect([summary.groupKey, summary.setAsGroupSummary, summary.groupAlertBehavior], ['notice:66f1c0ffee0000000000abcd', true, GroupAlertBehavior.children]);
    });
  });
}

class _ThrowingLocal extends FakeLocalNotifications {
  @override
  Future<void> show(NoticePush p) async => throw StateError('tray');
}

class _ThrowingApi extends Mock implements MobileApi {}

class _ThrowingQueue extends ReceiptQueue {
  @override
  Future<List<ReceiptItem>> read() async => throw StateError('prefs');
  @override
  Future<void> add(ReceiptItem item) async => throw StateError('prefs');
}
