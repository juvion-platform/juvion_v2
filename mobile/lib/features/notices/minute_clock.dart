import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'minute_clock.g.dart';

/// Ticks now, then once a minute. `DeadlineRing` (`widgets/deadline_ring.dart`) is
/// stateless and only repaints when its parent rebuilds, so `NoticeCard`
/// (`widgets/notice_card.dart`) and `AttentionStack` (`widgets/attention_stack.dart`)
/// watch this provider when they are not given an explicit `now`, so their rings
/// still repaint at least once a minute (Task 3 review R4). Tests and goldens stay
/// deterministic by passing a fixed `now` instead — which skips this provider
/// entirely — or by overriding it with a controlled stream.
@riverpod
Stream<DateTime> minuteClock(Ref ref) async* {
  yield DateTime.now();
  yield* Stream.periodic(const Duration(minutes: 1), (_) => DateTime.now());
}
