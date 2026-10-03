import 'package:flutter/foundation.dart';
import 'package:juvi/core/analytics/batching_analytics.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'analytics.g.dart';

/// Product events (Foundation spec §11, notifications spec §7.3): `app.opened`,
/// `account.signed_in`, `onboarding.step_completed {step}`, `onboarding.completed`,
/// `settings.changed {key}`, `channel.muted {muted}`, `notice.seen {noticeId}`,
/// `notice.acknowledged`, `notice.dismissed`, `notification.opened {tier}`,
/// `notification.permission {granted}`, `permission_card.shown`, `permission_card.dismissed`.
/// Payloads carry ids and enums only — never names, emails, identifiers or message text
/// (NFR-11); the server refuses anything else.
// The brief's fixed interface shape (task-10-brief.md): a single-method abstraction so
// call sites can be swapped for a real analytics SDK later without touching callers.
// ignore: one_member_abstracts
abstract class Analytics {
  void track(String event, [Map<String, Object?> props = const {}]);
}

@Riverpod(keepAlive: true)
Analytics analytics(Ref ref) {
  final analytics = BatchingAnalytics(
    database: () => ref.read(appDatabaseProvider.future),
    api: () => ref.read(mobileApiProvider),
    signedIn: () => ref.read(sessionControllerProvider) is SignedIn,
    log: kDebugMode ? debugPrint : null,
  );
  ref.onDispose(analytics.dispose);
  return analytics;
}
