// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'minute_clock.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Ticks now, then once a minute. `DeadlineRing` (`widgets/deadline_ring.dart`) is
/// stateless and only repaints when its parent rebuilds, so `NoticeCard`
/// (`widgets/notice_card.dart`) and `AttentionStack` (`widgets/attention_stack.dart`)
/// watch this provider when they are not given an explicit `now`, so their rings
/// still repaint at least once a minute (Task 3 review R4). Tests and goldens stay
/// deterministic by passing a fixed `now` instead — which skips this provider
/// entirely — or by overriding it with a controlled stream.

@ProviderFor(minuteClock)
final minuteClockProvider = MinuteClockProvider._();

/// Ticks now, then once a minute. `DeadlineRing` (`widgets/deadline_ring.dart`) is
/// stateless and only repaints when its parent rebuilds, so `NoticeCard`
/// (`widgets/notice_card.dart`) and `AttentionStack` (`widgets/attention_stack.dart`)
/// watch this provider when they are not given an explicit `now`, so their rings
/// still repaint at least once a minute (Task 3 review R4). Tests and goldens stay
/// deterministic by passing a fixed `now` instead — which skips this provider
/// entirely — or by overriding it with a controlled stream.

final class MinuteClockProvider
    extends
        $FunctionalProvider<AsyncValue<DateTime>, DateTime, Stream<DateTime>>
    with $FutureModifier<DateTime>, $StreamProvider<DateTime> {
  /// Ticks now, then once a minute. `DeadlineRing` (`widgets/deadline_ring.dart`) is
  /// stateless and only repaints when its parent rebuilds, so `NoticeCard`
  /// (`widgets/notice_card.dart`) and `AttentionStack` (`widgets/attention_stack.dart`)
  /// watch this provider when they are not given an explicit `now`, so their rings
  /// still repaint at least once a minute (Task 3 review R4). Tests and goldens stay
  /// deterministic by passing a fixed `now` instead — which skips this provider
  /// entirely — or by overriding it with a controlled stream.
  MinuteClockProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'minuteClockProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$minuteClockHash();

  @$internal
  @override
  $StreamProviderElement<DateTime> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<DateTime> create(Ref ref) {
    return minuteClock(ref);
  }
}

String _$minuteClockHash() => r'84932c35215be485b4ef357393870ec4c6472272';
