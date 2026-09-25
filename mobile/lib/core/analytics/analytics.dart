import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'analytics.g.dart';

/// Foundation product events (spec §11): `app.opened`, `account.signed_in`,
/// `onboarding.step_completed {step}`, `onboarding.completed`,
/// `settings.changed {key}`, `channel.muted {muted}`. Payloads carry ids and enums
/// only — never names, emails, identifiers or message text (NFR-11).
// The brief's fixed interface shape (task-10-brief.md): a single-method abstraction so
// call sites can be swapped for a real analytics SDK later without touching callers.
// ignore: one_member_abstracts
abstract class Analytics {
  void track(String event, [Map<String, Object?> props = const {}]);
}

class ConsoleAnalytics implements Analytics {
  @override
  void track(String event, [Map<String, Object?> props = const {}]) {
    // Never prints in release builds, and never carries PII — callers only ever pass
    // ids/enums (see call sites in session_controller.dart, onboarding_screen.dart,
    // me_repository.dart and spaces_repository.dart).
    if (kDebugMode) debugPrint('[analytics] $event ${props.isEmpty ? '' : props}');
  }
}

@Riverpod(keepAlive: true)
Analytics analytics(Ref ref) => ConsoleAnalytics();
