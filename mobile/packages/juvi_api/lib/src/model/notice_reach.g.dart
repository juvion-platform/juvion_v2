// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReach _$NoticeReachFromJson(Map<String, dynamic> json) => $checkedCreate(
  'NoticeReach',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'ackRequired',
        'acknowledged',
        'addedLater',
        'asOf',
        'audience',
        'comments',
        'deadline',
        'dismissed',
        'groups',
        'late',
        'lateAcks',
        'notOnJuvi',
        'notSeen',
        'noticeId',
        'publishedAt',
        'reminders',
        'seen',
        'sparkline',
        'status',
        'title',
      ],
    );
    final val = NoticeReach(
      ackRequired: $checkedConvert('ackRequired', (v) => v as bool),
      acknowledged: $checkedConvert('acknowledged', (v) => (v as num).toInt()),
      addedLater: $checkedConvert(
        'addedLater',
        (v) => NoticeReachAddedLater.fromJson(v as Map<String, dynamic>),
      ),
      asOf: $checkedConvert('asOf', (v) => v as String),
      audience: $checkedConvert('audience', (v) => (v as num).toInt()),
      comments: $checkedConvert(
        'comments',
        (v) => (v as List<dynamic>)
            .map(
              (e) =>
                  NoticeReachCommentsInner.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      ),
      deadline: $checkedConvert('deadline', (v) => v as String?),
      dismissed: $checkedConvert('dismissed', (v) => (v as num).toInt()),
      groups: $checkedConvert(
        'groups',
        (v) => (v as List<dynamic>)
            .map(
              (e) => NoticeReachGroupsInner.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      ),
      late_: $checkedConvert('late', (v) => (v as num).toInt()),
      lateAcks: $checkedConvert(
        'lateAcks',
        (v) => (v as List<dynamic>)
            .map(
              (e) =>
                  NoticeReachLateAcksInner.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      ),
      notOnJuvi: $checkedConvert('notOnJuvi', (v) => (v as num).toInt()),
      notSeen: $checkedConvert('notSeen', (v) => (v as num).toInt()),
      noticeId: $checkedConvert('noticeId', (v) => v as String),
      publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
      reminders: $checkedConvert(
        'reminders',
        (v) => ErrorEnvelopeErrorReminders.fromJson(v as Map<String, dynamic>),
      ),
      seen: $checkedConvert('seen', (v) => (v as num).toInt()),
      sparkline: $checkedConvert(
        'sparkline',
        (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
      ),
      status: $checkedConvert(
        'status',
        (v) => $enumDecode(_$NoticeReachStatusEnumEnumMap, v),
      ),
      title: $checkedConvert('title', (v) => v as String),
    );
    return val;
  },
  fieldKeyMap: const {'late_': 'late'},
);

Map<String, dynamic> _$NoticeReachToJson(NoticeReach instance) =>
    <String, dynamic>{
      'ackRequired': instance.ackRequired,
      'acknowledged': instance.acknowledged,
      'addedLater': instance.addedLater.toJson(),
      'asOf': instance.asOf,
      'audience': instance.audience,
      'comments': instance.comments.map((e) => e.toJson()).toList(),
      'deadline': instance.deadline,
      'dismissed': instance.dismissed,
      'groups': instance.groups.map((e) => e.toJson()).toList(),
      'late': instance.late_,
      'lateAcks': instance.lateAcks.map((e) => e.toJson()).toList(),
      'notOnJuvi': instance.notOnJuvi,
      'notSeen': instance.notSeen,
      'noticeId': instance.noticeId,
      'publishedAt': instance.publishedAt,
      'reminders': instance.reminders.toJson(),
      'seen': instance.seen,
      'sparkline': instance.sparkline,
      'status': _$NoticeReachStatusEnumEnumMap[instance.status]!,
      'title': instance.title,
    };

const _$NoticeReachStatusEnumEnumMap = {
  NoticeReachStatusEnum.publishing: 'publishing',
  NoticeReachStatusEnum.published: 'published',
  NoticeReachStatusEnum.archived: 'archived',
};
