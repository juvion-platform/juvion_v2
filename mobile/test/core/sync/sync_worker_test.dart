import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:juvi/core/sync/sync_worker.dart';
import 'package:mocktail/mocktail.dart';

class _Me extends Mock implements MeRepository {}
class _Spaces extends Mock implements SpacesRepository {}

void main() {
  late AppDatabase db; late _Me me; late _Spaces spaces; late SyncWorker w;
  setUp(() { db = AppDatabase.memory(); me = _Me(); spaces = _Spaces(); w = SyncWorker(db, me, spaces); });
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
    expect((await db.pendingActions()).first.attempts, 1);
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
}
