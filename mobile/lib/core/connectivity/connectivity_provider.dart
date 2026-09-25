import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'connectivity_provider.g.dart';

/// True when any network interface is up. The offline banner and `SyncLifecycle`
/// (`lib/core/sync/sync_lifecycle.dart`) both watch this rather than polling.
@Riverpod(keepAlive: true)
Stream<bool> isOnline(Ref ref) async* {
  final c = Connectivity();
  yield !(await c.checkConnectivity()).contains(ConnectivityResult.none);
  yield* c.onConnectivityChanged.map((r) => !r.contains(ConnectivityResult.none));
}
