// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_permission.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(notificationPermission)
final notificationPermissionProvider = NotificationPermissionProvider._();

final class NotificationPermissionProvider
    extends
        $FunctionalProvider<
          NotificationPermission,
          NotificationPermission,
          NotificationPermission
        >
    with $Provider<NotificationPermission> {
  NotificationPermissionProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationPermissionProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationPermissionHash();

  @$internal
  @override
  $ProviderElement<NotificationPermission> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  NotificationPermission create(Ref ref) {
    return notificationPermission(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(NotificationPermission value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<NotificationPermission>(value),
    );
  }
}

String _$notificationPermissionHash() =>
    r'6941a28acb149b87599f509224e2ed6c9e398700';

/// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
/// app resumes (the person may have changed it in the system settings); `PushRegistration`
/// registers the token on a denied → allowed change; S12 and the S14 card watch it.

@ProviderFor(NotificationsAllowed)
final notificationsAllowedProvider = NotificationsAllowedProvider._();

/// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
/// app resumes (the person may have changed it in the system settings); `PushRegistration`
/// registers the token on a denied → allowed change; S12 and the S14 card watch it.
final class NotificationsAllowedProvider
    extends $AsyncNotifierProvider<NotificationsAllowed, bool> {
  /// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
  /// app resumes (the person may have changed it in the system settings); `PushRegistration`
  /// registers the token on a denied → allowed change; S12 and the S14 card watch it.
  NotificationsAllowedProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationsAllowedProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationsAllowedHash();

  @$internal
  @override
  NotificationsAllowed create() => NotificationsAllowed();
}

String _$notificationsAllowedHash() =>
    r'6125673ba988eb7e1168e8678b26a807cefac7cf';

/// Whether the OS lets Juvi post notifications. `PushLifecycle` re-checks it whenever the
/// app resumes (the person may have changed it in the system settings); `PushRegistration`
/// registers the token on a denied → allowed change; S12 and the S14 card watch it.

abstract class _$NotificationsAllowed extends $AsyncNotifier<bool> {
  FutureOr<bool> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<bool>, bool>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<bool>, bool>,
              AsyncValue<bool>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
