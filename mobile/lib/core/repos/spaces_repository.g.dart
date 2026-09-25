// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spaces_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(spacesRepository)
final spacesRepositoryProvider = SpacesRepositoryProvider._();

final class SpacesRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<SpacesRepository>,
          SpacesRepository,
          FutureOr<SpacesRepository>
        >
    with $FutureModifier<SpacesRepository>, $FutureProvider<SpacesRepository> {
  SpacesRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'spacesRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$spacesRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<SpacesRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<SpacesRepository> create(Ref ref) {
    return spacesRepository(ref);
  }
}

String _$spacesRepositoryHash() => r'24fc5229620205adc297eb4950b72d90b2f94326';

/// Cached-then-network, same shape as `me` in `me_repository.dart`.

@ProviderFor(spaces)
final spacesProvider = SpacesProvider._();

/// Cached-then-network, same shape as `me` in `me_repository.dart`.

final class SpacesProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<SpacesData>>,
          Cached<SpacesData>,
          Stream<Cached<SpacesData>>
        >
    with
        $FutureModifier<Cached<SpacesData>>,
        $StreamProvider<Cached<SpacesData>> {
  /// Cached-then-network, same shape as `me` in `me_repository.dart`.
  SpacesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'spacesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$spacesHash();

  @$internal
  @override
  $StreamProviderElement<Cached<SpacesData>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<Cached<SpacesData>> create(Ref ref) {
    return spaces(ref);
  }
}

String _$spacesHash() => r'c4033c2045e9cd2a00cedec6af505f9c61266caf';

@ProviderFor(channel)
final channelProvider = ChannelFamily._();

final class ChannelProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<ChannelDetail>>,
          Cached<ChannelDetail>,
          Stream<Cached<ChannelDetail>>
        >
    with
        $FutureModifier<Cached<ChannelDetail>>,
        $StreamProvider<Cached<ChannelDetail>> {
  ChannelProvider._({
    required ChannelFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'channelProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$channelHash();

  @override
  String toString() {
    return r'channelProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<Cached<ChannelDetail>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<Cached<ChannelDetail>> create(Ref ref) {
    final argument = this.argument as String;
    return channel(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is ChannelProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$channelHash() => r'fa19d34289c30038a91cb9a2ccf9a85fd6887914';

final class ChannelFamily extends $Family
    with $FunctionalFamilyOverride<Stream<Cached<ChannelDetail>>, String> {
  ChannelFamily._()
    : super(
        retry: null,
        name: r'channelProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  ChannelProvider call(String id) =>
      ChannelProvider._(argument: id, from: this);

  @override
  String toString() => r'channelProvider';
}
