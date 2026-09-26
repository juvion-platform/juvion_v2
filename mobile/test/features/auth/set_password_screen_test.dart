import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/set_password_screen.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}

const acct = AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true);

class _Session extends SessionController {
  AccountSummary? updated;
  @override
  SessionState build() => const SessionState.signedIn(acct);
  @override
  Future<void> updateAccount(AccountSummary a) async {
    updated = a;
    state = SessionState.signedIn(a);
  }
}

void main() {
  testWidgets('validates length client-side, submits, and clears the must-change flag', (t) async {
    final auth = _Auth();
    final session = _Session();
    when(() => auth.changePassword('river-lamp-482', 'longenough1')).thenAnswer((_) async {});
    await t.pumpWidget(ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SetPasswordScreen()),
    ));
    await t.enterText(find.bySemanticsLabel('Current password'), 'river-lamp-482');
    await t.enterText(find.bySemanticsLabel('New password'), 'short');
    await t.tap(find.text('Save password'));
    await t.pump();
    expect(find.text('Use at least 8 characters'), findsOneWidget);
    verifyNever(() => auth.changePassword(any(), any()));
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();
    expect(session.updated?.mustChangePassword, isFalse);
  });

  testWidgets('a wrong current password shows the server message and keeps input', (t) async {
    final auth = _Auth();
    final session = _Session();
    when(() => auth.changePassword(any(), any())).thenThrow(const ApiFailure(ApiErrorCode.invalidCredentials, 'Your current password is not right.'));
    await t.pumpWidget(ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)],
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SetPasswordScreen()),
    ));
    await t.enterText(find.bySemanticsLabel('Current password'), 'nope');
    await t.enterText(find.bySemanticsLabel('New password'), 'longenough1');
    await t.tap(find.text('Save password'));
    await t.pumpAndSettle();
    expect(find.text('Your current password is not right.'), findsOneWidget);
    expect(find.text('longenough1'), findsOneWidget);
  });
}
