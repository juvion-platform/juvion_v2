import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/repos/notices_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notice_list_controller.g.dart';

class NoticeListState {
  const NoticeListState({required this.items, this.nextCursor, this.loadingMore = false, this.asOf, this.failure});
  final List<NoticeItem> items;
  final String? nextCursor;
  final bool loadingMore;

  /// Set when the list is the cached first page because the network failed.
  final DateTime? asOf;

  /// The last "Show more" failure, if any.
  final ApiFailure? failure;

  bool get stale => asOf != null;
}

/// One S05 segment, optionally filtered by office, paged by the server's cursor
/// (spec §4 US-3.5). Offline, an unfiltered segment falls back to its cached first page.
@riverpod
class NoticeList extends _$NoticeList {
  @override
  Future<NoticeListState> build(NoticeSegment segment, String? office) async {
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final page = await repo.list(segment, office: office);
      return NoticeListState(items: page.items, nextCursor: page.nextCursor);
    } on ApiFailure {
      final cached = office == null ? await repo.cachedList(segment) : null;
      if (cached == null) rethrow;
      return NoticeListState(items: cached.data.items, asOf: cached.asOf);
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) return;
    state = AsyncData(NoticeListState(items: current.items, nextCursor: cursor, loadingMore: true));
    final repo = await ref.read(noticesRepositoryProvider.future);
    try {
      final page = await repo.list(segment, office: office, cursor: cursor);
      state = AsyncData(NoticeListState(items: [...current.items, ...page.items], nextCursor: page.nextCursor));
    } on ApiFailure catch (f) {
      state = AsyncData(NoticeListState(items: current.items, nextCursor: cursor, failure: f));
    }
  }
}
