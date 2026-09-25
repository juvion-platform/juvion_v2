// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(secureStore)
final secureStoreProvider = SecureStoreProvider._();

final class SecureStoreProvider
    extends $FunctionalProvider<SecureStore, SecureStore, SecureStore>
    with $Provider<SecureStore> {
  SecureStoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'secureStoreProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$secureStoreHash();

  @$internal
  @override
  $ProviderElement<SecureStore> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  SecureStore create(Ref ref) {
    return secureStore(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SecureStore value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SecureStore>(value),
    );
  }
}

String _$secureStoreHash() => r'4152faa8e5b4f3e77b4fbdc5fc1bb48f80b1a2d0';

@ProviderFor(appDatabase)
final appDatabaseProvider = AppDatabaseProvider._();

final class AppDatabaseProvider
    extends
        $FunctionalProvider<
          AsyncValue<AppDatabase>,
          AppDatabase,
          FutureOr<AppDatabase>
        >
    with $FutureModifier<AppDatabase>, $FutureProvider<AppDatabase> {
  AppDatabaseProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'appDatabaseProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$appDatabaseHash();

  @$internal
  @override
  $FutureProviderElement<AppDatabase> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<AppDatabase> create(Ref ref) {
    return appDatabase(ref);
  }
}

String _$appDatabaseHash() => r'b8bd777b6b5fc2c1cb9b4e5435a2d1412f6ca88f';

@ProviderFor(appVersion)
final appVersionProvider = AppVersionProvider._();

final class AppVersionProvider
    extends $FunctionalProvider<AsyncValue<String>, String, FutureOr<String>>
    with $FutureModifier<String>, $FutureProvider<String> {
  AppVersionProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'appVersionProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$appVersionHash();

  @$internal
  @override
  $FutureProviderElement<String> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<String> create(Ref ref) {
    return appVersion(ref);
  }
}

String _$appVersionHash() => r'59b58cc8214f60571dfe517b1f68cfc1aed29718';

/// No interceptors, no Bearer token: used for calls made before a session exists
/// (institution lookup, sign-in, refresh). `lib/core/repos/auth_repository.dart`'s
/// `lookupInstitution` also reads this directly (see its doc comment for why).

@ProviderFor(bareDio)
final bareDioProvider = BareDioProvider._();

/// No interceptors, no Bearer token: used for calls made before a session exists
/// (institution lookup, sign-in, refresh). `lib/core/repos/auth_repository.dart`'s
/// `lookupInstitution` also reads this directly (see its doc comment for why).

final class BareDioProvider extends $FunctionalProvider<Dio, Dio, Dio>
    with $Provider<Dio> {
  /// No interceptors, no Bearer token: used for calls made before a session exists
  /// (institution lookup, sign-in, refresh). `lib/core/repos/auth_repository.dart`'s
  /// `lookupInstitution` also reads this directly (see its doc comment for why).
  BareDioProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'bareDioProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$bareDioHash();

  @$internal
  @override
  $ProviderElement<Dio> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Dio create(Ref ref) {
    return bareDio(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Dio value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Dio>(value),
    );
  }
}

String _$bareDioHash() => r'605273bcdd5e9a12245f3843a29b7e1df1c2de7f';

@ProviderFor(bareMobileApi)
final bareMobileApiProvider = BareMobileApiProvider._();

final class BareMobileApiProvider
    extends $FunctionalProvider<wire.MobileApi, wire.MobileApi, wire.MobileApi>
    with $Provider<wire.MobileApi> {
  BareMobileApiProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'bareMobileApiProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$bareMobileApiHash();

  @$internal
  @override
  $ProviderElement<wire.MobileApi> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  wire.MobileApi create(Ref ref) {
    return bareMobileApi(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(wire.MobileApi value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<wire.MobileApi>(value),
    );
  }
}

String _$bareMobileApiHash() => r'59fe59e966cf5c2d2a0167bc63b891c8d5efcab4';

@ProviderFor(dio)
final dioProvider = DioProvider._();

final class DioProvider extends $FunctionalProvider<Dio, Dio, Dio>
    with $Provider<Dio> {
  DioProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'dioProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$dioHash();

  @$internal
  @override
  $ProviderElement<Dio> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Dio create(Ref ref) {
    return dio(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Dio value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Dio>(value),
    );
  }
}

String _$dioHash() => r'196f205b268a5114d6230031861d307f586f12cf';

@ProviderFor(mobileApi)
final mobileApiProvider = MobileApiProvider._();

final class MobileApiProvider
    extends $FunctionalProvider<wire.MobileApi, wire.MobileApi, wire.MobileApi>
    with $Provider<wire.MobileApi> {
  MobileApiProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'mobileApiProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$mobileApiHash();

  @$internal
  @override
  $ProviderElement<wire.MobileApi> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  wire.MobileApi create(Ref ref) {
    return mobileApi(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(wire.MobileApi value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<wire.MobileApi>(value),
    );
  }
}

String _$mobileApiHash() => r'1b066eda29b7eb7250a17b82aa2c71476e4d3447';
