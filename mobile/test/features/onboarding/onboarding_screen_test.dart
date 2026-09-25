import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:mocktail/mocktail.dart';
import '../../core/repos/me_repository_test.dart' show meJson;
import '../spaces/spaces_screen_test.dart' show spacesJson;

class _Repo extends Mock implements MeRepository {}
class _Session extends SessionController {
  AccountSummary? updated;
  @override SessionState build() => SessionState.signedIn(Me.fromJson(meJson).account);
  @override Future<void> updateAccount(AccountSummary a) async { updated = a; state = SessionState.signedIn(a); }
}

// The brief's fixed test-host shape (task-9-brief.md): a top-level builder taking the
// file's own mock/fake types directly, matching every call site in this file.
// ignore: library_private_types_in_public_api
Widget host(int step, _Repo repo, _Session session, {Map<String, dynamic>? me}) => ProviderScope(
  overrides: [
    meProvider.overrideWith((_) async* { yield Cached(Me.fromJson(me ?? meJson), DateTime.now()); }),
    spacesProvider.overrideWith((_) async* { yield Cached(SpacesData.fromJson(spacesJson), DateTime.now()); }),
    meRepositoryProvider.overrideWith((_) async => repo),
    sessionControllerProvider.overrideWith(() => session),
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
}
