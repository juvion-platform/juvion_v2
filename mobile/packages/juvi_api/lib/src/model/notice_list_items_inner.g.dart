// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_list_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeListItemsInner _$NoticeListItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeListItemsInner', json, ($checkedConvert) {
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
  final val = NoticeListItemsInner(
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
      (v) => $enumDecode(_$NoticeListItemsInnerPriorityEnumEnumMap, v),
    ),
    publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
    purpose: $checkedConvert(
      'purpose',
      (v) => $enumDecode(_$NoticeListItemsInnerPurposeEnumEnumMap, v),
    ),
    remindedAt: $checkedConvert('remindedAt', (v) => v as String?),
    seenAt: $checkedConvert('seenAt', (v) => v as String?),
    state: $checkedConvert(
      'state',
      (v) => $enumDecode(_$NoticeListItemsInnerStateEnumEnumMap, v),
    ),
    title: $checkedConvert('title', (v) => v as String),
  );
  return val;
}, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$NoticeListItemsInnerToJson(
  NoticeListItemsInner instance,
) => <String, dynamic>{
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
  'priority': _$NoticeListItemsInnerPriorityEnumEnumMap[instance.priority]!,
  'publishedAt': instance.publishedAt,
  'purpose': _$NoticeListItemsInnerPurposeEnumEnumMap[instance.purpose]!,
  'remindedAt': instance.remindedAt,
  'seenAt': instance.seenAt,
  'state': _$NoticeListItemsInnerStateEnumEnumMap[instance.state]!,
  'title': instance.title,
};

const _$NoticeListItemsInnerPriorityEnumEnumMap = {
  NoticeListItemsInnerPriorityEnum.routine: 'routine',
  NoticeListItemsInnerPriorityEnum.important: 'important',
  NoticeListItemsInnerPriorityEnum.urgent: 'urgent',
};

const _$NoticeListItemsInnerPurposeEnumEnumMap = {
  NoticeListItemsInnerPurposeEnum.standard: 'standard',
  NoticeListItemsInnerPurposeEnum.welcome: 'welcome',
};

const _$NoticeListItemsInnerStateEnumEnumMap = {
  NoticeListItemsInnerStateEnum.received: 'received',
  NoticeListItemsInnerStateEnum.seen: 'seen',
  NoticeListItemsInnerStateEnum.acknowledged: 'acknowledged',
  NoticeListItemsInnerStateEnum.dismissed: 'dismissed',
};
