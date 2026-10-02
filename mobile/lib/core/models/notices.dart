import 'package:freezed_annotation/freezed_annotation.dart';

part 'notices.freezed.dart';
part 'notices.g.dart';

/// `GET /notices?segment=`. `published` lists the notices the caller published.
enum NoticeSegment { due, done, all, published }

/// How an acknowledgement was made: a 1.2 s hold, or tap-then-confirm (spec §4 US-2.2).
enum AckMethod { hold, confirm }

/// A notice as a card or a list row (contract `NoticeCard`). Nullable dates arrive
/// as ISO strings or null; `late` is a Dart keyword, so the field is `isLate`.
@freezed
abstract class NoticeItem with _$NoticeItem {
  const factory NoticeItem({
    required String id,
    required String title,
    required String preview,
    required String office,
    required String audienceLine,
    required String priority, // routine | important | urgent
    required String purpose, // standard | welcome
    required bool ackRequired,
    required bool ackCommentAllowed,
    required bool archived,
    required int attachmentCount,
    required String state, // received | seen | acknowledged | dismissed
    @JsonKey(name: 'late') required bool isLate,
    required bool isPublisher,
    DateTime? deadline,
    DateTime? publishedAt,
    DateTime? seenAt,
    DateTime? ackAt,
    DateTime? remindedAt,
  }) = _NoticeItem;
  const NoticeItem._();
  factory NoticeItem.fromJson(Map<String, dynamic> json) => _$NoticeItemFromJson(json);

  bool get isAcknowledged => state == 'acknowledged';

  /// Still waiting for this person's acknowledgement (the server's Due rule, spec §7.1).
  bool get needsAck => ackRequired && !isAcknowledged && !archived && state != 'dismissed';
}

@freezed
abstract class NoticeAttachment with _$NoticeAttachment {
  const factory NoticeAttachment({required String key, required String name, required String mime, required int size}) = _NoticeAttachment;
  factory NoticeAttachment.fromJson(Map<String, dynamic> json) => _$NoticeAttachmentFromJson(json);
}

/// The S04 payload (contract `NoticeDetail`): every card field, plus the body,
/// attachments and the caller's acknowledgement record, flattened.
@freezed
abstract class NoticeDetail with _$NoticeDetail {
  const factory NoticeDetail({
    required String id,
    required String title,
    required String preview,
    required String office,
    required String audienceLine,
    required String priority,
    required String purpose,
    required bool ackRequired,
    required bool ackCommentAllowed,
    required bool archived,
    required int attachmentCount,
    required String state,
    @JsonKey(name: 'late') required bool isLate,
    required bool isPublisher,
    required String body,
    required List<NoticeAttachment> attachments,
    required bool ackOffline,
    DateTime? deadline,
    DateTime? publishedAt,
    DateTime? seenAt,
    DateTime? ackAt,
    DateTime? remindedAt,
    String? ackMethod, // hold | confirm
    String? ackComment,
    DateTime? ackClientAt,
    DateTime? dismissedAt,
  }) = _NoticeDetail;
  const NoticeDetail._();
  factory NoticeDetail.fromJson(Map<String, dynamic> json) => _$NoticeDetailFromJson(json);

  bool get isAcknowledged => state == 'acknowledged';
  bool get needsAck => item.needsAck;

  NoticeItem get item => NoticeItem(
        id: id,
        title: title,
        preview: preview,
        office: office,
        audienceLine: audienceLine,
        priority: priority,
        purpose: purpose,
        ackRequired: ackRequired,
        ackCommentAllowed: ackCommentAllowed,
        archived: archived,
        attachmentCount: attachmentCount,
        state: state,
        isLate: isLate,
        isPublisher: isPublisher,
        deadline: deadline,
        publishedAt: publishedAt,
        seenAt: seenAt,
        ackAt: ackAt,
        remindedAt: remindedAt,
      );
}

/// `GET /attention`: the Due count and at most three items (spec §7.1).
@freezed
abstract class AttentionData with _$AttentionData {
  const factory AttentionData({required int dueCount, required List<NoticeItem> items}) = _AttentionData;
  factory AttentionData.fromJson(Map<String, dynamic> json) => _$AttentionDataFromJson(json);
}

@freezed
abstract class NoticePage with _$NoticePage {
  const factory NoticePage({required List<NoticeItem> items, String? nextCursor}) = _NoticePage;
  factory NoticePage.fromJson(Map<String, dynamic> json) => _$NoticePageFromJson(json);
}

/// The acknowledgement record: the `POST /ack` 200 body, and `error.ack` on a 409
/// `ALREADY_ACKNOWLEDGED`.
@freezed
abstract class AckRecord with _$AckRecord {
  const factory AckRecord({
    required DateTime ackAt,
    @JsonKey(name: 'late') required bool isLate,
    required String method,
    required bool offline,
    String? comment,
    DateTime? clientAt,
  }) = _AckRecord;
  factory AckRecord.fromJson(Map<String, dynamic> json) => _$AckRecordFromJson(json);
}

/// `reminders` on reach and remind, and `error.reminders` on a 409 `REMINDER_LIMIT`.
@freezed
abstract class Reminders with _$Reminders {
  const factory Reminders({required int used, required int max, DateTime? lastAt}) = _Reminders;
  const Reminders._();
  factory Reminders.fromJson(Map<String, dynamic> json) => _$RemindersFromJson(json);
  bool get exhausted => used >= max;
}

@freezed
abstract class ReachPerson with _$ReachPerson {
  const factory ReachPerson({required String name, required String group, String? identifier, DateTime? at}) = _ReachPerson;
  factory ReachPerson.fromJson(Map<String, dynamic> json) => _$ReachPersonFromJson(json);
}

@freezed
abstract class ReachComment with _$ReachComment {
  const factory ReachComment({
    required String name,
    required String group,
    required String comment,
    @JsonKey(name: 'late') required bool isLate,
    String? identifier,
    DateTime? at,
  }) = _ReachComment;
  factory ReachComment.fromJson(Map<String, dynamic> json) => _$ReachCommentFromJson(json);
}

@freezed
abstract class ReachGroup with _$ReachGroup {
  const factory ReachGroup({
    required String label,
    required int total,
    required int acknowledged,
    required int seen,
    required int notSeen,
    required int notOnJuvi,
  }) = _ReachGroup;
  factory ReachGroup.fromJson(Map<String, dynamic> json) => _$ReachGroupFromJson(json);
}

@freezed
abstract class ReachAddedLaterItem with _$ReachAddedLaterItem {
  const factory ReachAddedLaterItem({
    required String name,
    required String group,
    required String state, // acknowledged | seen | not_seen | not_on_juvi
    String? identifier,
    DateTime? at,
  }) = _ReachAddedLaterItem;
  factory ReachAddedLaterItem.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterItemFromJson(json);
}

@freezed
abstract class ReachAddedLater with _$ReachAddedLater {
  const factory ReachAddedLater({
    required int total,
    required int acknowledged,
    required int seen,
    required List<ReachAddedLaterItem> items,
  }) = _ReachAddedLater;
  factory ReachAddedLater.fromJson(Map<String, dynamic> json) => _$ReachAddedLaterFromJson(json);
}

/// S11 (contract `NoticeReach`). The four snapshot buckets add up to [audience]
/// (spec §6.5); added-later members are counted on their own.
@freezed
abstract class NoticeReachData with _$NoticeReachData {
  const factory NoticeReachData({
    required String noticeId,
    required String title,
    required String status, // publishing | published | archived
    required bool ackRequired,
    required int audience,
    required int acknowledged,
    required int seen,
    required int notSeen,
    required int notOnJuvi,
    required int dismissed,
    @JsonKey(name: 'late') required int lateCount,
    required Reminders reminders,
    required List<int> sparkline,
    required List<ReachGroup> groups,
    required List<ReachPerson> lateAcks,
    required List<ReachComment> comments,
    required ReachAddedLater addedLater,
    required DateTime asOf,
    DateTime? deadline,
    DateTime? publishedAt,
  }) = _NoticeReachData;
  factory NoticeReachData.fromJson(Map<String, dynamic> json) => _$NoticeReachDataFromJson(json);
}

@freezed
abstract class PendingPerson with _$PendingPerson {
  const factory PendingPerson({
    required String name,
    required String group,
    required String state, // seen | not_seen | not_on_juvi
    String? identifier,
    DateTime? lastSeenInApp,
  }) = _PendingPerson;
  factory PendingPerson.fromJson(Map<String, dynamic> json) => _$PendingPersonFromJson(json);
}

@freezed
abstract class PendingGroup with _$PendingGroup {
  const factory PendingGroup({required String label, required int count}) = _PendingGroup;
  factory PendingGroup.fromJson(Map<String, dynamic> json) => _$PendingGroupFromJson(json);
}

@freezed
abstract class PendingPage with _$PendingPage {
  const factory PendingPage({
    required List<PendingPerson> items,
    required int total,
    required List<PendingGroup> groups,
    String? nextCursor,
  }) = _PendingPage;
  factory PendingPage.fromJson(Map<String, dynamic> json) => _$PendingPageFromJson(json);
}

/// The body of `POST /notices/:id/ack`, and the payload of a queued `notice.ack`.
class AckInput {
  const AckInput({required this.method, this.comment, this.offline = false, this.clientAt});

  /// Rebuilds a queued `notice.ack` payload (`lib/features/notices/notice_actions.dart`).
  factory AckInput.fromQueued(Map<String, dynamic> p) => AckInput(
        method: AckMethod.values.byName(p['method'] as String),
        comment: p['comment'] as String?,
        offline: p['offline'] as bool? ?? true,
        clientAt: DateTime.tryParse(p['clientAt'] as String? ?? '')?.toUtc(),
      );

  final AckMethod method;
  final String? comment;
  final bool offline;

  /// Device time of the gesture, in UTC: the server accepts an ISO date with an offset only.
  final DateTime? clientAt;
}
