import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/redirect.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/set_password_screen.dart';
import 'package:juvi/features/auth/sign_in_screen.dart';
import 'package:juvi/features/home/teaching_shell_screen.dart';
import 'package:juvi/features/home/today_shell_screen.dart';
import 'package:juvi/features/me/change_password_screen.dart';
import 'package:juvi/features/me/devices_screen.dart';
import 'package:juvi/features/me/me_screen.dart';
import 'package:juvi/features/me/settings_screen.dart';
import 'package:juvi/features/onboarding/onboarding_screen.dart';
import 'package:juvi/features/spaces/channel_screen.dart';
import 'package:juvi/features/spaces/spaces_screen.dart';
import 'package:juvi/features/system/deactivated_screen.dart';
import 'package:juvi/features/system/paused_screen.dart';
import 'package:juvi/features/system/splash_screen.dart';
import 'package:juvi/features/system/update_required_screen.dart';
import 'package:juvi/shared/widgets/app_shell.dart';

/// Bridges Riverpod state changes into GoRouter's refreshListenable.
class _SessionListenable extends ChangeNotifier {
  _SessionListenable(Ref ref) {
    ref.listen<SessionState>(sessionControllerProvider, (_, _) => notifyListeners());
  }
}

GoRouter buildRouter(Ref ref) {
  final listenable = _SessionListenable(ref);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) => redirect(ref.read(sessionControllerProvider), state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/set-password', builder: (_, _) => const SetPasswordScreen()),
      GoRoute(path: '/onboarding/:step', builder: (_, s) => OnboardingScreen(step: int.tryParse(s.pathParameters['step'] ?? '0') ?? 0)),
      GoRoute(path: '/deactivated', builder: (_, _) => const DeactivatedScreen()),
      GoRoute(path: '/paused', builder: (_, _) => const PausedScreen()),
      GoRoute(path: '/update-required', builder: (_, _) => const UpdateRequiredScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) {
          final session = ref.read(sessionControllerProvider);
          final kind = session is SignedIn ? session.account.kind : 'student';
          return AppShell(navigationShell: shell, kind: kind);
        },
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/today', builder: (_, _) => const TodayShellScreen()),
            GoRoute(path: '/teaching', builder: (_, _) => const TeachingShellScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/spaces', builder: (_, _) => const SpacesScreen(), routes: [
              GoRoute(path: ':channelId', builder: (_, s) => ChannelScreen(channelId: s.pathParameters['channelId']!)),
            ]),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/me', builder: (_, _) => const MeScreen(), routes: [
              GoRoute(path: 'settings', builder: (_, _) => const SettingsScreen()),
              GoRoute(path: 'devices', builder: (_, _) => const DevicesScreen()),
              GoRoute(path: 'change-password', builder: (_, _) => const ChangePasswordScreen()),
            ]),
          ]),
        ],
      ),
    ],
  );
}

final routerProvider = Provider<GoRouter>(buildRouter);
