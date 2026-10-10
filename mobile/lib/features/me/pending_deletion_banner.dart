import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/connectivity/connectivity_provider.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';

/// 011 Story 1 AC7: a public-web deletion request waiting on the account (Story 4 AC1), shown
/// wherever the user is and carrying the one action that stops it.
///
/// Triggered by `deletionRequestedAt` on `GET /me` — the cached document *is* the state, so the
/// 204 that clears it takes the banner away on its own, and the 409 that clears nothing leaves it
/// up. Mounted in `AppShell` above the tab content, which is what puts it on Settings too.
class PendingDeletionBanner extends ConsumerStatefulWidget {
  const PendingDeletionBanner({super.key});

  @override
  ConsumerState<PendingDeletionBanner> createState() => _PendingDeletionBannerState();
}

class _PendingDeletionBannerState extends ConsumerState<PendingDeletionBanner> {
  bool _busy = false;

  /// Terminal. The 409 means the deletion is already committing, so a second tap can only 409
  /// again — leaving the button live under a line that says the deletion "can no longer be
  /// cancelled" invites a tap that is guaranteed to fail.
  bool _tooLate = false;

  /// The line under the banner's own copy after a failed cancel. The 409 gets the app's *too late*
  /// wording rather than the server's English (AC5); anything else — offline above all — is the
  /// failure's own message, the way the rest of the app reports one.
  String? _error;

  /// `deletionRequestedAt` stays set on every failure path this reaches: a 409 means the deletion
  /// is already committing and nothing can stop it, an offline device never got there at all, and
  /// the repository only clears the cached request after a 204. So the banner is left alone — which
  /// is the point of the 409 existing instead of a 204 that would lie about having cancelled.
  Future<void> _cancel() async {
    final messenger = ScaffoldMessenger.of(context);
    final l = context.l10n;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await (await ref.read(meRepositoryProvider.future)).cancelAccountDeletion();
    } on ApiFailure catch (f) {
      if (!mounted) return;
      final tooLate = f.code == ApiErrorCode.deletionNotCancellable;
      setState(() {
        _busy = false;
        _tooLate = tooLate;
        _error = tooLate ? l.pendingDeletionTooLate : f.message;
      });
      return;
    }
    // The widget can be gone by the time the 204 lands: a concurrent 401, a deactivation or a
    // paused institution tears the session down, the router redirects, and the shell unmounts
    // while this DELETE is still in flight. Both calls below need the element alive —
    // `ref.invalidate` asserts it (`ConsumerStatefulElement.invalidate` → `_assertNotDisposed`,
    // package-private in `flutter_riverpod`, throwing a `StateError` out of a `Future` nobody
    // awaits) and `ScaffoldMessenger.showSnackBar` asserts it has a descendant `Scaffold` to
    // present to. The failure branch above is guarded for the same reason. Both are covered by
    // the one check because neither may run when it is false.
    if (!mounted) return;
    messenger.showSnackBar(SnackBar(content: Text(l.pendingDeletionCancelled)));
    ref.invalidate(meProvider);
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    // `_tooLate` and `_error` are terminal for one *request*, not for this element: the banner
    // returns `SizedBox.shrink` rather than unmounting, so this State outlives a request that is
    // cancelled on another device and then made again — and without the reset that second request
    // would render with Cancel already dead and, worse, the previous request's "no longer can be
    // cancelled" line still above it.
    //
    // The edge is a *changed* request, not merely a present one: a request cancelled elsewhere and
    // re-made while this device was away is never observed as absent here, only as a different
    // timestamp, so keying on presence would leave Cancel dead for the genuinely-new request. And
    // never on the present → absent edge, where there is no request to re-arm for.
    ref.listen(meProvider, (prev, next) {
      final was = prev?.value?.data.deletionRequestedAt;
      final now = next.value?.data.deletionRequestedAt;
      if (now != null && now != was && (_tooLate || _error != null)) {
        setState(() {
          _tooLate = false;
          _error = null;
        });
      }
    });
    final l = context.l10n;
    final me = ref.watch(meProvider).value?.data;
    if (me?.deletionRequestedAt == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    // `OfflineBanner` renders directly above this one and, when it is showing, has already
    // reserved the status-bar inset. Both are siblings in `AppShell`'s Column, so a second
    // SafeArea would add the status bar's height a second time.
    final insetAbove = ref.watch(isOnlineProvider).value != false;
    return Semantics(
      liveRegion: true,
      // `Material` outside `SafeArea`, matching `OfflineBanner` — the two are adjacent strips, and
      // with the nesting the other way round the status-bar strip above this one is painted with
      // the Scaffold background instead of `errorContainer`, so this banner stops short of the
      // chrome while its sibling runs under it.
      child: Material(
        color: scheme.errorContainer,
        child: SafeArea(
          top: insetAbove,
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 4, 0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(Icons.schedule_outlined, size: 16, color: scheme.onErrorContainer),
                  const SizedBox(width: 8),
                  Expanded(child: Text(l.pendingDeletionTitle, style: text.labelMedium?.copyWith(color: scheme.onErrorContainer))),
                ]),
                Text(l.pendingDeletionBody, style: text.labelSmall?.copyWith(color: scheme.onErrorContainer)),
                if (_error != null) Text(_error!, style: text.labelSmall?.copyWith(color: scheme.error)),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: (_busy || _tooLate) ? null : _cancel,
                    child: _busy
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(l.pendingDeletionCancel),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
