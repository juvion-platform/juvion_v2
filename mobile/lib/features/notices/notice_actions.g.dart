// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_actions.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(noticeActions)
final noticeActionsProvider = NoticeActionsProvider._();

final class NoticeActionsProvider
    extends $FunctionalProvider<NoticeActions, NoticeActions, NoticeActions>
    with $Provider<NoticeActions> {
  NoticeActionsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'noticeActionsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$noticeActionsHash();

  @$internal
  @override
  $ProviderElement<NoticeActions> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  NoticeActions create(Ref ref) {
    return noticeActions(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(NoticeActions value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<NoticeActions>(value),
    );
  }
}

String _$noticeActionsHash() => r'74b73e977e0d24eeb5b56d190c33948647fcb824';
