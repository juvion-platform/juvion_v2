import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/notices.dart';

/// The deliberate acknowledgement gesture (spec §4 US-2.2, §9). Holding for
/// [holdDuration] fills the ring and acknowledges with [AckMethod.hold]; a shorter
/// press is a tap, which opens a confirmation that acknowledges with
/// [AckMethod.confirm]. There is no single-tap path. Under a screen reader
/// (`MediaQuery.accessibleNavigation`) only the confirm path is offered.
///
/// The hold is timed from the moment the press is recognised. Inside a scrollable,
/// Flutter waits `kPressTimeout` (100 ms) to tell a press from a scroll first, so a
/// scroll that starts on the control never acknowledges.
class AckControl extends StatefulWidget {
  const AckControl({required this.onAcknowledge, this.busy = false, super.key});
  final ValueChanged<AckMethod> onAcknowledge;

  /// True while the caller waits for the server; the control shows progress and takes
  /// no input. The gesture detector stays in the tree, so a finger still down when the
  /// hold completes is never handed to an enclosing tap target (the card's `InkWell`).
  final bool busy;

  static const holdDuration = Duration(milliseconds: 1200);

  @override
  State<AckControl> createState() => _AckControlState();
}

class _AckControlState extends State<AckControl> with SingleTickerProviderStateMixin {
  late final AnimationController _hold;
  bool _held = false;

  /// Queued item 3: true while the confirmation dialog from a tap is open, guarding
  /// against two fast taps pushing two stacked dialogs — the second `_confirm` call
  /// (from a second tap, or the control's own semantic tap under a screen reader)
  /// becomes a no-op until the first dialog is dismissed.
  bool _confirmOpen = false;

  @override
  void initState() {
    super.initState();
    _hold = AnimationController(vsync: this, duration: AckControl.holdDuration)..addStatusListener(_onHoldStatus);
  }

  void _onHoldStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || widget.busy) return;
    _held = true;
    unawaited(HapticFeedback.mediumImpact());
    widget.onAcknowledge(AckMethod.hold);
  }

  void _down(TapDownDetails _) {
    if (widget.busy) return;
    _held = false;
    unawaited(_hold.forward(from: 0));
  }

  void _up(TapUpDetails _) {
    if (_held) {
      _held = false;
      _hold.reset();
      return;
    }
    _hold.reset();
    if (!widget.busy) unawaited(_confirm());
  }

  Future<void> _confirm() async {
    if (_confirmOpen) return;
    _confirmOpen = true;
    final l = context.l10n;
    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(l.ackConfirmTitle),
          content: Text(l.ackConfirmBody),
          actions: [
            TextButton(onPressed: () => Navigator.of(c).pop(false), child: Text(l.cancel)),
            FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(l.ackButton)),
          ],
        ),
      );
      if ((ok ?? false) && mounted && !widget.busy) widget.onAcknowledge(AckMethod.confirm);
    } finally {
      _confirmOpen = false;
    }
  }

  @override
  void dispose() {
    _hold.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final busy = widget.busy;
    const spinner = SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5));
    if (MediaQuery.accessibleNavigationOf(context)) {
      return Semantics(
        hint: l.ackOpensConfirmation,
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(onPressed: busy ? null : _confirm, child: busy ? spinner : Text(l.ackButton)),
        ),
      );
    }
    return Semantics(
      button: true,
      label: l.ackHoldLabel,
      hint: l.ackOpensConfirmation,
      onTap: busy ? null : _confirm,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _down,
        onTapUp: _up,
        onTapCancel: _hold.reset,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(28)),
          child: busy
              ? const Center(child: spinner)
              : Row(
                  children: [
                    SizedBox.square(
                      dimension: 32,
                      child: AnimatedBuilder(
                        animation: _hold,
                        builder: (_, _) => Stack(
                          alignment: Alignment.center,
                          children: [
                            CircularProgressIndicator(value: _hold.value, strokeWidth: 3, backgroundColor: scheme.surface.withValues(alpha: 0.6)),
                            Icon(Icons.check, size: 18, color: scheme.onPrimaryContainer),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l.ackHoldLabel,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(color: scheme.onPrimaryContainer, fontWeight: FontWeight.w700),
                          ),
                          Text(l.ackHoldHint, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.onPrimaryContainer)),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
