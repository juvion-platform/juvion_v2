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
          if (!location.startsWith('/onboarding')) return target;
          // R54: back-navigation to an earlier step is fine; skipping ahead (including a
          // malformed or missing step) is pinned back to the account's current step.
          final segments = location.split('/');
          final n = segments.length > 2 ? int.tryParse(segments[2]) : null;
          return (n == null || n > account.onboardingStep) ? target : null;
        }
        if (_isGate(location)) return account.kind == 'student' ? '/today' : '/teaching';
        // I1: goBranch(0, initialLocation: true) always lands on /today, branch 0's first
        // route, regardless of kind — bounce a non-student off it, and a student off /teaching.
        if (location == '/today' && account.kind != 'student') return '/teaching';
        if (location == '/teaching' && account.kind == 'student') return '/today';
        return null;
      }(),
  };
}
