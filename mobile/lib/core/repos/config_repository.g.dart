// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(configRepository)
final configRepositoryProvider = ConfigRepositoryProvider._();

final class ConfigRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<ConfigRepository>,
          ConfigRepository,
          FutureOr<ConfigRepository>
        >
    with $FutureModifier<ConfigRepository>, $FutureProvider<ConfigRepository> {
  ConfigRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'configRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$configRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<ConfigRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ConfigRepository> create(Ref ref) {
    return configRepository(ref);
  }
}

String _$configRepositoryHash() => r'ec53e3895c10d34a658202366d4fbecef7bc1425';

/// Cached-then-network config; the theme reads the accent from here.

@ProviderFor(appConfig)
final appConfigProvider = AppConfigProvider._();

/// Cached-then-network config; the theme reads the accent from here.

final class AppConfigProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<AppConfigData>>,
          Cached<AppConfigData>,
          Stream<Cached<AppConfigData>>
        >
    with
        $FutureModifier<Cached<AppConfigData>>,
        $StreamProvider<Cached<AppConfigData>> {
  /// Cached-then-network config; the theme reads the accent from here.
  AppConfigProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'appConfigProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$appConfigHash();

  @$internal
  @override
  $StreamProviderElement<Cached<AppConfigData>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<Cached<AppConfigData>> create(Ref ref) {
    return appConfig(ref);
  }
}

String _$appConfigHash() => r'4667c40a2df4a4a7d59e5fde5a56a2c8122e8859';
