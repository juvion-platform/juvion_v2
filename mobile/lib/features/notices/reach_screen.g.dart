// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reach_screen.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Reach is online only: it is the publisher's live view, never cached.

@ProviderFor(noticeReach)
final noticeReachProvider = NoticeReachFamily._();

/// Reach is online only: it is the publisher's live view, never cached.

final class NoticeReachProvider
    extends
        $FunctionalProvider<
          AsyncValue<NoticeReachData>,
          NoticeReachData,
          FutureOr<NoticeReachData>
        >
    with $FutureModifier<NoticeReachData>, $FutureProvider<NoticeReachData> {
  /// Reach is online only: it is the publisher's live view, never cached.
  NoticeReachProvider._({
    required NoticeReachFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'noticeReachProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$noticeReachHash();

  @override
  String toString() {
    return r'noticeReachProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<NoticeReachData> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NoticeReachData> create(Ref ref) {
    final argument = this.argument as String;
    return noticeReach(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is NoticeReachProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$noticeReachHash() => r'58f0e3077ff407c878e311ee4ba928251a47568d';

/// Reach is online only: it is the publisher's live view, never cached.

final class NoticeReachFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<NoticeReachData>, String> {
  NoticeReachFamily._()
    : super(
        retry: null,
        name: r'noticeReachProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Reach is online only: it is the publisher's live view, never cached.

  NoticeReachProvider call(String id) =>
      NoticeReachProvider._(argument: id, from: this);

  @override
  String toString() => r'noticeReachProvider';
}

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.

@ProviderFor(PendingController)
final pendingControllerProvider = PendingControllerFamily._();

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.
final class PendingControllerProvider
    extends $AsyncNotifierProvider<PendingController, PendingState> {
  /// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.
  PendingControllerProvider._({
    required PendingControllerFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'pendingControllerProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$pendingControllerHash();

  @override
  String toString() {
    return r'pendingControllerProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  PendingController create() => PendingController();

  @override
  bool operator ==(Object other) {
    return other is PendingControllerProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$pendingControllerHash() => r'45a4a24f31b5fedf2a12c7ea4bf43a44bde6ffe3';

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.

final class PendingControllerFamily extends $Family
    with
        $ClassFamilyOverride<
          PendingController,
          AsyncValue<PendingState>,
          PendingState,
          FutureOr<PendingState>,
          String
        > {
  PendingControllerFamily._()
    : super(
        retry: null,
        name: r'pendingControllerProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.

  PendingControllerProvider call(String noticeId) =>
      PendingControllerProvider._(argument: noticeId, from: this);

  @override
  String toString() => r'pendingControllerProvider';
}

/// The pending list (spec §4 US-4.2): grouped by batch or section, searchable, paged.

abstract class _$PendingController extends $AsyncNotifier<PendingState> {
  late final _$args = ref.$arg as String;
  String get noticeId => _$args;

  FutureOr<PendingState> build(String noticeId);
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<PendingState>, PendingState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<PendingState>, PendingState>,
              AsyncValue<PendingState>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, () => build(_$args));
  }
}
