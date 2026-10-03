// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'deep_link_resolver.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(deepLinkResolver)
final deepLinkResolverProvider = DeepLinkResolverProvider._();

final class DeepLinkResolverProvider
    extends
        $FunctionalProvider<
          DeepLinkResolver,
          DeepLinkResolver,
          DeepLinkResolver
        >
    with $Provider<DeepLinkResolver> {
  DeepLinkResolverProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'deepLinkResolverProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$deepLinkResolverHash();

  @$internal
  @override
  $ProviderElement<DeepLinkResolver> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  DeepLinkResolver create(Ref ref) {
    return deepLinkResolver(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(DeepLinkResolver value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<DeepLinkResolver>(value),
    );
  }
}

String _$deepLinkResolverHash() => r'771832e9807f25906f28e5624865b40f82b8a379';
