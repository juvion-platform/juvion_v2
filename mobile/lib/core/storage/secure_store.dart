import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:juvi/core/models/models.dart';

class SecureStore {
  // flutter_secure_storage 11's default AndroidOptions() already uses AES-GCM with
  // RSA-OAEP key wrapping (the package's built-in `encryptedSharedPreferences` flag
  // from earlier majors was removed because this is now the only/default behaviour),
  // so no explicit AndroidOptions override is needed. On iOS, the default keychain
  // accessibility (`unlocked`) would block a background sync from reading tokens while
  // the device is locked; `first_unlock_this_device` keeps items readable after the
  // device has been unlocked once since boot, matching how Android background work
  // behaves, and keeps the refresh token and DB key out of iCloud/iTunes backups.
  SecureStore([FlutterSecureStorage? storage])
      : _s = storage ??
            const FlutterSecureStorage(
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );
  final FlutterSecureStorage _s;

  static const _access = 'juvi.access';
  static const _refresh = 'juvi.refresh';
  static const _device = 'juvi.device_id';
  static const _dbKey = 'juvi.db_key';
  static const _college = 'juvi.college_id';

  static String _randomHex(int bytes) {
    final r = Random.secure();
    return List.generate(bytes, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  /// Reads that fail (e.g. prefs restored onto a device without their Keystore key)
  /// are treated as missing: the storage is unreadable, not the app.
  Future<String?> _readOrNull(String key) async {
    try {
      return await _s.read(key: key);
    } on Object {
      await _deleteQuietly(key);
      return null;
    }
  }

  Future<void> _deleteQuietly(String key) async {
    try {
      await _s.delete(key: key);
    } on Object {
      // Best effort: an entry we cannot delete is overwritten or ignored later.
    }
  }

  Future<String> _getOrCreate(String key, int bytes) async {
    final existing = await _readOrNull(key);
    if (existing != null) return existing;
    final v = _randomHex(bytes);
    await _s.write(key: key, value: v);
    return v;
  }

  Future<String> deviceId() => _getOrCreate(_device, 16);
  Future<String> databaseKey() => _getOrCreate(_dbKey, 32);

  /// An unreadable store means signed out: the session entries are cleared (best
  /// effort) and null is returned rather than throwing into bootstrap.
  Future<Tokens?> readTokens() async {
    try {
      final a = await _s.read(key: _access);
      final r = await _s.read(key: _refresh);
      if (a == null || r == null) return null;
      return Tokens(accessToken: a, refreshToken: r);
    } on Object {
      await wipeAll();
      return null;
    }
  }

  Future<void> writeTokens(Tokens t) async {
    await _s.write(key: _access, value: t.accessToken);
    await _s.write(key: _refresh, value: t.refreshToken);
  }

  Future<void> clearTokens() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
  }

  Future<String?> readCollegeId() => _readOrNull(_college);
  Future<void> writeCollegeId(String id) => _s.write(key: _college, value: id);

  /// Sign-out and deactivation: forget the session, keep the device identity and the DB key.
  /// Each entry is deleted best effort, so one failing delete does not keep the others.
  Future<void> wipeAll() async {
    for (final k in const [_access, _refresh, _college]) {
      await _deleteQuietly(k);
    }
  }
}
