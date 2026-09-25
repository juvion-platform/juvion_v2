// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(meRepository)
final meRepositoryProvider = MeRepositoryProvider._();

final class MeRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<MeRepository>,
          MeRepository,
          FutureOr<MeRepository>
        >
    with $FutureModifier<MeRepository>, $FutureProvider<MeRepository> {
  MeRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'meRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$meRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<MeRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<MeRepository> create(Ref ref) {
    return meRepository(ref);
  }
}

String _$meRepositoryHash() => r'7d2860ef29c20224ddfc5dfb7022fae60aafe605';

/// Cached-then-network. A fresh /me also refreshes the session's account summary.

@ProviderFor(me)
final meProvider = MeProvider._();

/// Cached-then-network. A fresh /me also refreshes the session's account summary.

final class MeProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<Me>>,
          Cached<Me>,
          Stream<Cached<Me>>
        >
    with $FutureModifier<Cached<Me>>, $StreamProvider<Cached<Me>> {
  /// Cached-then-network. A fresh /me also refreshes the session's account summary.
  MeProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'meProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$meHash();

  @$internal
  @override
  $StreamProviderElement<Cached<Me>> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Cached<Me>> create(Ref ref) {
    return me(ref);
  }
}

String _$meHash() => r'540381c2de022ce3b61679157f4823ac2a89d81a';

/// Optimistic settings with an offline queue (spec §11 pending actions).

@ProviderFor(SettingsController)
final settingsControllerProvider = SettingsControllerProvider._();

/// Optimistic settings with an offline queue (spec §11 pending actions).
final class SettingsControllerProvider
    extends $AsyncNotifierProvider<SettingsController, Settings?> {
  /// Optimistic settings with an offline queue (spec §11 pending actions).
  SettingsControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'settingsControllerProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$settingsControllerHash();

  @$internal
  @override
  SettingsController create() => SettingsController();
}

String _$settingsControllerHash() =>
    r'4d297feba5c290f4a6b3da765e6b19af3ecc0add';

/// Optimistic settings with an offline queue (spec §11 pending actions).

abstract class _$SettingsController extends $AsyncNotifier<Settings?> {
  FutureOr<Settings?> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<Settings?>, Settings?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<Settings?>, Settings?>,
              AsyncValue<Settings?>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
