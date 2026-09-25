import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/redirect.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_state.dart';

AccountSummary acct({bool mustChange = false, int step = 3, bool complete = true, String kind = 'student'}) => AccountSummary(
      id: 'a', kind: kind, status: 'active', onboardingStep: step, onboardingSteps: const ['identity', 'spaces', 'notifications'],
      onboardingComplete: complete, mustChangePassword: mustChange);

void main() {
  group('redirect', () {
    test('loading pins to /splash', () {
      expect(redirect(const SessionState.loading(), '/today'), '/splash');
      expect(redirect(const SessionState.loading(), '/splash'), isNull);
    });
    test('signed out goes to /sign-in and stays there', () {
      expect(redirect(const SessionState.signedOut(), '/today'), '/sign-in');
      expect(redirect(const SessionState.signedOut(), '/sign-in'), isNull);
    });
    test('must-change-password wins over everything', () {
      expect(redirect(SessionState.signedIn(acct(mustChange: true)), '/today'), '/set-password');
      expect(redirect(SessionState.signedIn(acct(mustChange: true)), '/set-password'), isNull);
    });
    test('incomplete onboarding goes to the current step', () {
      expect(redirect(SessionState.signedIn(acct(step: 1, complete: false)), '/today'), '/onboarding/1');
      expect(redirect(SessionState.signedIn(acct(step: 1, complete: false)), '/onboarding/1'), isNull);
    });
    test('complete accounts leave gates for their home tab and keep app routes', () {
      expect(redirect(SessionState.signedIn(acct()), '/sign-in'), '/today');
      expect(redirect(SessionState.signedIn(acct(kind: 'faculty')), '/splash'), '/teaching');
      expect(redirect(SessionState.signedIn(acct()), '/spaces/abc'), isNull);
      expect(redirect(SessionState.signedIn(acct()), '/me/settings'), isNull);
    });
    test('system states are full-screen', () {
      expect(redirect(const SessionState.deactivated(), '/today'), '/deactivated');
      expect(redirect(const SessionState.paused('x'), '/spaces'), '/paused');
      expect(redirect(const SessionState.updateRequired(minVersion: '1', storeUrl: 'u'), '/me'), '/update-required');
      expect(redirect(const SessionState.paused('x'), '/paused'), isNull);
    });
  });
}
