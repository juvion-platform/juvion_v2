import 'package:juvi/core/session/session_state.dart';

const _gates = {'/splash', '/sign-in', '/set-password', '/deactivated', '/paused', '/update-required'};
bool _isGate(String l) => _gates.contains(l) || l.startsWith('/onboarding');

/// The only routing brain: which screen is allowed for this session state?
String? redirect(SessionState state, String location) {
  return switch (state) {
    SessionLoading() => location == '/splash' ? null : '/splash',
    SignedOut() => location == '/sign-in' ? null : '/sign-in',
    Deactivated() => location == '/deactivated' ? null : '/deactivated',
    Paused() => location == '/paused' ? null : '/paused',
    UpdateRequired() => location == '/update-required' ? null : '/update-required',
    SignedIn(:final account) => () {
        if (account.mustChangePassword) return location == '/set-password' ? null : '/set-password';
        if (!account.onboardingComplete) {
          final target = '/onboarding/${account.onboardingStep}';
          return location.startsWith('/onboarding') ? null : target;
        }
        if (_isGate(location)) return account.kind == 'student' ? '/today' : '/teaching';
        return null;
      }(),
  };
}
