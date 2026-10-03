import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/analytics/analytics.dart';
import 'package:juvi/core/push/notification_permission.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'permission_card.g.dart';

/// S14 comes back at most once every 30 days after it is dismissed (spec §8.4).
const permissionCardCooldown = Duration(days: 30);

bool permissionCardDue({required bool? allowed, required DateTime? dismissedAt, required DateTime now}) =>
    allowed == false && (dismissedAt == null || now.difference(dismissedAt) >= permissionCardCooldown);

/// When S14 was last dismissed, kept in shared preferences (a device setting, so it
/// survives sign-out).
@Riverpod(keepAlive: true)
class PermissionCardDismissal extends _$PermissionCardDismissal {
  static const key = 'juvi.permission_card.dismissed_at';

  @override
  Future<DateTime?> build() async {
    final raw = (await SharedPreferences.getInstance()).getString(key);
    return raw == null ? null : DateTime.tryParse(raw);
  }

  Future<void> dismiss(DateTime at) async {
    state = AsyncData(at);
    await (await SharedPreferences.getInstance()).setString(key, at.toUtc().toIso8601String());
  }
}

/// S14 on Today and Teaching: shown while the OS permission is off and the card is due.
/// Records `permission_card.shown` once per appearance and `permission_card.dismissed`.
class PermissionCard extends ConsumerStatefulWidget {
  const PermissionCard({this.now, super.key});

  /// Fixed in tests; the wall clock otherwise.
  final DateTime Function()? now;

  @override
  ConsumerState<PermissionCard> createState() => _PermissionCardState();
}

class _PermissionCardState extends ConsumerState<PermissionCard> {
  bool _trackedShown = false;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  Widget build(BuildContext context) {
    final allowed = ref.watch(notificationsAllowedProvider).value;
    final dismissal = ref.watch(permissionCardDismissalProvider);
    // Until the dismissal date has loaded, the card stays hidden rather than flashing.
    final due = dismissal.hasValue && permissionCardDue(allowed: allowed, dismissedAt: dismissal.value, now: _now());
    if (!due) {
      _trackedShown = false;
      return const SizedBox.shrink();
    }
    if (!_trackedShown) {
      _trackedShown = true;
      ref.read(analyticsProvider).track('permission_card.shown');
    }
    return PermissionDeniedCard(
      onOpenSettings: () => unawaited(ref.read(notificationPermissionProvider).openSettings()),
      onDismiss: () {
        ref.read(analyticsProvider).track('permission_card.dismissed');
        unawaited(ref.read(permissionCardDismissalProvider.notifier).dismiss(_now()));
      },
    );
  }
}

/// The card itself, presentational (golden-tested).
class PermissionDeniedCard extends StatelessWidget {
  const PermissionDeniedCard({required this.onOpenSettings, required this.onDismiss, super.key});
  final VoidCallback onOpenSettings;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      color: scheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2, right: 12),
                  child: Icon(Icons.notifications_off_outlined, color: scheme.onErrorContainer),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.permissionCardTitle, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: scheme.onErrorContainer)),
                      const SizedBox(height: 4),
                      Text(l.permissionCardBody, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onErrorContainer)),
                    ],
                  ),
                ),
              ],
            ),
            // OverflowBar stacks the buttons instead of overflowing at large text scales.
            OverflowBar(
              alignment: MainAxisAlignment.end,
              overflowAlignment: OverflowBarAlignment.end,
              spacing: 8,
              children: [
                TextButton(onPressed: onDismiss, child: Text(l.permissionCardDismiss)),
                FilledButton.tonal(onPressed: onOpenSettings, child: Text(l.permissionCardOpenSettings)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
