import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';

/// A single row in the Spaces list (S06). Tap opens the channel; long-press opens the
/// mute/mark-read sheet. The long-press also gets a named semantics custom action, so
/// it's reachable without a long-press gesture (screen readers surface it as an action).
class ChannelRow extends StatelessWidget {
  const ChannelRow(this.c, {required this.onTap, required this.onLongPress, super.key});
  final SpaceChannel c;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final faded = c.archived ? scheme.onSurfaceVariant : null;
    return Semantics(
      customSemanticsActions: {CustomSemanticsAction(label: l.channelActionsLabel): onLongPress},
      child: ListTile(
        onTap: onTap,
        onLongPress: onLongPress,
        leading: CircleAvatar(
          backgroundColor: c.templateCode == 'college' ? scheme.primaryContainer : scheme.surfaceContainerHighest,
          child: Text(c.name.characters.first, style: TextStyle(color: faded)),
        ),
        title: Text(c.name, style: TextStyle(color: faded, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(c.nextClassLabel ?? c.about, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: c.muted
            ? Icon(Icons.notifications_off_outlined, size: 18, color: scheme.onSurfaceVariant, semanticLabel: l.channelMutedLabel)
            : null,
      ),
    );
  }
}
