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
      'delivery',
      'group',
      'identifier',
      'lastSeenInApp',
      'name',
      'state',
    ],
  );
  final val = NoticePendingItemsInner(
    delivery: $checkedConvert(
      'delivery',
      (v) => $enumDecode(_$NoticePendingItemsInnerDeliveryEnumEnumMap, v),
    ),
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
  'delivery': _$NoticePendingItemsInnerDeliveryEnumEnumMap[instance.delivery]!,
  'group': instance.group,
  'identifier': instance.identifier,
  'lastSeenInApp': instance.lastSeenInApp,
  'name': instance.name,
  'state': _$NoticePendingItemsInnerStateEnumEnumMap[instance.state]!,
};

const _$NoticePendingItemsInnerDeliveryEnumEnumMap = {
  NoticePendingItemsInnerDeliveryEnum.notDelivered: 'not_delivered',
  NoticePendingItemsInnerDeliveryEnum.delivered: 'delivered',
  NoticePendingItemsInnerDeliveryEnum.opened: 'opened',
  NoticePendingItemsInnerDeliveryEnum.muted: 'muted',
  NoticePendingItemsInnerDeliveryEnum.tierOff: 'tier_off',
  NoticePendingItemsInnerDeliveryEnum.noDevice: 'no_device',
  NoticePendingItemsInnerDeliveryEnum.scheduled: 'scheduled',
  NoticePendingItemsInnerDeliveryEnum.none: 'none',
};

const _$NoticePendingItemsInnerStateEnumEnumMap = {
  NoticePendingItemsInnerStateEnum.seen: 'seen',
  NoticePendingItemsInnerStateEnum.notSeen: 'not_seen',
  NoticePendingItemsInnerStateEnum.notOnJuvi: 'not_on_juvi',
};
