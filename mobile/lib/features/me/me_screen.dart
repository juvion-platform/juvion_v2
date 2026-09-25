import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/features/me/photo_picker.dart';
import 'package:juvi/shared/widgets/as_of_line.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/identity_card.dart';
import 'package:juvi/shared/widgets/section_header.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

/// S12: identity, settings, devices, about and sign-out.
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final me = ref.watch(meProvider);
    final version = ref.watch(appVersionProvider).value ?? '';
    return Scaffold(
      appBar: AppBar(title: Text(l.tabMe)),
      body: me.when(
        loading: () => const SkeletonList(),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(meProvider)),
        data: (c) {
          final m = c.data;
          return ListView(
            children: [
              Padding(padding: const EdgeInsets.all(16), child: IdentityCard(m, onChangePhoto: () => pickAndUploadPhoto(context, ref))),
              if (c.stale) AsOfLine(c.asOf),
              TextButton(onPressed: () => _somethingWrong(context, l, m), child: Text(l.meReportIssue)),
              SectionHeader(l.meSettingsSectionTitle),
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: Text(l.settingsTitle),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.go('/me/settings'),
              ),
              ListTile(
                leading: const Icon(Icons.devices_outlined),
                title: Text(l.devicesTitle),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.go('/me/devices'),
              ),
              ListTile(
                leading: const Icon(Icons.password_outlined),
                title: Text(l.changePasswordTitle),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.go('/me/change-password'),
              ),
              SectionHeader(l.meAboutSection),
              ListTile(leading: const Icon(Icons.info_outline), title: Text(l.meAppVersion(version)), subtitle: Text(l.meDataPrivacyNote)),
              if (m.institution.supportContact != null)
                ListTile(
                  leading: const Icon(Icons.support_agent_outlined),
                  title: Text(m.institution.supportContact!.name),
                  subtitle: Text([m.institution.supportContact!.phone, m.institution.supportContact!.email].whereType<String>().join(' · ')),
                ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton(onPressed: () => unawaited(ref.read(sessionControllerProvider.notifier).signOut()), child: Text(l.meSignOut)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _somethingWrong(BuildContext context, AppLocalizations l, Me m) {
    final c = m.institution.supportContact;
    unawaited(showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.meSomethingWrongTitle, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(l.meSomethingWrongBody),
            if (c != null)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.support_agent_outlined),
                title: Text(c.name),
                subtitle: Text([c.phone, c.email].whereType<String>().join(' · ')),
              ),
          ],
        ),
      ),
    ));
  }
}
