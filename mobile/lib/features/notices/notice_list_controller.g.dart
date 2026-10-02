// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_list_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.

@ProviderFor(NoticeList)
final noticeListProvider = NoticeListFamily._();

/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.
final class NoticeListProvider
    extends $AsyncNotifierProvider<NoticeList, NoticeListState> {
  /// One S05 segment, optionally filtered by office, paged by the server's cursor
  /// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.
  NoticeListProvider._({
    required NoticeListFamily super.from,
    required (NoticeSegment, String?) super.argument,
  }) : super(
         retry: null,
         name: r'noticeListProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$noticeListHash();

  @override
  String toString() {
    return r'noticeListProvider'
        ''
        '$argument';
  }

  @$internal
  @override
  NoticeList create() => NoticeList();

  @override
  bool operator ==(Object other) {
    return other is NoticeListProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$noticeListHash() => r'f6499bfb0fa6717dfb30f2dd00356fd50e8516fd';

/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.

final class NoticeListFamily extends $Family
    with
        $ClassFamilyOverride<
          NoticeList,
          AsyncValue<NoticeListState>,
          NoticeListState,
          FutureOr<NoticeListState>,
          (NoticeSegment, String?)
        > {
  NoticeListFamily._()
    : super(
        retry: null,
        name: r'noticeListProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// One S05 segment, optionally filtered by office, paged by the server's cursor
  /// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.

  NoticeListProvider call(NoticeSegment segment, String? office) =>
      NoticeListProvider._(argument: (segment, office), from: this);

  @override
  String toString() => r'noticeListProvider';
}

/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.

abstract class _$NoticeList extends $AsyncNotifier<NoticeListState> {
  late final _$args = ref.$arg as (NoticeSegment, String?);
  NoticeSegment get segment => _$args.$1;
  String? get office => _$args.$2;

  FutureOr<NoticeListState> build(NoticeSegment segment, String? office);
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<NoticeListState>, NoticeListState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<NoticeListState>, NoticeListState>,
              AsyncValue<NoticeListState>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, () => build(_$args.$1, _$args.$2));
  }
}
