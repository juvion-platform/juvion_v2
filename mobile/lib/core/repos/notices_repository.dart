import 'package:dio/dio.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/core/storage/app_database.dart';
import 'package:juvi_api/juvi_api.dart' as wire;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notices_repository.g.dart';

abstract class NoticesRepository {
  Future<Cached<AttentionData>?> cachedAttention();
  Future<Cached<AttentionData>> attention();
  Future<Cached<NoticePage>?> cachedList(NoticeSegment segment);
  Future<NoticePage> list(NoticeSegment segment, {String? office, String? cursor});
  Future<Cached<NoticeDetail>?> cachedDetail(String id);
  Future<Cached<NoticeDetail>> detail(String id);
  Future<DateTime> markSeen(String id);
  Future<AckRecord> acknowledge(String id, AckInput input);
  Future<DateTime> dismiss(String id);
  Future<Uri> attachmentUrl(String id, String key);
  Future<NoticeReachData> reach(String id);
  Future<PendingPage> pending(String id, {String? group, String? q, String? cursor});
  Future<Reminders> remind(String id);
  Future<NoticeDetail> firstNotice();
}

/// Every notices endpoint but one goes through the generated `wire.MobileApi`. Checked
/// field by field against `mobile/api/openapi.json` (`Attention`, `NoticeList`,
/// `NoticeDetail`, `SeenResult`, `AckRequest`, `AckResult`, `DismissResult`,
/// `NoticeReach`, `NoticePending`, `RemindResult`) and the generated models in
/// `packages/juvi_api/lib/src/model/`: the contract has no object-or-null field (every
/// nested object is always present, every nullable value is a scalar), so the
/// R57/R61 generator gap does not apply, and `AckRequest.toJson` omits a null
/// `comment`/`clientAt` (the server's strict schema refuses `null` for either).
///
/// `attachmentUrl` uses the shared Dio directly: the key contains slashes
/// (`colleges/<cid>/notices/<uuid>`) and the generated `getNoticeAttachmentUrl` puts
/// it into the path unencoded, so Express would see extra path segments and 404. The
/// key is sent as one `Uri.encodeComponent` segment, as `mobile-routes.ts` expects.
///
/// `error.ack` (409 `ALREADY_ACKNOWLEDGED`) and `error.reminders` (409
/// `REMINDER_LIMIT`) are read from the raw envelope through `ApiFailure.ackRecord` /
/// `ApiFailure.reminders`; no generated error model is involved.
class ApiNoticesRepository implements NoticesRepository {
  ApiNoticesRepository(this._api, this._dio, this._db);
  final wire.MobileApi _api;
  final Dio _dio;
  final AppDatabase _db;

  static const attentionKey = 'attention';
  static String listKey(NoticeSegment s) => 'notices:${s.name}';
  static String detailKey(String id) => 'notice:$id';

  Future<T> _guard<T>(Future<T> Function() f) async {
    try {
      return await f();
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }

  @override
  Future<Cached<AttentionData>?> cachedAttention() async {
    final doc = await _db.readDoc(attentionKey);
    return doc == null ? null : Cached(AttentionData.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<AttentionData>> attention() => _guard(() async {
        final json = (await _api.getAttention()).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc(attentionKey, json, now);
        return Cached(AttentionData.fromJson(json), now);
      });

  @override
  Future<Cached<NoticePage>?> cachedList(NoticeSegment segment) async {
    final doc = await _db.readDoc(listKey(segment));
    return doc == null ? null : Cached(NoticePage.fromJson(doc.json), doc.asOf);
  }

  /// Only the unfiltered first page of each segment is cached, so the attention sheet
  /// opens offline; later pages and office filters need a connection.
  @override
  Future<NoticePage> list(NoticeSegment segment, {String? office, String? cursor}) => _guard(() async {
        final json = (await _api.listNotices(segment: segment.name, office: office, cursor: cursor)).data!.toJson();
        if (office == null && cursor == null) await _db.writeDoc(listKey(segment), json, DateTime.now().toUtc());
        return NoticePage.fromJson(json);
      });

  @override
  Future<Cached<NoticeDetail>?> cachedDetail(String id) async {
    final doc = await _db.readDoc(detailKey(id));
    return doc == null ? null : Cached(NoticeDetail.fromJson(doc.json), doc.asOf);
  }

  @override
  Future<Cached<NoticeDetail>> detail(String id) => _guard(() async {
        final json = (await _api.getNotice(id: id)).data!.toJson();
        final now = DateTime.now().toUtc();
        await _db.writeDoc(detailKey(id), json, now);
        return Cached(NoticeDetail.fromJson(json), now);
      });

  /// Rewrites the cached detail document (if any) with [patch], keeping its as-of time.
  Future<void> _patchDetail(String id, Map<String, dynamic> Function(Map<String, dynamic> json) patch) async {
    final doc = await _db.readDoc(detailKey(id));
    if (doc != null) await _db.writeDoc(detailKey(id), {...doc.json, ...patch(doc.json)}, doc.asOf);
  }

  Future<void> _dropFromAttention(String id) async {
    final doc = await _db.readDoc(attentionKey);
    if (doc == null) return;
    final items = (doc.json['items'] as List).cast<Map<String, dynamic>>();
    final kept = items.where((i) => i['id'] != id).toList();
    if (kept.length == items.length) return;
    final due = (doc.json['dueCount'] as int) - 1;
    await _db.writeDoc(attentionKey, {...doc.json, 'items': kept, 'dueCount': due < 0 ? 0 : due}, doc.asOf);
  }

  /// Drops [id] from the cached `notices:due` page (M5): once acknowledged it is no
  /// longer due, and offline this cache is otherwise the only thing that still lists it.
  Future<void> _dropFromDuePage(String id) async {
    final doc = await _db.readDoc(listKey(NoticeSegment.due));
    if (doc == null) return;
    final items = (doc.json['items'] as List).cast<Map<String, dynamic>>();
    final kept = items.where((i) => i['id'] != id).toList();
    if (kept.length == items.length) return;
    await _db.writeDoc(listKey(NoticeSegment.due), {...doc.json, 'items': kept}, doc.asOf);
  }

  /// Patches [id]'s row inside the cached `notices:all` page (M5), the same fields
  /// [_patchDetail] writes to the detail document, so an offline-cached All segment
  /// reflects the acknowledgement instead of still showing the hold control.
  Future<void> _patchInAllPage(String id, Map<String, dynamic> Function(Map<String, dynamic> json) patch) async {
    final doc = await _db.readDoc(listKey(NoticeSegment.all));
    if (doc == null) return;
    final items = (doc.json['items'] as List).cast<Map<String, dynamic>>();
    var changed = false;
    final patched = items.map((i) {
      if (i['id'] != id) return i;
      changed = true;
      return {...i, ...patch(i)};
    }).toList();
    if (!changed) return;
    await _db.writeDoc(listKey(NoticeSegment.all), {...doc.json, 'items': patched}, doc.asOf);
  }

  @override
  Future<DateTime> markSeen(String id) => _guard(() async {
        final seenAt = (await _api.markNoticeSeen(id: id)).data!.seenAt;
        await _patchDetail(id, (j) => {'seenAt': seenAt, if (j['state'] == 'received') 'state': 'seen'});
        return DateTime.parse(seenAt);
      });

  /// A 409 `ALREADY_ACKNOWLEDGED` is an acknowledgement that exists, so it returns the
  /// server's existing record (from `error.ack`) instead of failing (spec §4 US-2.3).
  /// Once confirmed, the notice leaves the cached attention document too, so the next
  /// read of `attentionProvider` drops the card before the network answers.
  @override
  Future<AckRecord> acknowledge(String id, AckInput input) => _guard(() async {
        AckRecord record;
        try {
          final r = await _api.acknowledgeNotice(
            id: id,
            ackRequest: wire.AckRequest(
              method: wire.AckRequestMethodEnum.values.byName(input.method.name),
              comment: input.comment,
              offline: input.offline,
              clientAt: input.clientAt?.toUtc(),
            ),
          );
          record = AckRecord.fromJson(r.data!.toJson());
        } on Object catch (e) {
          final f = ApiFailure.of(e);
          final existing = f.ackRecord;
          if (f.code != ApiErrorCode.alreadyAcknowledged || existing == null) throw f;
          record = AckRecord.fromJson(existing);
        }
        await _patchDetail(id, (j) => {
              'state': 'acknowledged',
              'seenAt': j['seenAt'] ?? record.ackAt.toIso8601String(),
              'ackAt': record.ackAt.toIso8601String(),
              'late': record.isLate,
              'ackMethod': record.method,
              'ackOffline': record.offline,
              'ackComment': record.comment,
              'ackClientAt': record.clientAt?.toIso8601String(),
            });
        await _dropFromAttention(id);
        await _dropFromDuePage(id);
        await _patchInAllPage(id, (j) => {
              'state': 'acknowledged',
              'late': record.isLate,
              'ackAt': record.ackAt.toIso8601String(),
              'seenAt': j['seenAt'] ?? record.ackAt.toIso8601String(),
            });
        return record;
      });

  @override
  Future<DateTime> dismiss(String id) => _guard(() async {
        final dismissedAt = (await _api.dismissNotice(id: id)).data!.dismissedAt;
        await _patchDetail(id, (j) => {'state': 'dismissed', 'dismissedAt': dismissedAt, 'seenAt': j['seenAt'] ?? dismissedAt});
        return DateTime.parse(dismissedAt);
      });

  @override
  Future<Uri> attachmentUrl(String id, String key) => _guard(() async {
        final r = await _dio.get<Map<String, dynamic>>('/notices/$id/attachments/${Uri.encodeComponent(key)}');
        return Uri.parse(r.data!['url'] as String);
      });

  @override
  Future<NoticeReachData> reach(String id) =>
      _guard(() async => NoticeReachData.fromJson((await _api.getNoticeReach(id: id)).data!.toJson()));

  @override
  Future<PendingPage> pending(String id, {String? group, String? q, String? cursor}) => _guard(() async =>
      PendingPage.fromJson((await _api.listNoticePending(id: id, group: group, q: q, cursor: cursor)).data!.toJson()));

  @override
  Future<Reminders> remind(String id) =>
      _guard(() async => Reminders.fromJson((await _api.remindNotice(id: id)).data!.reminders.toJson()));

  @override
  Future<NoticeDetail> firstNotice() => _guard(() async {
        final json = (await _api.getFirstNotice()).data!.toJson();
        final detail = NoticeDetail.fromJson(json);
        await _db.writeDoc(detailKey(detail.id), json, DateTime.now().toUtc());
        return detail;
      });
}

/// Notice ids with an acknowledgement waiting in the offline queue. Their cards show
/// "Will send when online" until `SyncLifecycle` drains it (spec §4 US-3.4); it
/// invalidates this after every drain.
@riverpod
Future<Set<String>> pendingAcks(Ref ref) async {
  final db = await ref.read(appDatabaseProvider.future);
  return {
    for (final a in await db.pendingActions())
      if (a.type == 'notice.ack') a.payload['noticeId'] as String,
  };
}

@Riverpod(keepAlive: true)
Future<NoticesRepository> noticesRepository(Ref ref) async =>
    ApiNoticesRepository(ref.read(mobileApiProvider), ref.read(dioProvider), await ref.read(appDatabaseProvider.future));

/// Cached-then-network, same shape as `me` in `me_repository.dart`. Its `dueCount`
/// is the one number behind the tab badge, the attention stack's "+N more" and the
/// sheet's Due segment (spec §4 US-3.2).
@riverpod
Stream<Cached<AttentionData>> attention(Ref ref) async* {
  final repo = await ref.read(noticesRepositoryProvider.future);
  final c = await repo.cachedAttention();
  if (c != null) yield c;
  try {
    yield await repo.attention();
  } on ApiFailure catch (f) {
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}

/// `NOTICE_NOT_FOUND`/`forbidden` mean the caller can no longer see this notice (it
/// wasn't addressed to them, or access was revoked) — unlike a transient failure, the
/// cached copy must not keep rendering, so the doc is dropped and the stream errors
/// instead of falling back to [Cached.markStale] (spec US-2.5). Public (M1) so
/// `notice_detail_screen.dart`'s "not available" branch uses the same set instead of
/// drifting from it.
const Set<ApiErrorCode> goneNoticeCodes = {ApiErrorCode.noticeNotFound, ApiErrorCode.forbidden};

@riverpod
Stream<Cached<NoticeDetail>> noticeDetail(Ref ref, String id) async* {
  final repo = await ref.read(noticesRepositoryProvider.future);
  final c = await repo.cachedDetail(id);
  if (c != null) yield c;
  try {
    yield await repo.detail(id);
  } on ApiFailure catch (f) {
    if (goneNoticeCodes.contains(f.code)) {
      final db = await ref.read(appDatabaseProvider.future);
      await db.deleteDoc(ApiNoticesRepository.detailKey(id));
      rethrow;
    }
    if (c == null) rethrow;
    yield c.markStale(f);
  }
}
