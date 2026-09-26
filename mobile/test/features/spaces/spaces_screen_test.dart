import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/spaces/spaces_screen.dart';

Map<String, dynamic> ch(String id, String name, {bool muted = false, String? next, bool archived = false}) => {
      'id': id,
      'name': name,
      'about': 'About $name',
      'scopeType': 'course_offering',
      'templateCode': 'course',
      'role': 'member',
      'muted': muted,
      'memberCount': 60,
      'archived': archived,
      'nextClassAt': null,
      'nextClassLabel': next,
    };

final Map<String, dynamic> spacesJson = {
  'groups': [
    {
      'key': 'college',
      'title': 'College',
      'channels': [ch('c1', 'JIT College')..['scopeType'] = 'college'..['templateCode'] = 'college'],
    },
    {
      'key': 'courses',
      'title': 'My Courses',
      'channels': [ch('c2', 'CS202 OS · A', next: 'Next: Today 08:00'), ch('c3', 'CS201 DBMS · A', muted: true, next: 'Next: Today 17:00')],
    },
    {
      'key': 'archived',
      'title': 'Archived',
      'channels': [ch('c9', 'CS101 · A', archived: true)],
    },
  ],
  'asOf': '2026-09-23T08:14:00+05:30',
};

final Map<String, dynamic> emptyCourses = {
  'groups': [
    {'key': 'courses', 'title': 'My Courses', 'emptyHint': 'Your course spaces appear here once your registrations are in.', 'channels': <Map<String, dynamic>>[]},
  ],
  'asOf': '2026-09-23T08:14:00+05:30',
};

Widget host(Map<String, dynamic> json) => ProviderScope(
      retry: (_, _) => null,
      overrides: [
        spacesProvider.overrideWith((_) async* {
          yield Cached(SpacesData.fromJson(json), DateTime.now());
        }),
      ],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SpacesScreen()),
    );

void main() {
  testWidgets('renders groups in server order with next-class labels, muted marker and archived section', (t) async {
    await t.pumpWidget(host(spacesJson));
    await t.pump();
    final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
    expect(texts.indexOf('COLLEGE'), lessThan(texts.indexOf('MY COURSES')));
    expect(texts.indexOf('MY COURSES'), lessThan(texts.indexOf('ARCHIVED')));
    expect(texts.indexOf('CS202 OS · A'), lessThan(texts.indexOf('CS201 DBMS · A')));
    expect(find.text('Next: Today 08:00'), findsOneWidget);
    expect(find.byIcon(Icons.notifications_off_outlined), findsOneWidget);
    expect(find.text('CS101 · A'), findsOneWidget);
  });

  testWidgets('empty courses group shows the hint', (t) async {
    await t.pumpWidget(host(emptyCourses));
    await t.pump();
    expect(find.textContaining('once your registrations are in'), findsOneWidget);
  });
}
