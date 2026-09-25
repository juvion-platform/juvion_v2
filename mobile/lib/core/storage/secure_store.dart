import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:juvi/core/models/models.dart';

class SecureStore {
  // flutter_secure_storage 11's default AndroidOptions() already uses AES-GCM with
  // RSA-OAEP key wrapping (the package's built-in `encryptedSharedPreferences` flag
  // from earlier majors was removed because this is now the only/default behaviour),
  // so no explicit AndroidOptions override is needed.
  SecureStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();
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

  Future<String> _getOrCreate(String key, int bytes) async {
    final existing = await _s.read(key: key);
    if (existing != null) return existing;
    final v = _randomHex(bytes);
    await _s.write(key: key, value: v);
    return v;
  }

  Future<String> deviceId() => _getOrCreate(_device, 16);
  Future<String> databaseKey() => _getOrCreate(_dbKey, 32);

  Future<Tokens?> readTokens() async {
    final a = await _s.read(key: _access);
    final r = await _s.read(key: _refresh);
    if (a == null || r == null) return null;
    return Tokens(accessToken: a, refreshToken: r);
  }

  Future<void> writeTokens(Tokens t) async {
    await _s.write(key: _access, value: t.accessToken);
    await _s.write(key: _refresh, value: t.refreshToken);
  }

  Future<void> clearTokens() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
  }

  Future<String?> readCollegeId() => _s.read(key: _college);
  Future<void> writeCollegeId(String id) => _s.write(key: _college, value: id);

  /// Sign-out and deactivation: forget the session, keep the device identity and the DB key.
  Future<void> wipeAll() async {
    await clearTokens();
    await _s.delete(key: _college);
  }
}
