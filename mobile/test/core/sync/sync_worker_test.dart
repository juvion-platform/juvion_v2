import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/core/sync/sync_worker.dart';
import 'package:mocktail/mocktail.dart';

class _Me extends Mock implements MeRepository {}
class _Spaces extends Mock implements SpacesRepository {}
class _Notices extends Mock implements NoticesRepository {}

void main() {
  late AppDatabase db; late _Me me; late _Spaces spaces; late _Notices notices; late SyncWorker w;
  setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
  setUp(() { db = AppDatabase.memory(); me = _Me(); spaces = _Spaces(); notices = _Notices(); w = SyncWorker(db, me, spaces, notices); });
  tearDown(() => db.close());

  test('drains in order and removes sent actions', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await db.enqueueAction(PendingAction.create('settings.patch', {'tiers': {'routine': false}}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {});
    when(() => me.updateSettings({'tiers': {'routine': false}})).thenAnswer((_) async =>
        const Settings(quietHours: QuietHours(start: '22:00', end: '07:00'), tiers: Tiers(important: true, routine: false), language: 'en'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 2, deferred: 0, dropped: 0));
    expect(await db.pendingActions(), isEmpty);
    verifyInOrder([() => spaces.setMuted('c1', true), () => me.updateSettings({'tiers': {'routine': false}})]);
  });

  test('stops at the first offline failure and keeps the rest', () async {
    await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'c1'}));
    await db.enqueueAction(PendingAction.create('channel.unmute', {'channelId': 'c2'}));
    when(() => spaces.markRead('c1')).thenThrow(const ApiFailure(ApiErrorCode.offline, 'off'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 2, dropped: 0));
    expect((await db.pendingActions()).length, 2);
    // R60: an offline failure doesn't count against the retry budget — only a
    // non-offline failure does — so ten connectivity blips can never drop this action.
    expect((await db.pendingActions()).first.attempts, 0);
    verifyNever(() => spaces.setMuted('c2', false));
  });

  test('drops an action on a non-offline 4xx', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'gone'}));
    when(() => spaces.setMuted('gone', true)).thenThrow(const ApiFailure(ApiErrorCode.notFound, 'nope', status: 404));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 0, dropped: 1));
    expect(await db.pendingActions(), isEmpty);
  });

  test('drops an action after ten failed attempts', () async {
    final a = PendingAction.create('channel.read', {'channelId': 'flaky'});
    await db.enqueueAction(a);
    for (var i = 0; i < 9; i++) { await db.recordAttempt(a.id, 'server'); }
    when(() => spaces.markRead('flaky')).thenThrow(const ApiFailure(ApiErrorCode.internal, 'boom', status: 500));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 0, dropped: 1));
    expect(await db.pendingActions(), isEmpty);
  });

  // I4: a sign-out wipes the queue while a drain is mid-flight; the rest of the old
  // account's queue must not go out (under whatever token is in the store by then).
  test('an action deleted mid-drain is not sent', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await db.enqueueAction(PendingAction.create('settings.patch', {'tiers': {'routine': false}}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async => db.wipe());
    final r = await w.drain();
    expect(r, const DrainResult(sent: 1, deferred: 0, dropped: 0));
    verifyNever(() => me.updateSettings(any()));
  });

  test('an action enqueued mid-drain is sent in the same drain', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    when(() => spaces.setMuted('c1', true)).thenAnswer((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 2));
      await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'c1'}));
    });
    when(() => spaces.markRead('c1')).thenAnswer((_) async {});
    final r = await w.drain();
    expect(r, const DrainResult(sent: 2, deferred: 0, dropped: 0));
    expect(await db.pendingActions(), isEmpty);
    verify(() => spaces.markRead('c1')).called(1);
  });

  test('a failing action is tried once per drain even across passes', () async {
    await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'flaky'}));
    when(() => spaces.markRead('flaky')).thenThrow(const ApiFailure(ApiErrorCode.internal, 'boom', status: 500));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 1, dropped: 0));
    verify(() => spaces.markRead('flaky')).called(1);
  });

  Map<String, dynamic> queuedAck(String id) =>
      {'noticeId': id, 'method': 'confirm', 'comment': null, 'clientAt': '2026-10-01T04:59:00.000Z', 'offline': true};
  AckRecord record() => AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: true);

  test('replays a queued notice.ack as an offline acknowledgement with its clientAt', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any())).thenAnswer((_) async => record());
    final r = await w.drain();
    expect(r, const DrainResult(sent: 1, deferred: 0, dropped: 0));
    final input = verify(() => notices.acknowledge('n1', captureAny())).captured.single as AckInput;
    expect(input.method, AckMethod.confirm);
    expect(input.offline, isTrue);
    expect(input.clientAt, DateTime.utc(2026, 10, 1, 4, 59));
    expect(input.comment, isNull);
  });

  test('a 409 on a replayed notice.ack counts as sent', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any()))
        .thenThrow(const ApiFailure(ApiErrorCode.noticeArchived, 'This notice has been archived.', status: 409));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 1, deferred: 0, dropped: 0));
    expect(await db.pendingActions(), isEmpty);
  });

  // M8: only a generic 4xx drop case existed before; a replayed notice.ack specifically
  // is reported in ackedNoticeIds either way (sent or dropped), which is what
  // SyncLifecycle uses to re-read S04/the sheet/the channel tiles for it (I2).
  test('a replayed notice.ack that gets a 404 NOTICE_NOT_FOUND is dropped, and reported for the I2 refresh', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any()))
        .thenThrow(const ApiFailure(ApiErrorCode.noticeNotFound, 'This notice is not available.', status: 404));
    final r = await w.drain();
    expect(r.dropped, 1);
    expect(r.sent, 0);
    expect(await db.pendingActions(), isEmpty);
    expect(r.ackedNoticeIds, {'n1'});
  });

  test('a sent (409-replayed) notice.ack is also reported in ackedNoticeIds', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any()))
        .thenThrow(const ApiFailure(ApiErrorCode.noticeArchived, 'This notice has been archived.', status: 409));
    final r = await w.drain();
    expect(r.ackedNoticeIds, {'n1'});
  });

  test('a notice.ack still queued while offline is not reported in ackedNoticeIds', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, 'off'));
    final r = await w.drain();
    expect(r.ackedNoticeIds, isEmpty);
  });

  test('a queued notice.ack stays queued while offline', () async {
    await db.enqueueAction(PendingAction.create('notice.ack', queuedAck('n1')));
    when(() => notices.acknowledge('n1', any())).thenThrow(const ApiFailure(ApiErrorCode.offline, 'off'));
    final r = await w.drain();
    expect(r, const DrainResult(sent: 0, deferred: 1, dropped: 0));
    expect((await db.pendingActions()).single.type, 'notice.ack');
  });
}
