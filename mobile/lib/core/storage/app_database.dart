import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/common.dart' show CommonDatabase, SqliteException;

part 'app_database.g.dart';

class KvCache extends Table {
  TextColumn get key => text()();
  TextColumn get json => text()();
  DateTimeColumn get asOf => dateTime()();
  @override
  Set<Column> get primaryKey => {key};
}

// Named `PendingActionRows`, not `PendingActions`: drift derives both the generated
// accessor field (decapitalized class name) and the generated row data class
// (singularized class name) from this class name. `PendingActions` would generate an
// accessor field `pendingActions` — colliding with the `pendingActions()` query method
// below — and a row data class `PendingAction` — colliding with our own model in
// `core/sync/pending_action.dart`. The SQL table name is kept as `pending_actions`.
class PendingActionRows extends Table {
  @override
  String get tableName => 'pending_actions';

  TextColumn get id => text()();
  TextColumn get type => text()();
  TextColumn get payload => text()();
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  @override
  Set<Column> get primaryKey => {id};
}

class CachedDoc {
  const CachedDoc(this.json, this.asOf);
  final Map<String, dynamic> json;
  final DateTime asOf;
}

/// Fails closed, in every build mode, unless [raw] is linked against SQLCipher (see
/// pubspec.yaml `hooks.user_defines.sqlite3.source: sqlcipher`). An `assert` would be
/// compiled out of release/profile builds, so if the hook ever silently fails to apply,
/// `PRAGMA key` would become a no-op and the on-device cache would ship unencrypted —
/// worse than crashing. `PRAGMA cipher_version` returns a row with the SQLCipher
/// version on a SQLCipher build; on plain SQLite it's an unrecognized pragma and
/// returns an empty result set.
void assertSqlCipherLinked(CommonDatabase raw) {
  final rows = raw.select('PRAGMA cipher_version;');
  final version = rows.isEmpty || rows.first.values.isEmpty ? null : rows.first.values[0];
  if (version == null || version.toString().isEmpty) {
    throw StateError('SQLCipher is not linked; refusing to open an unencrypted database');
  }
}

/// True when [error] says the database file cannot be read with the key we have — it
/// was restored from a backup without its Keystore key, or is corrupt (SQLITE_NOTADB).
/// A missing SQLCipher library is never "unreadable": that must keep failing closed (R50).
/// Matched on the message as well as the type because errors from the background isolate
/// arrive wrapped (drift's remote exception delegates `toString` to the cause).
bool isUnreadableDatabaseError(Object error) {
  final text = error.toString();
  if (text.contains('SQLCipher is not linked')) return false;
  if (error is SqliteException && error.resultCode == 26) return true;
  return text.contains('file is not a database');
}

/// Opens the database from [open] and forces the connection, so a key or corruption
/// failure surfaces here rather than on some later query. When the file is unreadable
/// ([isUnreadableDatabaseError]) it is removed with [deleteFiles] and opened afresh: the
/// cache is disposable and refetches online. Any other error (including SQLCipher not
/// being linked) is rethrown.
Future<AppDatabase> openRecovering(AppDatabase Function() open, Future<void> Function() deleteFiles) async {
  final db = open();
  try {
    await db.customSelect('SELECT count(*) FROM sqlite_master').get();
    return db;
  } on Object catch (e) {
    try {
      await db.close();
    } on Object {
      // The connection never opened; nothing to close.
    }
    if (!isUnreadableDatabaseError(e)) rethrow;
  }
  await deleteFiles();
  final fresh = open();
  await fresh.customSelect('SELECT count(*) FROM sqlite_master').get();
  return fresh;
}

@DriftDatabase(tables: [KvCache, PendingActionRows])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  AppDatabase.memory() : super(NativeDatabase.memory());

  /// SQLCipher-encrypted file database. `key` comes from SecureStore.databaseKey().
  /// A file the key cannot open (see [openRecovering]) is replaced by an empty one.
  static Future<AppDatabase> openEncrypted(String key) async {
    final dir = await getApplicationSupportDirectory();
    final file = File(p.join(dir.path, 'juvi.db'));
    return openRecovering(
      () => AppDatabase(NativeDatabase.createInBackground(
        file,
        setup: (raw) {
          raw.execute("PRAGMA key = '$key';");
          // Fails closed (every build mode, see assertSqlCipherLinked's doc) if the
          // SQLCipher hook didn't apply. Runs on the background isolate
          // `createInBackground` spins up, so it can only be observed by actually running
          // the app on device/emulator, not from host unit tests (which use
          // `AppDatabase.memory()` instead of `openEncrypted`).
          assertSqlCipherLinked(raw);
        },
      )),
      () async {
        for (final suffix in const ['', '-wal', '-shm', '-journal']) {
          final f = File('${file.path}$suffix');
          if (f.existsSync()) await f.delete();
        }
      },
    );
  }

  @override
  int get schemaVersion => 1;

  Future<CachedDoc?> readDoc(String key) async {
    final row = await (select(kvCache)..where((t) => t.key.equals(key))).getSingleOrNull();
    if (row == null) return null;
    return CachedDoc(jsonDecode(row.json) as Map<String, dynamic>, row.asOf.toUtc());
  }

  Future<void> writeDoc(String key, Map<String, dynamic> json, DateTime asOf) =>
      into(kvCache).insertOnConflictUpdate(KvCacheCompanion.insert(key: key, json: jsonEncode(json), asOf: asOf.toUtc()));

  Future<void> deleteDoc(String key) => (delete(kvCache)..where((t) => t.key.equals(key))).go();

  Future<void> enqueueAction(PendingAction a) => into(pendingActionRows).insert(PendingActionRowsCompanion.insert(
        id: a.id,
        type: a.type,
        payload: a.payloadJson,
        createdAt: a.createdAt,
      ));

  Future<List<PendingAction>> pendingActions() async {
    final rows = await (select(pendingActionRows)..orderBy([(t) => OrderingTerm.asc(t.createdAt)])).get();
    return rows
        .map((r) => PendingAction(
              id: r.id,
              type: r.type,
              payload: jsonDecode(r.payload) as Map<String, dynamic>,
              createdAt: r.createdAt,
              attempts: r.attempts,
              lastError: r.lastError,
            ))
        .toList();
  }

  Future<void> recordAttempt(String id, String error) async {
    final row = await (select(pendingActionRows)..where((t) => t.id.equals(id))).getSingleOrNull();
    if (row == null) return;
    await (update(pendingActionRows)..where((t) => t.id.equals(id))).write(
      PendingActionRowsCompanion(attempts: Value(row.attempts + 1), lastError: Value(error)),
    );
  }

  /// R60: an offline failure doesn't count against an action's retry budget — only a
  /// non-offline failure does (ten connectivity blips must not drop a queued action).
  /// Records the last error like [recordAttempt] but leaves `attempts` untouched.
  Future<void> recordOfflineFailure(String id, String error) async {
    final row = await (select(pendingActionRows)..where((t) => t.id.equals(id))).getSingleOrNull();
    if (row == null) return;
    await (update(pendingActionRows)..where((t) => t.id.equals(id))).write(
      PendingActionRowsCompanion(lastError: Value(error)),
    );
  }

  Future<bool> hasAction(String id) async =>
      await (select(pendingActionRows)..where((t) => t.id.equals(id))).getSingleOrNull() != null;

  Future<void> removeAction(String id) => (delete(pendingActionRows)..where((t) => t.id.equals(id))).go();

  Future<void> wipe() async {
    await delete(kvCache).go();
    await delete(pendingActionRows).go();
  }
}
