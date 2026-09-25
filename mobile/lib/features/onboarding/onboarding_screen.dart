import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/repos/spaces_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/onboarding/steps/identity_step.dart';
import 'package:juvi/features/onboarding/steps/notifications_step.dart';
import 'package:juvi/features/onboarding/steps/spaces_step.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S02: server-driven onboarding. `account.onboardingSteps[step]` names the step to
/// render (identity, spaces, notifications); an unrecognised name renders a generic
/// continue card so a future server-added step never bricks the app. `lib/app/redirect.dart`
/// is the routing brain (R54): it holds a signed-in-but-incomplete account on
/// `/onboarding/<step>` and only forces the location forward once `account.onboardingStep`
/// itself moves past it, so this screen still has to push the next location itself after a
/// successful Continue (see `_advance`) — the redirect only rescues a skipped-ahead or
/// completed location.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({required this.step, super.key});
  final int step;
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _advance(AccountSummary account) async {
    final l = context.l10n;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repo = await ref.read(meRepositoryProvider.future);
      final next = await repo.advanceOnboarding(widget.step);
      await ref
          .read(sessionControllerProvider.notifier)
          .updateAccount(
            account.copyWith(
              onboardingStep: next.onboardingStep,
              onboardingSteps: next.onboardingSteps,
              onboardingComplete: next.onboardingComplete,
              status: next.onboardingComplete ? 'active' : account.status,
            ),
          );
      ref.read(analyticsProvider).track('onboarding.step_completed', {'step': widget.step});
      if (next.onboardingComplete) ref.read(analyticsProvider).track('onboarding.completed');
      // GoRouter.maybeOf keeps the screen testable without a router; in the app the
      // router is always present. Completion is left to redirect.dart (the account is
      // no longer "incomplete", so the next redirect check bounces it home); an
      // in-progress step is not, by itself, enough for redirect.dart to move forward
      // (R54: staying on step N when N <= account.onboardingStep is intentional, so the
      // back button works), so this screen pushes the next step explicitly.
      if (mounted && !next.onboardingComplete) GoRouter.maybeOf(context)?.go('/onboarding/${next.onboardingStep}');
    } on ApiFailure catch (f) {
      if (mounted) setState(() => _error = f.isOffline ? l.onboardingStepNeedsConnection : f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final account = session is SignedIn ? session.account : null;
    if (account == null) return const Scaffold(body: SizedBox.shrink());
    final steps = account.onboardingSteps;
    final name = widget.step < steps.length ? steps[widget.step] : 'unknown';
    final isLast = widget.step >= steps.length - 1;
    // `name` only needs `account` (already available), so the spaces step's own stream
    // can start on this same build rather than one build later, when SpacesStep first
    // watches it itself — two providers first watched on the same build resolve together
    // within a single test pump(); staggered, the second needs a pump of its own.
    if (name == 'spaces') ref.watch(spacesProvider);
    final me = ref.watch(meProvider);

    // `go()` leaves a single route, so without this system back at step > 0 would exit
    // the app; it goes to the previous step instead, like the app-bar back button.
    return PopScope(
      canPop: widget.step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) GoRouter.maybeOf(context)?.go('/onboarding/${widget.step - 1}');
      },
      child: Scaffold(
        appBar: AppBar(
          leading: widget.step > 0 ? BackButton(onPressed: () => GoRouter.maybeOf(context)?.go('/onboarding/${widget.step - 1}')) : null,
          title: Semantics(
            label: l.onboardingStepOfTotal(widget.step + 1, steps.length),
            child: ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var i = 0; i < steps.length; i++)
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      decoration: BoxDecoration(shape: BoxShape.circle, color: i <= widget.step ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outlineVariant),
                    ),
                ],
              ),
            ),
          ),
          centerTitle: true,
        ),
        body: me.when(
          loading: () => const SkeletonList(),
          error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider)),
          data: (c) => Column(
            children: [
              Expanded(
                child: switch (name) {
                  'identity' => IdentityStep(c.data),
                  'spaces' => SpacesStep(c.data),
                  'notifications' => NotificationsStep(c.data),
                  _ => Center(
                    child: Padding(padding: const EdgeInsets.all(24), child: Text(l.onboardingUnknownStepBody)),
                  ),
                },
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: FilledButton(onPressed: _busy ? null : () => _advance(account), child: Text(isLast ? l.onboardingFinish : l.onboardingContinue)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
