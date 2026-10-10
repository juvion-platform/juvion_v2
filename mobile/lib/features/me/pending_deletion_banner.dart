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
      setState(() {
        _busy = false;
        _error = f.code == ApiErrorCode.deletionNotCancellable ? l.pendingDeletionTooLate : f.message;
      });
      return;
    }
    messenger.showSnackBar(SnackBar(content: Text(l.pendingDeletionCancelled)));
    ref.invalidate(meProvider);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
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
      child: SafeArea(
        top: insetAbove,
        bottom: false,
        child: Material(
          color: scheme.errorContainer,
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
                    onPressed: _busy ? null : _cancel,
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
