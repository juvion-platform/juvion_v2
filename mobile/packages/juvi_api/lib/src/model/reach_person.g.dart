// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reach_person.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReachPerson _$ReachPersonFromJson(Map<String, dynamic> json) => $checkedCreate(
  'ReachPerson',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['at', 'group', 'identifier', 'name']);
    final val = ReachPerson(
      at: $checkedConvert('at', (v) => v as String?),
      group: $checkedConvert('group', (v) => v as String),
      identifier: $checkedConvert('identifier', (v) => v as String?),
      name: $checkedConvert('name', (v) => v as String),
    );
    return val;
  },
);

Map<String, dynamic> _$ReachPersonToJson(ReachPerson instance) =>
    <String, dynamic>{
      'at': instance.at,
      'group': instance.group,
      'identifier': instance.identifier,
      'name': instance.name,
    };
