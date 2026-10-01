// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeCard _$NoticeCardFromJson(Map<String, dynamic> json) => $checkedCreate(
  'NoticeCard',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'ackAt',
        'ackCommentAllowed',
        'ackRequired',
        'archived',
        'attachmentCount',
        'audienceLine',
        'deadline',
        'id',
        'isPublisher',
        'late',
        'office',
        'preview',
        'priority',
        'publishedAt',
        'purpose',
        'remindedAt',
        'seenAt',
        'state',
        'title',
      ],
    );
    final val = NoticeCard(
      ackAt: $checkedConvert('ackAt', (v) => v as String?),
      ackCommentAllowed: $checkedConvert('ackCommentAllowed', (v) => v as bool),
      ackRequired: $checkedConvert('ackRequired', (v) => v as bool),
      archived: $checkedConvert('archived', (v) => v as bool),
      attachmentCount: $checkedConvert(
        'attachmentCount',
        (v) => (v as num).toInt(),
      ),
      audienceLine: $checkedConvert('audienceLine', (v) => v as String),
      deadline: $checkedConvert('deadline', (v) => v as String?),
      id: $checkedConvert('id', (v) => v as String),
      isPublisher: $checkedConvert('isPublisher', (v) => v as bool),
      late_: $checkedConvert('late', (v) => v as bool),
      office: $checkedConvert('office', (v) => v as String),
      preview: $checkedConvert('preview', (v) => v as String),
      priority: $checkedConvert(
        'priority',
        (v) => $enumDecode(_$NoticeCardPriorityEnumEnumMap, v),
      ),
      publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
      purpose: $checkedConvert(
        'purpose',
        (v) => $enumDecode(_$NoticeCardPurposeEnumEnumMap, v),
      ),
      remindedAt: $checkedConvert('remindedAt', (v) => v as String?),
      seenAt: $checkedConvert('seenAt', (v) => v as String?),
      state: $checkedConvert(
        'state',
        (v) => $enumDecode(_$NoticeCardStateEnumEnumMap, v),
      ),
      title: $checkedConvert('title', (v) => v as String),
    );
    return val;
  },
  fieldKeyMap: const {'late_': 'late'},
);

Map<String, dynamic> _$NoticeCardToJson(NoticeCard instance) =>
    <String, dynamic>{
      'ackAt': instance.ackAt,
      'ackCommentAllowed': instance.ackCommentAllowed,
      'ackRequired': instance.ackRequired,
      'archived': instance.archived,
      'attachmentCount': instance.attachmentCount,
      'audienceLine': instance.audienceLine,
      'deadline': instance.deadline,
      'id': instance.id,
      'isPublisher': instance.isPublisher,
      'late': instance.late_,
      'office': instance.office,
      'preview': instance.preview,
      'priority': _$NoticeCardPriorityEnumEnumMap[instance.priority]!,
      'publishedAt': instance.publishedAt,
      'purpose': _$NoticeCardPurposeEnumEnumMap[instance.purpose]!,
      'remindedAt': instance.remindedAt,
      'seenAt': instance.seenAt,
      'state': _$NoticeCardStateEnumEnumMap[instance.state]!,
      'title': instance.title,
    };

const _$NoticeCardPriorityEnumEnumMap = {
  NoticeCardPriorityEnum.routine: 'routine',
  NoticeCardPriorityEnum.important: 'important',
  NoticeCardPriorityEnum.urgent: 'urgent',
};

const _$NoticeCardPurposeEnumEnumMap = {
  NoticeCardPurposeEnum.standard: 'standard',
  NoticeCardPurposeEnum.welcome: 'welcome',
};

const _$NoticeCardStateEnumEnumMap = {
  NoticeCardStateEnum.received: 'received',
  NoticeCardStateEnum.seen: 'seen',
  NoticeCardStateEnum.acknowledged: 'acknowledged',
  NoticeCardStateEnum.dismissed: 'dismissed',
};
