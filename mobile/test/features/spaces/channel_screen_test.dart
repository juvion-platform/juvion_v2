import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/features/notices/widgets/notice_tile.dart';
import 'package:juvi/features/spaces/channel_screen.dart';

import '../../core/repos/notices_fixtures.dart';

Map<String, dynamic> channelJson(List<Map<String, dynamic>> notices) => {
      'id': 'c3',
      'name': 'CSE 2024',
      'about': 'Batch space for CSE 2024',
      'scopeType': 'batch',
      'templateCode': 'batch',
      'status': 'active',
      'memberCount': 120,
      'replyRule': 'announcement_only',
      'defaultPriority': 'important',
      'role': 'member',
      'muted': false,
      'canPost': false,
      'canReply': false,
      'whoCanPost': 'Class teachers',
      'notices': notices,
    };

Future<GoRouter> pumpChannel(WidgetTester t, Map<String, dynamic> json) async {
  final router = GoRouter(initialLocation: '/spaces/c3', routes: [
    GoRoute(path: '/spaces/:channelId', builder: (_, s) => ChannelScreen(channelId: s.pathParameters['channelId']!)),
    GoRoute(path: '/notices/:id', builder: (_, s) => Scaffold(body: Text('detail ${s.pathParameters['id']}'))),
  ]);
  addTearDown(router.dispose);
  await t.pumpWidget(ProviderScope(
    retry: (_, _) => null,
    overrides: [
      channelProvider('c3').overrideWith((_) => Stream.value(Cached(ChannelDetail.fromJson(json), DateTime.now()))),
      pendingAcksProvider.overrideWith((_) async => <String>{}),
    ],
    child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
  ));
  await t.pumpAndSettle();
  return router;
}

void main() {
  testWidgets("a notice sent to this channel's batch appears inline and opens S04", (t) async {
    await pumpChannel(t, channelJson([cardJson('n1')]));
    expect(find.text('NOTICES'), findsOneWidget);
    expect(find.byType(NoticeTile), findsOneWidget);
    await t.tap(find.text('Mid-semester exam timetable'));
    await t.pumpAndSettle();
    expect(find.text('detail n1'), findsOneWidget);
  });

  testWidgets('a channel with no notices keeps its empty state', (t) async {
    await pumpChannel(t, channelJson([]));
    expect(find.byType(NoticeTile), findsNothing);
    expect(find.text('Nothing new'), findsOneWidget);
  });
}
