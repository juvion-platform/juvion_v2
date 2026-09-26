import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/features/me/photo_picker.dart';
import 'package:juvi/shared/widgets/identity_card.dart';

/// Step 1: the app already knows you. Zero typed input; photo is optional (spec S02).
class IdentityStep extends ConsumerWidget {
  const IdentityStep(this.me, {super.key});
  final Me me;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final contact = me.institution.supportContact;
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(l.onboardingIdentityTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Text(l.onboardingIdentityBody(me.institution.name)),
      const SizedBox(height: 20),
      IdentityCard(me, onChangePhoto: () => pickAndUploadPhoto(context, ref)),
      TextButton.icon(onPressed: () => pickAndUploadPhoto(context, ref), icon: const Icon(Icons.add_a_photo_outlined), label: Text(l.onboardingAddPhoto)),
      if (contact != null)
        TextButton(
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            showDragHandle: true,
            builder: (_) => ListTile(
              leading: const Icon(Icons.support_agent_outlined),
              title: Text(contact.name),
              subtitle: Text([contact.phone, contact.email].whereType<String>().join(' · ')),
            ),
          ),
          child: Text(l.meReportIssue),
        ),
    ]);
  }
}
