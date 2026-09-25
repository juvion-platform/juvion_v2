import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:juvi/core/sync/pending_action.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

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

@DriftDatabase(tables: [KvCache, PendingActionRows])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);
  AppDatabase.memory() : super(NativeDatabase.memory());

  /// SQLCipher-encrypted file database. `key` comes from SecureStore.databaseKey().
  static Future<AppDatabase> openEncrypted(String key) async {
    final dir = await getApplicationSupportDirectory();
    final file = File(p.join(dir.path, 'juvi.db'));
    return AppDatabase(NativeDatabase.createInBackground(
      file,
      setup: (raw) {
        raw.execute("PRAGMA key = '$key';");
        // Debug-only check that the linked SQLite library is really a SQLCipher build
        // (see pubspec.yaml `hooks.user_defines.sqlite3.source: sqlcipher`):
        // `PRAGMA cipher_version` returns a row with the SQLCipher version on a
        // SQLCipher build and an empty result set on plain SQLite. This runs on the
        // background isolate `createInBackground` spins up, so it can only be observed
        // by actually running the app on device/emulator, not from host unit tests
        // (which use `AppDatabase.memory()` instead of `openEncrypted`).
        assert(
          raw.select('PRAGMA cipher_version;').isNotEmpty,
          'sqlite3 is not linked against SQLCipher — check pubspec.yaml hooks.user_defines.sqlite3.source',
        );
      },
    ));
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

  Future<void> removeAction(String id) => (delete(pendingActionRows)..where((t) => t.id.equals(id))).go();

  Future<void> wipe() async {
    await delete(kvCache).go();
    await delete(pendingActionRows).go();
  }
}
