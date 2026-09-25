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
import 'package:shared_preferences/shared_preferences.dart';

class _Auth extends Mock implements AuthRepository {}

class _Session extends SessionController {
  ApiFailure? failWith;
  @override
  SessionState build() => const SessionState.signedOut();
  @override
  Future<void> signIn({required String collegeId, required String identifier, required String password}) async {
    if (failWith != null) throw failWith!;
    state = const SessionState.signedIn(
      AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true),
    );
  }
}

const jit = InstitutionIdentity(collegeId: 'c1', name: 'JIT College', paused: false);

Widget app(List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SignInScreen()),
    );

void main() {
  late _Auth auth;
  late _Session session;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    auth = _Auth();
    session = _Session();
    registerFallbackValue(const DeviceInfo(id: 'd', name: 'n', platform: 'android', appVersion: '1', osVersion: '1'));
    when(() => auth.lookupInstitution('JIT')).thenAnswer((_) async => jit);
    when(() => auth.lookupInstitution('NOPE')).thenThrow(const ApiFailure(ApiErrorCode.notFound, "We couldn't find that college code."));
  });
  List<Override> ov() => [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)];

  testWidgets('resolves the institution code and shows the college name; unknown code shows the not-found message', (t) async {
    await t.pumpWidget(app(ov()));
    await t.pump(); // shared_preferences 2.5.5's getInstance() needs a second microtask/frame turn to resolve.
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('JIT College'), findsOneWidget);
    await t.enterText(find.bySemanticsLabel('Institution code'), 'NOPE');
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text("We couldn't find that college code."), findsOneWidget);
    expect(find.text('JIT College'), findsNothing);
  });

  testWidgets('sign-in button is disabled until code, identifier and password are present; success remembers the code', (t) async {
    await t.pumpWidget(app(ov()));
    await t.pump(); // shared_preferences 2.5.5's getInstance() needs a second microtask/frame turn to resolve.
    final button = find.widgetWithText(FilledButton, 'Sign in');
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '21CS1042');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNotNull);
    await t.tap(button);
    await t.pumpAndSettle();
    expect((await SharedPreferences.getInstance()).getString('juvi.institution_code'), 'JIT');
  });

  testWidgets('wrong credentials show one generic message and keep the typed identifier; cooldown shows minutes', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.invalidCredentials, 'x');
    await t.pumpWidget(app(ov()));
    await t.pump(); // shared_preferences 2.5.5's getInstance() needs a second microtask/frame turn to resolve.
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), '21CS1042');
    await t.enterText(find.bySemanticsLabel('Password'), 'bad');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('That identifier or password is not right.'), findsOneWidget);
    expect(find.text('21CS1042'), findsOneWidget);
    session.failWith = const ApiFailure(ApiErrorCode.cooldown, 'x', detail: {'retryAfterSeconds': 540});
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Too many attempts. Try again in 9 minutes.'), findsOneWidget);
  });

  testWidgets('offline explains that sign-in needs a connection', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.offline, 'x');
    await t.pumpWidget(app(ov()));
    await t.pump(); // shared_preferences 2.5.5's getInstance() needs a second microtask/frame turn to resolve.
    await t.enterText(find.bySemanticsLabel('Institution code'), 'JIT');
    await t.pump(const Duration(milliseconds: 600));
    await t.enterText(find.bySemanticsLabel('Roll number, employee code or email'), 'x');
    await t.enterText(find.bySemanticsLabel('Password'), 'y');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.textContaining('needs a connection'), findsOneWidget);
  });

  testWidgets('forgot password opens the explanation sheet', (t) async {
    await t.pumpWidget(app(ov()));
    await t.pump(); // shared_preferences 2.5.5's getInstance() needs a second microtask/frame turn to resolve.
    await t.tap(find.text('Forgot password?'));
    await t.pumpAndSettle();
    expect(find.textContaining('Your college resets Juvi passwords'), findsOneWidget);
  });
}
