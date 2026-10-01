// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_added_later_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachAddedLaterItemsInner _$NoticeReachAddedLaterItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeReachAddedLaterItemsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['at', 'group', 'identifier', 'name', 'state'],
  );
  final val = NoticeReachAddedLaterItemsInner(
    at: $checkedConvert('at', (v) => v as String?),
    group: $checkedConvert('group', (v) => v as String),
    identifier: $checkedConvert('identifier', (v) => v as String?),
    name: $checkedConvert('name', (v) => v as String),
    state: $checkedConvert(
      'state',
      (v) => $enumDecode(_$NoticeReachAddedLaterItemsInnerStateEnumEnumMap, v),
    ),
  );
  return val;
});

Map<String, dynamic> _$NoticeReachAddedLaterItemsInnerToJson(
  NoticeReachAddedLaterItemsInner instance,
) => <String, dynamic>{
  'at': instance.at,
  'group': instance.group,
  'identifier': instance.identifier,
  'name': instance.name,
  'state': _$NoticeReachAddedLaterItemsInnerStateEnumEnumMap[instance.state]!,
};

const _$NoticeReachAddedLaterItemsInnerStateEnumEnumMap = {
  NoticeReachAddedLaterItemsInnerStateEnum.acknowledged: 'acknowledged',
  NoticeReachAddedLaterItemsInnerStateEnum.seen: 'seen',
  NoticeReachAddedLaterItemsInnerStateEnum.notSeen: 'not_seen',
  NoticeReachAddedLaterItemsInnerStateEnum.notOnJuvi: 'not_on_juvi',
};
