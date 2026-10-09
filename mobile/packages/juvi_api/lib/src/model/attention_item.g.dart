// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attention_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AttentionItem _$AttentionItemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AttentionItem', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'kind']);
      final val = AttentionItem(
        ackAt: $checkedConvert('ackAt', (v) => v as String?),
        ackCommentAllowed: $checkedConvert(
          'ackCommentAllowed',
          (v) => v as bool?,
        ),
        ackRequired: $checkedConvert('ackRequired', (v) => v as bool?),
        amount: $checkedConvert('amount', (v) => (v as num?)?.toInt()),
        archived: $checkedConvert('archived', (v) => v as bool?),
        at: $checkedConvert('at', (v) => v as String?),
        attachmentCount: $checkedConvert(
          'attachmentCount',
          (v) => (v as num?)?.toInt(),
        ),
        audienceLine: $checkedConvert('audienceLine', (v) => v as String?),
        channelId: $checkedConvert('channelId', (v) => v as String?),
        courseCode: $checkedConvert('courseCode', (v) => v as String?),
        date: $checkedConvert('date', (v) => v as String?),
        deadline: $checkedConvert('deadline', (v) => v as String?),
        dueDate: $checkedConvert('dueDate', (v) => v as String?),
        id: $checkedConvert('id', (v) => v as String),
        invoiceNumber: $checkedConvert('invoiceNumber', (v) => v as String?),
        isPublisher: $checkedConvert('isPublisher', (v) => v as bool?),
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(_$AttentionItemKindEnumEnumMap, v),
        ),
        late_: $checkedConvert('late', (v) => v as bool?),
        newDate: $checkedConvert('newDate', (v) => v as String?),
        newStart: $checkedConvert('newStart', (v) => v as String?),
        offeringId: $checkedConvert('offeringId', (v) => v as String?),
        office: $checkedConvert('office', (v) => v as String?),
        overdue: $checkedConvert('overdue', (v) => v as bool?),
        preview: $checkedConvert('preview', (v) => v as String?),
        priority: $checkedConvert(
          'priority',
          (v) => $enumDecodeNullable(_$AttentionItemPriorityEnumEnumMap, v),
        ),
        publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
        purpose: $checkedConvert(
          'purpose',
          (v) => $enumDecodeNullable(_$AttentionItemPurposeEnumEnumMap, v),
        ),
        remindedAt: $checkedConvert('remindedAt', (v) => v as String?),
        room: $checkedConvert('room', (v) => v as String?),
        seenAt: $checkedConvert('seenAt', (v) => v as String?),
        start: $checkedConvert('start', (v) => v as String?),
        state: $checkedConvert(
          'state',
          (v) => $enumDecodeNullable(_$AttentionItemStateEnumEnumMap, v),
        ),
        title: $checkedConvert('title', (v) => v as String?),
        type: $checkedConvert(
          'type',
          (v) => $enumDecodeNullable(_$AttentionItemTypeEnumEnumMap, v),
        ),
      );
      return val;
    }, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$AttentionItemToJson(AttentionItem instance) =>
    <String, dynamic>{
      'ackAt': ?instance.ackAt,
      'ackCommentAllowed': ?instance.ackCommentAllowed,
      'ackRequired': ?instance.ackRequired,
      'amount': ?instance.amount,
      'archived': ?instance.archived,
      'at': ?instance.at,
      'attachmentCount': ?instance.attachmentCount,
      'audienceLine': ?instance.audienceLine,
      'channelId': ?instance.channelId,
      'courseCode': ?instance.courseCode,
      'date': ?instance.date,
      'deadline': ?instance.deadline,
      'dueDate': ?instance.dueDate,
      'id': instance.id,
      'invoiceNumber': ?instance.invoiceNumber,
      'isPublisher': ?instance.isPublisher,
      'kind': _$AttentionItemKindEnumEnumMap[instance.kind]!,
      'late': ?instance.late_,
      'newDate': ?instance.newDate,
      'newStart': ?instance.newStart,
      'offeringId': ?instance.offeringId,
      'office': ?instance.office,
      'overdue': ?instance.overdue,
      'preview': ?instance.preview,
      'priority': ?_$AttentionItemPriorityEnumEnumMap[instance.priority],
      'publishedAt': ?instance.publishedAt,
      'purpose': ?_$AttentionItemPurposeEnumEnumMap[instance.purpose],
      'remindedAt': ?instance.remindedAt,
      'room': ?instance.room,
      'seenAt': ?instance.seenAt,
      'start': ?instance.start,
      'state': ?_$AttentionItemStateEnumEnumMap[instance.state],
      'title': ?instance.title,
      'type': ?_$AttentionItemTypeEnumEnumMap[instance.type],
    };

const _$AttentionItemKindEnumEnumMap = {
  AttentionItemKindEnum.notice: 'notice',
  AttentionItemKindEnum.classChange: 'class_change',
  AttentionItemKindEnum.feeDue: 'fee_due',
  AttentionItemKindEnum.assessment: 'assessment',
};

const _$AttentionItemPriorityEnumEnumMap = {
  AttentionItemPriorityEnum.routine: 'routine',
  AttentionItemPriorityEnum.important: 'important',
  AttentionItemPriorityEnum.urgent: 'urgent',
};

const _$AttentionItemPurposeEnumEnumMap = {
  AttentionItemPurposeEnum.standard: 'standard',
  AttentionItemPurposeEnum.welcome: 'welcome',
};

const _$AttentionItemStateEnumEnumMap = {
  AttentionItemStateEnum.received: 'received',
  AttentionItemStateEnum.seen: 'seen',
  AttentionItemStateEnum.acknowledged: 'acknowledged',
  AttentionItemStateEnum.dismissed: 'dismissed',
};

const _$AttentionItemTypeEnumEnumMap = {
  AttentionItemTypeEnum.cancelled: 'cancelled',
  AttentionItemTypeEnum.rescheduled: 'rescheduled',
};
