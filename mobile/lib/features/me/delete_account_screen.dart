import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/shared/widgets/section_header.dart';

/// The phrase the user has to type (011 Story 1 AC2). Exact — not case-folded and not trimmed,
/// so `delete`, `Delete` and `DELETE ` are all refused.
const deleteAccountPhrase = 'DELETE';

/// The confirmation screen behind the Settings row. Opening it tells the user exactly what the
/// deletion takes and what the college keeps (AC1); the destructive action itself needs the
/// phrase above (AC2) and is supplied by the caller (T20), so this screen owns the gate and the
/// disclosure rather than the call.
class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key, this.onConfirm});

  /// The confirmed action — the server call and the wipe that follows it (T20). Null until the
  /// route supplies it, which is what lets a test drive success and failure directly.
  final Future<void> Function()? onConfirm;

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _typed = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  /// AC4: a failed or offline delete leaves everything as it was, so the failure is shown and the
  /// screen stays usable — the phrase is still typed, so a retry does not mean typing it again.
  /// On success the controller flips to signed-out and the router takes this screen away, which
  /// is why nothing resets `_busy` in that case.
  Future<void> _confirm() async {
    setState(() => _busy = true);
    try {
      await widget.onConfirm?.call();
    } on ApiFailure catch (f) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final error = Theme.of(context).colorScheme.error;
    const spinner = SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5));
    return Scaffold(
      appBar: AppBar(title: Text(l.deleteAccountTitle)),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          SectionHeader(l.deleteAccountDeletedSection),
          for (final line in [
            l.deleteAccountDeletedAccount,
            l.deleteAccountDeletedDevices,
            l.deleteAccountDeletedChannels,
            l.deleteAccountDeletedDeliveries,
            l.deleteAccountDeletedAnalytics,
            l.deleteAccountDeletedNoticeState,
          ])
            ListTile(leading: Icon(Icons.remove_circle_outline, color: error), title: Text(line), dense: true),
          SectionHeader(l.deleteAccountRetainedSection),
          for (final line in [
            l.deleteAccountRetainedRecords,
            l.deleteAccountRetainedAudience,
            l.deleteAccountRetainedPhoto,
          ])
            ListTile(leading: const Icon(Icons.shield_outlined), title: Text(line), dense: true),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
            child: TextField(
              controller: _typed,
              autocorrect: false,
              decoration: InputDecoration(labelText: l.deleteAccountPhraseLabel, helperText: l.deleteAccountPhraseHint(deleteAccountPhrase)),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton(
              onPressed: !_busy && _typed.text == deleteAccountPhrase ? _confirm : null,
              child: _busy ? spinner : Text(l.deleteAccountConfirm),
            ),
          ),
        ],
      ),
    );
  }
}
