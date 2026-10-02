// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pending_person.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PendingPerson _$PendingPersonFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PendingPerson', json, ($checkedConvert) {
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
      final val = PendingPerson(
        delivery: $checkedConvert(
          'delivery',
          (v) => $enumDecode(_$PendingPersonDeliveryEnumEnumMap, v),
        ),
        group: $checkedConvert('group', (v) => v as String),
        identifier: $checkedConvert('identifier', (v) => v as String?),
        lastSeenInApp: $checkedConvert('lastSeenInApp', (v) => v as String?),
        name: $checkedConvert('name', (v) => v as String),
        state: $checkedConvert(
          'state',
          (v) => $enumDecode(_$PendingPersonStateEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PendingPersonToJson(PendingPerson instance) =>
    <String, dynamic>{
      'delivery': _$PendingPersonDeliveryEnumEnumMap[instance.delivery]!,
      'group': instance.group,
      'identifier': instance.identifier,
      'lastSeenInApp': instance.lastSeenInApp,
      'name': instance.name,
      'state': _$PendingPersonStateEnumEnumMap[instance.state]!,
    };

const _$PendingPersonDeliveryEnumEnumMap = {
  PendingPersonDeliveryEnum.notDelivered: 'not_delivered',
  PendingPersonDeliveryEnum.delivered: 'delivered',
  PendingPersonDeliveryEnum.opened: 'opened',
  PendingPersonDeliveryEnum.muted: 'muted',
  PendingPersonDeliveryEnum.tierOff: 'tier_off',
  PendingPersonDeliveryEnum.noDevice: 'no_device',
  PendingPersonDeliveryEnum.scheduled: 'scheduled',
  PendingPersonDeliveryEnum.none: 'none',
};

const _$PendingPersonStateEnumEnumMap = {
  PendingPersonStateEnum.seen: 'seen',
  PendingPersonStateEnum.notSeen: 'not_seen',
  PendingPersonStateEnum.notOnJuvi: 'not_on_juvi',
};
