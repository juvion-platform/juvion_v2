import 'dart:io';

import 'package:drift/drift.dart' show QueryExecutor;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:mocktail/mocktail.dart';
import 'package:sqlite3/common.dart';

class _FakeDatabase extends Mock implements CommonDatabase {}

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
    await db.recordAttempt(list.first.id, 'offline');
    expect((await db.pendingActions()).first.attempts, 2);
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

  test('assertSqlCipherLinked throws when the database is not linked against SQLCipher', () {
    final raw = _FakeDatabase();
    // A plain SQLite build doesn't recognise `cipher_version`, so the pragma returns an
    // empty result set — this is what we'd see if the SQLCipher hook silently failed to
    // apply (see pubspec.yaml `hooks.user_defines.sqlite3.source: sqlcipher`).
    when(() => raw.select(any())).thenReturn(ResultSet(const [], null, const []));
    expect(() => assertSqlCipherLinked(raw), throwsA(isA<StateError>()));
  });

  // I2: a file restored from a backup without its key (or corrupt) must be replaced by a
  // fresh cache, not crash every launch; SQLCipher missing must still fail closed (R50).
  group('openRecovering', () {
    late Directory dir;
    late File file;
    setUp(() {
      dir = Directory.systemTemp.createTempSync('juvi_db_test');
      file = File('${dir.path}/juvi.db');
    });
    tearDown(() => dir.deleteSync(recursive: true));

    Future<void> deleteFile() async {
      if (file.existsSync()) await file.delete();
    }

    test('an unreadable file is deleted and a working database opened in its place', () async {
      file.writeAsBytesSync(List.generate(4096, (i) => (i * 37) % 251));
      var deletes = 0;
      final recovered = await openRecovering(
        () => AppDatabase(NativeDatabase.createInBackground(file)),
        () async {
          deletes++;
          await deleteFile();
        },
      );
      addTearDown(recovered.close);
      expect(deletes, 1);
      await recovered.writeDoc('me', {'a': 1}, DateTime.utc(2026));
      expect((await recovered.readDoc('me'))!.json, {'a': 1});
    });

    test('a file encrypted under a different key is replaced (backup restored without its key)', () async {
      QueryExecutor keyed(String key) => NativeDatabase.createInBackground(
            file,
            setup: (raw) {
              raw.execute("PRAGMA key = '$key';");
              assertSqlCipherLinked(raw);
            },
          );
      final old = AppDatabase(keyed('old-key'));
      await old.writeDoc('me', {'a': 1}, DateTime.utc(2026));
      await old.close();
      var deletes = 0;
      final recovered = await openRecovering(() => AppDatabase(keyed('new-key')), () async {
        deletes++;
        await deleteFile();
      });
      addTearDown(recovered.close);
      expect(deletes, 1);
      expect(await recovered.readDoc('me'), isNull);
      await recovered.writeDoc('me', {'a': 2}, DateTime.utc(2026));
      expect((await recovered.readDoc('me'))!.json, {'a': 2});
    });

    test('a readable file is opened as-is', () async {
      final first = AppDatabase(NativeDatabase(file));
      await first.writeDoc('me', {'a': 1}, DateTime.utc(2026));
      await first.close();
      var deletes = 0;
      final reopened = await openRecovering(() => AppDatabase(NativeDatabase(file)), () async => deletes++);
      addTearDown(reopened.close);
      expect(deletes, 0);
      expect((await reopened.readDoc('me'))!.json, {'a': 1});
    });

    test('SQLCipher not linked is rethrown and nothing is deleted', () async {
      var deletes = 0;
      await expectLater(
        openRecovering(
          // The host build links SQLCipher too (pubspec's sqlite3 hook), so the
          // not-linked case is simulated with the error assertSqlCipherLinked throws.
          () => AppDatabase(NativeDatabase.createInBackground(
                file,
                setup: (_) => throw StateError('SQLCipher is not linked; refusing to open an unencrypted database'),
              )),
          () async => deletes++,
        ),
        throwsA(predicate((e) => e.toString().contains('SQLCipher is not linked'))),
      );
      expect(deletes, 0);
    });

    test('isUnreadableDatabaseError tells a wrong key from a missing SQLCipher', () {
      expect(isUnreadableDatabaseError(Exception('file is not a database')), isTrue);
      expect(isUnreadableDatabaseError(StateError('SQLCipher is not linked; refusing')), isFalse);
      expect(isUnreadableDatabaseError(Exception('disk I/O error')), isFalse);
    });
  });
}
