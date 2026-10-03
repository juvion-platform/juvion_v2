// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'push_messaging.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// `main()` overrides these two with the Firebase and plugin implementations once
/// Firebase is up; everywhere else (tests included) push is inert.

@ProviderFor(pushMessaging)
final pushMessagingProvider = PushMessagingProvider._();

/// `main()` overrides these two with the Firebase and plugin implementations once
/// Firebase is up; everywhere else (tests included) push is inert.

final class PushMessagingProvider
    extends $FunctionalProvider<PushMessaging, PushMessaging, PushMessaging>
    with $Provider<PushMessaging> {
  /// `main()` overrides these two with the Firebase and plugin implementations once
  /// Firebase is up; everywhere else (tests included) push is inert.
  PushMessagingProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'pushMessagingProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$pushMessagingHash();

  @$internal
  @override
  $ProviderElement<PushMessaging> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  PushMessaging create(Ref ref) {
    return pushMessaging(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PushMessaging value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PushMessaging>(value),
    );
  }
}

String _$pushMessagingHash() => r'6b23dc75eefdd211f71c20728c5c0bfe12077fdb';

@ProviderFor(localNotifications)
final localNotificationsProvider = LocalNotificationsProvider._();

final class LocalNotificationsProvider
    extends
        $FunctionalProvider<
          LocalNotifications,
          LocalNotifications,
          LocalNotifications
        >
    with $Provider<LocalNotifications> {
  LocalNotificationsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localNotificationsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localNotificationsHash();

  @$internal
  @override
  $ProviderElement<LocalNotifications> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  LocalNotifications create(Ref ref) {
    return localNotifications(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(LocalNotifications value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<LocalNotifications>(value),
    );
  }
}

String _$localNotificationsHash() =>
    r'100e8be4170a7152918e7000951d35cc85260e10';

/// Receipts from the foreground, on the session-less Dio (spec §7.2).

@ProviderFor(receipts)
final receiptsProvider = ReceiptsProvider._();

/// Receipts from the foreground, on the session-less Dio (spec §7.2).

final class ReceiptsProvider
    extends $FunctionalProvider<Receipts, Receipts, Receipts>
    with $Provider<Receipts> {
  /// Receipts from the foreground, on the session-less Dio (spec §7.2).
  ReceiptsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'receiptsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$receiptsHash();

  @$internal
  @override
  $ProviderElement<Receipts> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Receipts create(Ref ref) {
    return receipts(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Receipts value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Receipts>(value),
    );
  }
}

String _$receiptsHash() => r'c147ca5f1fc23a5f6de8879de42462ca99f2ee78';
