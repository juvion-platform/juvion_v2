import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Firebase stays behind small interfaces (notifications spec §8, §10): tests never
/// initialise it, and a build with the placeholder google-services.json still runs. Only
/// these files may import a Firebase package.
const firebaseFiles = {
  'lib/main.dart',
  'lib/core/push/background_handler.dart',
  'lib/core/push/firebase_push.dart',
  'lib/core/crash/firebase_crash_sink.dart',
};

void main() {
  test('only the Firebase boundary files import package:firebase_*', () {
    final offenders = [
      for (final f in Directory('lib').listSync(recursive: true).whereType<File>())
        if (f.path.endsWith('.dart') && !firebaseFiles.contains(f.path) && f.readAsStringSync().contains("import 'package:firebase_")) f.path,
    ];
    expect(offenders, isEmpty);
  });

  test('google-services.json is git-ignored and a placeholder is committed', () {
    expect(File('android/app/google-services.placeholder.json').existsSync(), isTrue);
    expect(File('.gitignore').readAsStringSync(), contains('/android/app/google-services.json'));
  });
}
