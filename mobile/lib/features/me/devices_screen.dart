import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/me_repository.dart';
import 'package:juvi/shared/format.dart';
import 'package:juvi/shared/widgets/failure_view.dart';
import 'package:juvi/shared/widgets/skeleton.dart';

final FutureProvider<List<DeviceRow>> devicesProvider =
    FutureProvider.autoDispose<List<DeviceRow>>((ref) async => (await ref.read(meRepositoryProvider.future)).devices());

class DevicesScreen extends ConsumerWidget {
  const DevicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final devices = ref.watch(devicesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.devicesTitle)),
      body: devices.when(
        loading: () => const SkeletonList(),
        error: (e, _) => FailureView(ApiFailure.of(e), onRetry: () => ref.invalidate(devicesProvider)),
        data: (rows) => ListView(
          children: [
            for (final d in rows)
              ListTile(
                leading: Icon(d.platform == 'ios' ? Icons.phone_iphone : Icons.phone_android),
                title: Text(d.isCurrent ? l.deviceCurrentLabel(d.deviceName) : d.deviceName),
                subtitle: Text(l.deviceLastActive(d.appVersion, '${dayAndDate(DateTime.parse(d.lastActiveAt))} ${hhmm(DateTime.parse(d.lastActiveAt))}')),
                trailing: d.isCurrent
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.logout),
                        tooltip: l.deviceSignOutTooltip,
                        onPressed: () => _runAndNotify(context, ref, (repo) => repo.revokeDevice(d.sessionId)),
                      ),
              ),
            if (rows.length > 1)
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton(
                  onPressed: () => _runAndNotify(context, ref, (repo) => repo.revokeOtherDevices()),
                  child: Text(l.deviceSignOutOthers),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Revoking is online-only: a failure (offline included) is shown rather than dropped.
Future<void> _runAndNotify(BuildContext context, WidgetRef ref, Future<Object?> Function(MeRepository repo) action) async {
  try {
    await action(await ref.read(meRepositoryProvider.future));
    ref.invalidate(devicesProvider);
  } on ApiFailure catch (f) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
  }
}
