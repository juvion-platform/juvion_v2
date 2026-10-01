// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeDetail _$NoticeDetailFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeDetail', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'ackAt',
          'ackClientAt',
          'ackComment',
          'ackCommentAllowed',
          'ackMethod',
          'ackOffline',
          'ackRequired',
          'archived',
          'attachmentCount',
          'attachments',
          'audienceLine',
          'body',
          'deadline',
          'dismissedAt',
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
      final val = NoticeDetail(
        ackAt: $checkedConvert('ackAt', (v) => v as String?),
        ackClientAt: $checkedConvert('ackClientAt', (v) => v as String?),
        ackComment: $checkedConvert('ackComment', (v) => v as String?),
        ackCommentAllowed: $checkedConvert(
          'ackCommentAllowed',
          (v) => v as bool,
        ),
        ackMethod: $checkedConvert(
          'ackMethod',
          (v) => $enumDecodeNullable(_$NoticeDetailAckMethodEnumEnumMap, v),
        ),
        ackOffline: $checkedConvert('ackOffline', (v) => v as bool),
        ackRequired: $checkedConvert('ackRequired', (v) => v as bool),
        archived: $checkedConvert('archived', (v) => v as bool),
        attachmentCount: $checkedConvert(
          'attachmentCount',
          (v) => (v as num).toInt(),
        ),
        attachments: $checkedConvert(
          'attachments',
          (v) => (v as List<dynamic>)
              .map(
                (e) => NoticeDetailAttachmentsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        audienceLine: $checkedConvert('audienceLine', (v) => v as String),
        body: $checkedConvert('body', (v) => v as String),
        deadline: $checkedConvert('deadline', (v) => v as String?),
        dismissedAt: $checkedConvert('dismissedAt', (v) => v as String?),
        id: $checkedConvert('id', (v) => v as String),
        isPublisher: $checkedConvert('isPublisher', (v) => v as bool),
        late_: $checkedConvert('late', (v) => v as bool),
        office: $checkedConvert('office', (v) => v as String),
        preview: $checkedConvert('preview', (v) => v as String),
        priority: $checkedConvert(
          'priority',
          (v) => $enumDecode(_$NoticeDetailPriorityEnumEnumMap, v),
        ),
        publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
        purpose: $checkedConvert(
          'purpose',
          (v) => $enumDecode(_$NoticeDetailPurposeEnumEnumMap, v),
        ),
        remindedAt: $checkedConvert('remindedAt', (v) => v as String?),
        seenAt: $checkedConvert('seenAt', (v) => v as String?),
        state: $checkedConvert(
          'state',
          (v) => $enumDecode(_$NoticeDetailStateEnumEnumMap, v),
        ),
        title: $checkedConvert('title', (v) => v as String),
      );
      return val;
    }, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$NoticeDetailToJson(NoticeDetail instance) =>
    <String, dynamic>{
      'ackAt': instance.ackAt,
      'ackClientAt': instance.ackClientAt,
      'ackComment': instance.ackComment,
      'ackCommentAllowed': instance.ackCommentAllowed,
      'ackMethod': _$NoticeDetailAckMethodEnumEnumMap[instance.ackMethod],
      'ackOffline': instance.ackOffline,
      'ackRequired': instance.ackRequired,
      'archived': instance.archived,
      'attachmentCount': instance.attachmentCount,
      'attachments': instance.attachments.map((e) => e.toJson()).toList(),
      'audienceLine': instance.audienceLine,
      'body': instance.body,
      'deadline': instance.deadline,
      'dismissedAt': instance.dismissedAt,
      'id': instance.id,
      'isPublisher': instance.isPublisher,
      'late': instance.late_,
      'office': instance.office,
      'preview': instance.preview,
      'priority': _$NoticeDetailPriorityEnumEnumMap[instance.priority]!,
      'publishedAt': instance.publishedAt,
      'purpose': _$NoticeDetailPurposeEnumEnumMap[instance.purpose]!,
      'remindedAt': instance.remindedAt,
      'seenAt': instance.seenAt,
      'state': _$NoticeDetailStateEnumEnumMap[instance.state]!,
      'title': instance.title,
    };

const _$NoticeDetailAckMethodEnumEnumMap = {
  NoticeDetailAckMethodEnum.hold: 'hold',
  NoticeDetailAckMethodEnum.confirm: 'confirm',
};

const _$NoticeDetailPriorityEnumEnumMap = {
  NoticeDetailPriorityEnum.routine: 'routine',
  NoticeDetailPriorityEnum.important: 'important',
  NoticeDetailPriorityEnum.urgent: 'urgent',
};

const _$NoticeDetailPurposeEnumEnumMap = {
  NoticeDetailPurposeEnum.standard: 'standard',
  NoticeDetailPurposeEnum.welcome: 'welcome',
};

const _$NoticeDetailStateEnumEnumMap = {
  NoticeDetailStateEnum.received: 'received',
  NoticeDetailStateEnum.seen: 'seen',
  NoticeDetailStateEnum.acknowledged: 'acknowledged',
  NoticeDetailStateEnum.dismissed: 'dismissed',
};
