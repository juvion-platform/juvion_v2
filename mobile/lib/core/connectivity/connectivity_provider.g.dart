// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'connectivity_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// True when any network interface is up. The offline banner and [SyncLifecycle]
/// (`lib/core/sync/sync_lifecycle.dart`) both watch this rather than polling.

@ProviderFor(isOnline)
final isOnlineProvider = IsOnlineProvider._();

/// True when any network interface is up. The offline banner and [SyncLifecycle]
/// (`lib/core/sync/sync_lifecycle.dart`) both watch this rather than polling.

final class IsOnlineProvider
    extends $FunctionalProvider<AsyncValue<bool>, bool, Stream<bool>>
    with $FutureModifier<bool>, $StreamProvider<bool> {
  /// True when any network interface is up. The offline banner and [SyncLifecycle]
  /// (`lib/core/sync/sync_lifecycle.dart`) both watch this rather than polling.
  IsOnlineProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'isOnlineProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$isOnlineHash();

  @$internal
  @override
  $StreamProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<bool> create(Ref ref) {
    return isOnline(ref);
  }
}

String _$isOnlineHash() => r'032d7e2b56f39d6f7c1609c570062df5e3682567';
