import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:mocktail/mocktail.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../../core/repos/notices_fixtures.dart';
import '../notices/notice_actions_test.dart' show SpyAnalytics;
import '../spaces/spaces_screen_test.dart' show spacesJson;

class _Repo extends Mock implements MeRepository {}
class _Notices extends Mock implements NoticesRepository {}
class _Session extends SessionController {
  _Session([this.steps]);
  final List<String>? steps;
  AccountSummary? updated;
  @override SessionState build() {
    final a = Me.fromJson(meJson).account;
    return SessionState.signedIn(steps == null ? a : a.copyWith(onboardingSteps: steps!, onboardingStep: steps!.length - 1));
  }
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}

const fourSteps = ['identity', 'spaces', 'notifications', 'first_notice'];

// The brief's fixed test-host shape (task-9-brief.md): a top-level builder taking the
// file's own mock/fake types directly, matching every call site in this file.
// ignore: library_private_types_in_public_api
Widget host(int step, _Repo repo, _Session session, {Map<String, dynamic>? me, List<Override> extra = const []}) => ProviderScope(
  retry: (_, _) => null,
  overrides: [
    meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(me ?? meJson), DateTime.now()); }),
    spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
    meRepositoryProvider.overrideWith((_) async => repo),
    sessionControllerProvider.overrideWith(() => session),
    ...extra,
  ],
  child: MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: OnboardingScreen(step: step)));

void main() {
  testWidgets('identity step shows ERP facts, no typed input, and advances', (t) async {
    final repo = _Repo(); final session = _Session();
    when(() => repo.advanceOnboarding(0)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 1, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: false));
    await t.pumpWidget(host(0, repo, session));
    await t.pump();
    expect(find.text('Aditya Nair'), findsOneWidget);
    expect(find.text('24JIT0001'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Add a photo (optional)'), findsOneWidget);
    await t.tap(find.text('Continue'));
    await t.pumpAndSettle();
    expect(session.updated?.onboardingStep, 1);
  });

  testWidgets('lateral-entry copy appears when the student joined mid-way', (t) async {
    final me = Map<String, dynamic>.from(meJson)..['student'] = {...meJson['student'] as Map<String, dynamic>, 'isLateralEntry': true};
    await t.pumpWidget(host(1, _Repo(), _Session(), me: me));
    await t.pump();
    expect(find.textContaining('joining the batch mid-way'), findsOneWidget);
    expect(find.text('JIT College'), findsOneWidget);   // spaces revealed from the spaces provider
  });

  testWidgets('notifications step explains tiers, offers quiet hours, and the last step completes', (t) async {
    final repo = _Repo(); final session = _Session();
    when(() => repo.advanceOnboarding(2)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 3, onboardingSteps: ['identity', 'spaces', 'notifications'], onboardingComplete: true));
    await t.pumpWidget(host(2, repo, session));
    await t.pump();
    expect(find.textContaining('Urgent'), findsWidgets);
    expect(find.text('22:00'), findsOneWidget);
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();
    expect(session.updated?.onboardingComplete, isTrue);
  });

  group('first_notice (step 4)', () {
    late _Notices notices;
    late AppDatabase db;
    late Map<String, dynamic> welcome;
    setUpAll(() => registerFallbackValue(const AckInput(method: AckMethod.hold)));
    setUp(() {
      notices = _Notices();
      db = AppDatabase.memory();
      welcome = detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', body: 'This is where your college sends official notices.');
      when(notices.firstNotice).thenAnswer((_) async => NoticeDetail.fromJson(welcome));
    });
    tearDown(() => db.close());
    List<Override> extra() => [
          noticesRepositoryProvider.overrideWith((_) async => notices),
          appDatabaseProvider.overrideWith((_) async => db),
          analyticsProvider.overrideWithValue(SpyAnalytics()),
        ];

    testWidgets('shows the welcome notice, acknowledges it for real, and Finish completes onboarding', (t) async {
      final repo = _Repo(); final session = _Session(fourSteps);
      when(() => notices.acknowledge('w1', any())).thenAnswer((_) async {
        welcome = detailJson('w1', title: 'Welcome to Juvi', office: 'Juvi', deadline: null, purpose: 'welcome', state: 'acknowledged', ackAt: '2026-10-01T05:00:00.000Z');
        return AckRecord(ackAt: DateTime.utc(2026, 10, 1, 5), isLate: false, method: 'confirm', offline: false);
      });
      when(() => repo.advanceOnboarding(3)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 4, onboardingSteps: fourSteps, onboardingComplete: true));
      await t.pumpWidget(host(3, repo, session, extra: extra()));
      await t.pump();
      await t.pump();
      expect(find.text('Your first notice'), findsOneWidget);
      expect(find.text('Welcome to Juvi'), findsOneWidget);
      await t.tap(find.byType(AckControl));
      await t.pumpAndSettle();
      await t.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Acknowledge')));
      await t.pump();
      await t.pump();
      await t.pump();
      verify(() => notices.acknowledge('w1', any())).called(1);
      expect(find.textContaining('Acknowledged'), findsOneWidget);
      await t.tap(find.text('Finish'));
      await t.pumpAndSettle();
      expect(session.updated?.onboardingComplete, isTrue);
    });

    testWidgets('without a connection the step says the notice will wait on Today, and Finish still works', (t) async {
      final repo = _Repo(); final session = _Session(fourSteps);
      when(notices.firstNotice).thenThrow(const ApiFailure(ApiErrorCode.offline, "You're offline."));
      when(() => repo.advanceOnboarding(3)).thenAnswer((_) async => const OnboardingStateData(onboardingStep: 4, onboardingSteps: fourSteps, onboardingComplete: true));
      await t.pumpWidget(host(3, repo, session, extra: extra()));
      await t.pump();
      await t.pump();
      expect(find.textContaining('waiting on Today'), findsOneWidget);
      await t.tap(find.text('Finish'));
      await t.pumpAndSettle();
      expect(session.updated?.onboardingComplete, isTrue);
    });
  });

  testWidgets('a step this app does not know yet renders the generic card (spec §4 US-5.3)', (t) async {
    await t.pumpWidget(host(3, _Repo(), _Session(['identity', 'spaces', 'notifications', 'some_future_step'])));
    await t.pump();
    expect(find.textContaining('One more thing from your college'), findsOneWidget);
    expect(find.text('Finish'), findsOneWidget);
  });

  // Minor (e): `go()` leaves one route, so system back at step > 0 used to exit the app.
  testWidgets('system back at step 1 goes to step 0', (t) async {
    final router = GoRouter(
      initialLocation: '/onboarding/1',
      routes: [GoRoute(path: '/onboarding/:step', builder: (_, s) => OnboardingScreen(step: int.parse(s.pathParameters['step']!)))],
    );
    addTearDown(router.dispose);
    await t.pumpWidget(ProviderScope(
      overrides: [
        meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(meJson), DateTime.now()); }),
        spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
        meRepositoryProvider.overrideWith((_) async => _Repo()),
        sessionControllerProvider.overrideWith(_Session.new),
      ],
      child: MaterialApp.router(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, routerConfig: router),
    ));
    await t.pumpAndSettle();
    expect(find.text('Your spaces'), findsOneWidget);
    await t.binding.handlePopRoute();
    await t.pumpAndSettle();
    expect(router.state.uri.toString(), '/onboarding/0');
    expect(find.text('Your college has set you up'), findsOneWidget);
  });
}
