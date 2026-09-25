import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/storage/secure_store.dart';
import 'package:mocktail/mocktail.dart';

class _Storage extends Mock implements FlutterSecureStorage {}

void main() {
  late _Storage storage;
  late Map<String, String> mem;
  late SecureStore store;

  setUp(() {
    storage = _Storage();
    mem = {};
    when(() => storage.read(key: any(named: 'key'))).thenAnswer((i) async => mem[i.namedArguments[#key]]);
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value'))).thenAnswer((i) async {
      mem[i.namedArguments[#key] as String] = i.namedArguments[#value] as String;
    });
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((i) async => mem.remove(i.namedArguments[#key]));
    store = SecureStore(storage);
  });

  test('device id and database key are created once and stable', () async {
    final id1 = await store.deviceId();
    final id2 = await store.deviceId();
    expect(id1, id2);
    expect(id1, matches(RegExp(r'^[0-9a-f]{32}$')));
    final k = await store.databaseKey();
    expect(k, matches(RegExp(r'^[0-9a-f]{64}$')));
    expect(await store.databaseKey(), k);
  });

  test('tokens round-trip and wipeAll keeps device id and db key', () async {
    final id = await store.deviceId();
    final key = await store.databaseKey();
    await store.writeTokens(const Tokens(accessToken: 'a', refreshToken: 'r'));
    await store.writeCollegeId('c1');
    expect(await store.readTokens(), const Tokens(accessToken: 'a', refreshToken: 'r'));
    await store.wipeAll();
    expect(await store.readTokens(), isNull);
    expect(await store.readCollegeId(), isNull);
    expect(await store.deviceId(), id);
    expect(await store.databaseKey(), key);
  });
}
