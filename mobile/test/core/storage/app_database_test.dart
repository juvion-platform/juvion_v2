import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';

void main() {
  late AppDatabase db;
  setUp(() => db = AppDatabase.memory());
  tearDown(() => db.close());

  test('kv cache round-trips JSON with its as-of time and overwrites on the same key', () async {
    final t1 = DateTime.utc(2026, 9, 23, 3);
    await db.writeDoc('me', {'a': 1}, t1);
    final first = await db.readDoc('me');
    expect(first!.json, {'a': 1});
    expect(first.asOf, t1);
    await db.writeDoc('me', {'a': 2}, t1.add(const Duration(minutes: 1)));
    expect((await db.readDoc('me'))!.json, {'a': 2});
    expect(await db.readDoc('missing'), isNull);
  });

  test('pending actions are FIFO, count attempts and can be removed', () async {
    await db.enqueueAction(PendingAction.create('channel.mute', {'channelId': 'c1'}));
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await db.enqueueAction(PendingAction.create('settings.patch', {'tiers': {'routine': false}}));
    final list = await db.pendingActions();
    expect(list.map((a) => a.type), ['channel.mute', 'settings.patch']);
    await db.recordAttempt(list.first.id, 'offline');
    expect((await db.pendingActions()).first.attempts, 1);
    expect((await db.pendingActions()).first.lastError, 'offline');
    await db.removeAction(list.first.id);
    expect((await db.pendingActions()).map((a) => a.type), ['settings.patch']);
  });

  test('wipe clears everything', () async {
    await db.writeDoc('me', {'a': 1}, DateTime.now());
    await db.enqueueAction(PendingAction.create('channel.read', {'channelId': 'c1'}));
    await db.wipe();
    expect(await db.readDoc('me'), isNull);
    expect(await db.pendingActions(), isEmpty);
  });
}
