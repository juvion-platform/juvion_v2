// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'first_notice_step.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// `GET /onboarding/first-notice`: the welcome notice for this account's kind; the
/// server creates the recipient row on demand (spec §6.5).

@ProviderFor(firstNotice)
final firstNoticeProvider = FirstNoticeProvider._();

/// `GET /onboarding/first-notice`: the welcome notice for this account's kind; the
/// server creates the recipient row on demand (spec §6.5).

final class FirstNoticeProvider
    extends
        $FunctionalProvider<
          AsyncValue<NoticeDetail>,
          NoticeDetail,
          FutureOr<NoticeDetail>
        >
    with $FutureModifier<NoticeDetail>, $FutureProvider<NoticeDetail> {
  /// `GET /onboarding/first-notice`: the welcome notice for this account's kind; the
  /// server creates the recipient row on demand (spec §6.5).
  FirstNoticeProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'firstNoticeProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$firstNoticeHash();

  @$internal
  @override
  $FutureProviderElement<NoticeDetail> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NoticeDetail> create(Ref ref) {
    return firstNotice(ref);
  }
}

String _$firstNoticeHash() => r'a22d57f8f0a2b22533824e796a0ece63289df918';
