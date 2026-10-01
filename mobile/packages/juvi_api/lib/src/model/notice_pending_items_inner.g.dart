// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_pending_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticePendingItemsInner _$NoticePendingItemsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticePendingItemsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'group',
      'identifier',
      'lastSeenInApp',
      'name',
      'state',
    ],
  );
  final val = NoticePendingItemsInner(
    group: $checkedConvert('group', (v) => v as String),
    identifier: $checkedConvert('identifier', (v) => v as String?),
    lastSeenInApp: $checkedConvert('lastSeenInApp', (v) => v as String?),
    name: $checkedConvert('name', (v) => v as String),
    state: $checkedConvert(
      'state',
      (v) => $enumDecode(_$NoticePendingItemsInnerStateEnumEnumMap, v),
    ),
  );
  return val;
});

Map<String, dynamic> _$NoticePendingItemsInnerToJson(
  NoticePendingItemsInner instance,
) => <String, dynamic>{
  'group': instance.group,
  'identifier': instance.identifier,
  'lastSeenInApp': instance.lastSeenInApp,
  'name': instance.name,
  'state': _$NoticePendingItemsInnerStateEnumEnumMap[instance.state]!,
};

const _$NoticePendingItemsInnerStateEnumEnumMap = {
  NoticePendingItemsInnerStateEnum.seen: 'seen',
  NoticePendingItemsInnerStateEnum.notSeen: 'not_seen',
  NoticePendingItemsInnerStateEnum.notOnJuvi: 'not_on_juvi',
};
