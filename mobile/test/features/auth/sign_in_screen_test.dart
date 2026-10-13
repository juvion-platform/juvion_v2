import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// riverpod 3.4.3 moved `Override` out of the main flutter_riverpod.dart barrel; see misc.dart.
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/sign_in_screen.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}

class _Session extends SessionController {
  ApiFailure? failWith;
  String? lastJuviId;
  @override
  SessionState build() => const SessionState.signedOut();
  @override
  Future<void> signIn({required String juviId, required String password}) async {
    lastJuviId = juviId;
    if (failWith != null) throw failWith!;
    state = const SessionState.signedIn(
      AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true),
    );
  }
}

Widget app(List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SignInScreen()),
    );

void main() {
  late _Auth auth;
  late _Session session;
  setUp(() {
    auth = _Auth();
    session = _Session();
  });
  List<Override> ov() => [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)];

  testWidgets('no institution-code field is rendered and no lookup is attempted', (t) async {
    await t.pumpWidget(app(ov()));
    expect(find.bySemanticsLabel('Juvi ID'), findsOneWidget);
    expect(find.bySemanticsLabel('Institution code'), findsNothing);
    verifyNever(() => auth.lookupInstitution(any()));
  });

  testWidgets('the typed Juvi ID reaches the controller, trimmed and otherwise untouched', (t) async {
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), '  juv 4k7p 2m9x  ');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    // Normalisation (case, separators) happens on the server, the only side that can be
    // trusted with it. The app must not mangle what the person transcribed (R-N).
    expect(session.lastJuviId, 'juv 4k7p 2m9x');
  });

  testWidgets('the button stays disabled until a Juvi ID and a password are present', (t) async {
    await t.pumpWidget(app(ov()));
    final button = find.widgetWithText(FilledButton, 'Sign in');
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNotNull);
  });

  testWidgets('wrong credentials show one generic message and keep the typed Juvi ID; cooldown shows minutes', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.invalidCredentials, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'bad');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('That Juvi ID or password is not right.'), findsOneWidget);
    expect(find.text('JUV-4K7P-2M9X'), findsOneWidget);
    session.failWith = const ApiFailure(ApiErrorCode.cooldown, 'x', detail: {'retryAfterSeconds': 540});
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Too many attempts. Try again in 9 minutes.'), findsOneWidget);
  });

  testWidgets('offline explains that sign-in needs a connection', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.offline, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'y');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.textContaining('needs a connection'), findsOneWidget);
  });

  testWidgets('a paused college is reported from the server, not from a lookup', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.institutionPaused, 'Back Monday');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Back Monday'), findsOneWidget);
  });

  testWidgets('forgot password opens the explanation sheet', (t) async {
    await t.pumpWidget(app(ov()));
    await t.tap(find.text('Forgot password?'));
    await t.pumpAndSettle();
    expect(find.textContaining('Your college resets Juvi passwords'), findsOneWidget);
  });
}
