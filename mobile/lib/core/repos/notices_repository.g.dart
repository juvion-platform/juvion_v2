// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notices_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
/// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
/// invalidates this after every drain.

@ProviderFor(pendingAcks)
final pendingAcksProvider = PendingAcksProvider._();

/// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
/// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
/// invalidates this after every drain.

final class PendingAcksProvider
    extends
        $FunctionalProvider<
          AsyncValue<Set<String>>,
          Set<String>,
          FutureOr<Set<String>>
        >
    with $FutureModifier<Set<String>>, $FutureProvider<Set<String>> {
  /// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
  /// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
  /// invalidates this after every drain.
  PendingAcksProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'pendingAcksProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$pendingAcksHash();

  @$internal
  @override
  $FutureProviderElement<Set<String>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<Set<String>> create(Ref ref) {
    return pendingAcks(ref);
  }
}

String _$pendingAcksHash() => r'b01e55a76af50ffcbd535c80562662d13f46fad5';

@ProviderFor(noticesRepository)
final noticesRepositoryProvider = NoticesRepositoryProvider._();

final class NoticesRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<NoticesRepository>,
          NoticesRepository,
          FutureOr<NoticesRepository>
        >
    with
        $FutureModifier<NoticesRepository>,
        $FutureProvider<NoticesRepository> {
  NoticesRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'noticesRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$noticesRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<NoticesRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NoticesRepository> create(Ref ref) {
    return noticesRepository(ref);
  }
}

String _$noticesRepositoryHash() => r'a582f84b6bf96583fba0dcf43b0236fbc7584aed';

/// Cached-then-network, same shape as `me` in `me_repository.dart`. Its `dueCount`
/// is the one number behind the tab badge, the attention stack's "+N more" and the
/// sheet's Due segment (spec §4 US-3.2).

@ProviderFor(attention)
final attentionProvider = AttentionProvider._();

/// Cached-then-network, same shape as `me` in `me_repository.dart`. Its `dueCount`
/// is the one number behind the tab badge, the attention stack's "+N more" and the
/// sheet's Due segment (spec §4 US-3.2).

final class AttentionProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<AttentionData>>,
          Cached<AttentionData>,
          Stream<Cached<AttentionData>>
        >
    with
        $FutureModifier<Cached<AttentionData>>,
        $StreamProvider<Cached<AttentionData>> {
  /// Cached-then-network, same shape as `me` in `me_repository.dart`. Its `dueCount`
  /// is the one number behind the tab badge, the attention stack's "+N more" and the
  /// sheet's Due segment (spec §4 US-3.2).
  AttentionProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'attentionProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$attentionHash();

  @$internal
  @override
  $StreamProviderElement<Cached<AttentionData>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<Cached<AttentionData>> create(Ref ref) {
    return attention(ref);
  }
}

String _$attentionHash() => r'd5cb90208c9c92f34d22aaa003a49b750f77aaa8';

@ProviderFor(noticeDetail)
final noticeDetailProvider = NoticeDetailFamily._();

final class NoticeDetailProvider
    extends
        $FunctionalProvider<
          AsyncValue<Cached<NoticeDetail>>,
          Cached<NoticeDetail>,
          Stream<Cached<NoticeDetail>>
        >
    with
        $FutureModifier<Cached<NoticeDetail>>,
        $StreamProvider<Cached<NoticeDetail>> {
  NoticeDetailProvider._({
    required NoticeDetailFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'noticeDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$noticeDetailHash();

  @override
  String toString() {
    return r'noticeDetailProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<Cached<NoticeDetail>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<Cached<NoticeDetail>> create(Ref ref) {
    final argument = this.argument as String;
    return noticeDetail(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is NoticeDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$noticeDetailHash() => r'd5d415349489784d33f6396282e12ae48a312cf7';

final class NoticeDetailFamily extends $Family
    with $FunctionalFamilyOverride<Stream<Cached<NoticeDetail>>, String> {
  NoticeDetailFamily._()
    : super(
        retry: null,
        name: r'noticeDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  NoticeDetailProvider call(String id) =>
      NoticeDetailProvider._(argument: id, from: this);

  @override
  String toString() => r'noticeDetailProvider';
}
