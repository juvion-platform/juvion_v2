// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notices.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_NoticeItem _$NoticeItemFromJson(Map<String, dynamic> json) => _NoticeItem(
  id: json['id'] as String,
  title: json['title'] as String,
  preview: json['preview'] as String,
  office: json['office'] as String,
  audienceLine: json['audienceLine'] as String,
  priority: json['priority'] as String,
  purpose: json['purpose'] as String,
  ackRequired: json['ackRequired'] as bool,
  ackCommentAllowed: json['ackCommentAllowed'] as bool,
  archived: json['archived'] as bool,
  attachmentCount: (json['attachmentCount'] as num).toInt(),
  state: json['state'] as String,
  isLate: json['late'] as bool,
  isPublisher: json['isPublisher'] as bool,
  deadline: json['deadline'] == null
      ? null
      : DateTime.parse(json['deadline'] as String),
  publishedAt: json['publishedAt'] == null
      ? null
      : DateTime.parse(json['publishedAt'] as String),
  seenAt: json['seenAt'] == null
      ? null
      : DateTime.parse(json['seenAt'] as String),
  ackAt: json['ackAt'] == null ? null : DateTime.parse(json['ackAt'] as String),
  remindedAt: json['remindedAt'] == null
      ? null
      : DateTime.parse(json['remindedAt'] as String),
);

Map<String, dynamic> _$NoticeItemToJson(_NoticeItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'preview': instance.preview,
      'office': instance.office,
      'audienceLine': instance.audienceLine,
      'priority': instance.priority,
      'purpose': instance.purpose,
      'ackRequired': instance.ackRequired,
      'ackCommentAllowed': instance.ackCommentAllowed,
      'archived': instance.archived,
      'attachmentCount': instance.attachmentCount,
      'state': instance.state,
      'late': instance.isLate,
      'isPublisher': instance.isPublisher,
      'deadline': instance.deadline?.toIso8601String(),
      'publishedAt': instance.publishedAt?.toIso8601String(),
      'seenAt': instance.seenAt?.toIso8601String(),
      'ackAt': instance.ackAt?.toIso8601String(),
      'remindedAt': instance.remindedAt?.toIso8601String(),
    };

_NoticeAttachment _$NoticeAttachmentFromJson(Map<String, dynamic> json) =>
    _NoticeAttachment(
      key: json['key'] as String,
      name: json['name'] as String,
      mime: json['mime'] as String,
      size: (json['size'] as num).toInt(),
    );

Map<String, dynamic> _$NoticeAttachmentToJson(_NoticeAttachment instance) =>
    <String, dynamic>{
      'key': instance.key,
      'name': instance.name,
      'mime': instance.mime,
      'size': instance.size,
    };

_NoticeDetail _$NoticeDetailFromJson(Map<String, dynamic> json) =>
    _NoticeDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      preview: json['preview'] as String,
      office: json['office'] as String,
      audienceLine: json['audienceLine'] as String,
      priority: json['priority'] as String,
      purpose: json['purpose'] as String,
      ackRequired: json['ackRequired'] as bool,
      ackCommentAllowed: json['ackCommentAllowed'] as bool,
      archived: json['archived'] as bool,
      attachmentCount: (json['attachmentCount'] as num).toInt(),
      state: json['state'] as String,
      isLate: json['late'] as bool,
      isPublisher: json['isPublisher'] as bool,
      body: json['body'] as String,
      attachments: (json['attachments'] as List<dynamic>)
          .map((e) => NoticeAttachment.fromJson(e as Map<String, dynamic>))
          .toList(),
      ackOffline: json['ackOffline'] as bool,
      deadline: json['deadline'] == null
          ? null
          : DateTime.parse(json['deadline'] as String),
      publishedAt: json['publishedAt'] == null
          ? null
          : DateTime.parse(json['publishedAt'] as String),
      seenAt: json['seenAt'] == null
          ? null
          : DateTime.parse(json['seenAt'] as String),
      ackAt: json['ackAt'] == null
          ? null
          : DateTime.parse(json['ackAt'] as String),
      remindedAt: json['remindedAt'] == null
          ? null
          : DateTime.parse(json['remindedAt'] as String),
      ackMethod: json['ackMethod'] as String?,
      ackComment: json['ackComment'] as String?,
      ackClientAt: json['ackClientAt'] == null
          ? null
          : DateTime.parse(json['ackClientAt'] as String),
      dismissedAt: json['dismissedAt'] == null
          ? null
          : DateTime.parse(json['dismissedAt'] as String),
    );

Map<String, dynamic> _$NoticeDetailToJson(_NoticeDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'preview': instance.preview,
      'office': instance.office,
      'audienceLine': instance.audienceLine,
      'priority': instance.priority,
      'purpose': instance.purpose,
      'ackRequired': instance.ackRequired,
      'ackCommentAllowed': instance.ackCommentAllowed,
      'archived': instance.archived,
      'attachmentCount': instance.attachmentCount,
      'state': instance.state,
      'late': instance.isLate,
      'isPublisher': instance.isPublisher,
      'body': instance.body,
      'attachments': instance.attachments.map((e) => e.toJson()).toList(),
      'ackOffline': instance.ackOffline,
      'deadline': instance.deadline?.toIso8601String(),
      'publishedAt': instance.publishedAt?.toIso8601String(),
      'seenAt': instance.seenAt?.toIso8601String(),
      'ackAt': instance.ackAt?.toIso8601String(),
      'remindedAt': instance.remindedAt?.toIso8601String(),
      'ackMethod': instance.ackMethod,
      'ackComment': instance.ackComment,
      'ackClientAt': instance.ackClientAt?.toIso8601String(),
      'dismissedAt': instance.dismissedAt?.toIso8601String(),
    };

_AttentionData _$AttentionDataFromJson(Map<String, dynamic> json) =>
    _AttentionData(
      dueCount: (json['dueCount'] as num).toInt(),
      items: (json['items'] as List<dynamic>)
          .map((e) => NoticeItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$AttentionDataToJson(_AttentionData instance) =>
    <String, dynamic>{
      'dueCount': instance.dueCount,
      'items': instance.items.map((e) => e.toJson()).toList(),
    };

_NoticePage _$NoticePageFromJson(Map<String, dynamic> json) => _NoticePage(
  items: (json['items'] as List<dynamic>)
      .map((e) => NoticeItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  nextCursor: json['nextCursor'] as String?,
);

Map<String, dynamic> _$NoticePageToJson(_NoticePage instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };

_AckRecord _$AckRecordFromJson(Map<String, dynamic> json) => _AckRecord(
  ackAt: DateTime.parse(json['ackAt'] as String),
  isLate: json['late'] as bool,
  method: json['method'] as String,
  offline: json['offline'] as bool,
  comment: json['comment'] as String?,
  clientAt: json['clientAt'] == null
      ? null
      : DateTime.parse(json['clientAt'] as String),
);

Map<String, dynamic> _$AckRecordToJson(_AckRecord instance) =>
    <String, dynamic>{
      'ackAt': instance.ackAt.toIso8601String(),
      'late': instance.isLate,
      'method': instance.method,
      'offline': instance.offline,
      'comment': instance.comment,
      'clientAt': instance.clientAt?.toIso8601String(),
    };

_Reminders _$RemindersFromJson(Map<String, dynamic> json) => _Reminders(
  used: (json['used'] as num).toInt(),
  max: (json['max'] as num).toInt(),
  lastAt: json['lastAt'] == null
      ? null
      : DateTime.parse(json['lastAt'] as String),
);

Map<String, dynamic> _$RemindersToJson(_Reminders instance) =>
    <String, dynamic>{
      'used': instance.used,
      'max': instance.max,
      'lastAt': instance.lastAt?.toIso8601String(),
    };

_ReachPerson _$ReachPersonFromJson(Map<String, dynamic> json) => _ReachPerson(
  name: json['name'] as String,
  group: json['group'] as String,
  identifier: json['identifier'] as String?,
  at: json['at'] == null ? null : DateTime.parse(json['at'] as String),
);

Map<String, dynamic> _$ReachPersonToJson(_ReachPerson instance) =>
    <String, dynamic>{
      'name': instance.name,
      'group': instance.group,
      'identifier': instance.identifier,
      'at': instance.at?.toIso8601String(),
    };

_ReachComment _$ReachCommentFromJson(Map<String, dynamic> json) =>
    _ReachComment(
      name: json['name'] as String,
      group: json['group'] as String,
      comment: json['comment'] as String,
      isLate: json['late'] as bool,
      identifier: json['identifier'] as String?,
      at: json['at'] == null ? null : DateTime.parse(json['at'] as String),
    );

Map<String, dynamic> _$ReachCommentToJson(_ReachComment instance) =>
    <String, dynamic>{
      'name': instance.name,
      'group': instance.group,
      'comment': instance.comment,
      'late': instance.isLate,
      'identifier': instance.identifier,
      'at': instance.at?.toIso8601String(),
    };

_ReachGroup _$ReachGroupFromJson(Map<String, dynamic> json) => _ReachGroup(
  label: json['label'] as String,
  total: (json['total'] as num).toInt(),
  acknowledged: (json['acknowledged'] as num).toInt(),
  seen: (json['seen'] as num).toInt(),
  notSeen: (json['notSeen'] as num).toInt(),
  notOnJuvi: (json['notOnJuvi'] as num).toInt(),
);

Map<String, dynamic> _$ReachGroupToJson(_ReachGroup instance) =>
    <String, dynamic>{
      'label': instance.label,
      'total': instance.total,
      'acknowledged': instance.acknowledged,
      'seen': instance.seen,
      'notSeen': instance.notSeen,
      'notOnJuvi': instance.notOnJuvi,
    };

_ReachAddedLaterItem _$ReachAddedLaterItemFromJson(Map<String, dynamic> json) =>
    _ReachAddedLaterItem(
      name: json['name'] as String,
      group: json['group'] as String,
      state: json['state'] as String,
      identifier: json['identifier'] as String?,
      at: json['at'] == null ? null : DateTime.parse(json['at'] as String),
    );

Map<String, dynamic> _$ReachAddedLaterItemToJson(
  _ReachAddedLaterItem instance,
) => <String, dynamic>{
  'name': instance.name,
  'group': instance.group,
  'state': instance.state,
  'identifier': instance.identifier,
  'at': instance.at?.toIso8601String(),
};

_ReachAddedLater _$ReachAddedLaterFromJson(Map<String, dynamic> json) =>
    _ReachAddedLater(
      total: (json['total'] as num).toInt(),
      acknowledged: (json['acknowledged'] as num).toInt(),
      seen: (json['seen'] as num).toInt(),
      items: (json['items'] as List<dynamic>)
          .map((e) => ReachAddedLaterItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ReachAddedLaterToJson(_ReachAddedLater instance) =>
    <String, dynamic>{
      'total': instance.total,
      'acknowledged': instance.acknowledged,
      'seen': instance.seen,
      'items': instance.items.map((e) => e.toJson()).toList(),
    };

_NoticeReachData _$NoticeReachDataFromJson(Map<String, dynamic> json) =>
    _NoticeReachData(
      noticeId: json['noticeId'] as String,
      title: json['title'] as String,
      status: json['status'] as String,
      ackRequired: json['ackRequired'] as bool,
      audience: (json['audience'] as num).toInt(),
      acknowledged: (json['acknowledged'] as num).toInt(),
      seen: (json['seen'] as num).toInt(),
      notSeen: (json['notSeen'] as num).toInt(),
      notOnJuvi: (json['notOnJuvi'] as num).toInt(),
      dismissed: (json['dismissed'] as num).toInt(),
      lateCount: (json['late'] as num).toInt(),
      reminders: Reminders.fromJson(json['reminders'] as Map<String, dynamic>),
      sparkline: (json['sparkline'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
      groups: (json['groups'] as List<dynamic>)
          .map((e) => ReachGroup.fromJson(e as Map<String, dynamic>))
          .toList(),
      lateAcks: (json['lateAcks'] as List<dynamic>)
          .map((e) => ReachPerson.fromJson(e as Map<String, dynamic>))
          .toList(),
      comments: (json['comments'] as List<dynamic>)
          .map((e) => ReachComment.fromJson(e as Map<String, dynamic>))
          .toList(),
      addedLater: ReachAddedLater.fromJson(
        json['addedLater'] as Map<String, dynamic>,
      ),
      asOf: DateTime.parse(json['asOf'] as String),
      deadline: json['deadline'] == null
          ? null
          : DateTime.parse(json['deadline'] as String),
      publishedAt: json['publishedAt'] == null
          ? null
          : DateTime.parse(json['publishedAt'] as String),
    );

Map<String, dynamic> _$NoticeReachDataToJson(_NoticeReachData instance) =>
    <String, dynamic>{
      'noticeId': instance.noticeId,
      'title': instance.title,
      'status': instance.status,
      'ackRequired': instance.ackRequired,
      'audience': instance.audience,
      'acknowledged': instance.acknowledged,
      'seen': instance.seen,
      'notSeen': instance.notSeen,
      'notOnJuvi': instance.notOnJuvi,
      'dismissed': instance.dismissed,
      'late': instance.lateCount,
      'reminders': instance.reminders.toJson(),
      'sparkline': instance.sparkline,
      'groups': instance.groups.map((e) => e.toJson()).toList(),
      'lateAcks': instance.lateAcks.map((e) => e.toJson()).toList(),
      'comments': instance.comments.map((e) => e.toJson()).toList(),
      'addedLater': instance.addedLater.toJson(),
      'asOf': instance.asOf.toIso8601String(),
      'deadline': instance.deadline?.toIso8601String(),
      'publishedAt': instance.publishedAt?.toIso8601String(),
    };

_PendingPerson _$PendingPersonFromJson(Map<String, dynamic> json) =>
    _PendingPerson(
      name: json['name'] as String,
      group: json['group'] as String,
      state: json['state'] as String,
      identifier: json['identifier'] as String?,
      lastSeenInApp: json['lastSeenInApp'] == null
          ? null
          : DateTime.parse(json['lastSeenInApp'] as String),
    );

Map<String, dynamic> _$PendingPersonToJson(_PendingPerson instance) =>
    <String, dynamic>{
      'name': instance.name,
      'group': instance.group,
      'state': instance.state,
      'identifier': instance.identifier,
      'lastSeenInApp': instance.lastSeenInApp?.toIso8601String(),
    };

_PendingGroup _$PendingGroupFromJson(Map<String, dynamic> json) =>
    _PendingGroup(
      label: json['label'] as String,
      count: (json['count'] as num).toInt(),
    );

Map<String, dynamic> _$PendingGroupToJson(_PendingGroup instance) =>
    <String, dynamic>{'label': instance.label, 'count': instance.count};

_PendingPage _$PendingPageFromJson(Map<String, dynamic> json) => _PendingPage(
  items: (json['items'] as List<dynamic>)
      .map((e) => PendingPerson.fromJson(e as Map<String, dynamic>))
      .toList(),
  total: (json['total'] as num).toInt(),
  groups: (json['groups'] as List<dynamic>)
      .map((e) => PendingGroup.fromJson(e as Map<String, dynamic>))
      .toList(),
  nextCursor: json['nextCursor'] as String?,
);

Map<String, dynamic> _$PendingPageToJson(_PendingPage instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'total': instance.total,
      'groups': instance.groups.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
