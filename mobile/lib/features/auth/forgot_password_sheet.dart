import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';

Future<void> showForgotPasswordSheet(BuildContext context, {SupportContact? contact}) => showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(c.l10n.forgotPassword, style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(c.l10n.forgotPasswordBody),
            if (contact != null) ...[
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.support_agent_outlined),
                title: Text(contact.name),
                subtitle: Text([contact.phone, contact.email].whereType<String>().join(' · ')),
              ),
            ],
          ],
        ),
      ),
    );
