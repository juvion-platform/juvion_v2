// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'permission_card.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// When S14 was last dismissed, kept in shared preferences (a device setting, so it
/// survives sign-out).

@ProviderFor(PermissionCardDismissal)
final permissionCardDismissalProvider = PermissionCardDismissalProvider._();

/// When S14 was last dismissed, kept in shared preferences (a device setting, so it
/// survives sign-out).
final class PermissionCardDismissalProvider
    extends $AsyncNotifierProvider<PermissionCardDismissal, DateTime?> {
  /// When S14 was last dismissed, kept in shared preferences (a device setting, so it
  /// survives sign-out).
  PermissionCardDismissalProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'permissionCardDismissalProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$permissionCardDismissalHash();

  @$internal
  @override
  PermissionCardDismissal create() => PermissionCardDismissal();
}

String _$permissionCardDismissalHash() =>
    r'ef64253be62779815da0207a3c33dbde4e9b0396';

/// When S14 was last dismissed, kept in shared preferences (a device setting, so it
/// survives sign-out).

abstract class _$PermissionCardDismissal extends $AsyncNotifier<DateTime?> {
  FutureOr<DateTime?> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<DateTime?>, DateTime?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<DateTime?>, DateTime?>,
              AsyncValue<DateTime?>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
