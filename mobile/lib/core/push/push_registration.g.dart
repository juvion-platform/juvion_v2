// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'push_registration.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(pushRegistration)
final pushRegistrationProvider = PushRegistrationProvider._();

final class PushRegistrationProvider
    extends
        $FunctionalProvider<
          PushRegistration,
          PushRegistration,
          PushRegistration
        >
    with $Provider<PushRegistration> {
  PushRegistrationProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'pushRegistrationProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$pushRegistrationHash();

  @$internal
  @override
  $ProviderElement<PushRegistration> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  PushRegistration create(Ref ref) {
    return pushRegistration(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PushRegistration value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PushRegistration>(value),
    );
  }
}

String _$pushRegistrationHash() => r'caffde2f64b1ee77a5c97f7a11023718f6317875';
