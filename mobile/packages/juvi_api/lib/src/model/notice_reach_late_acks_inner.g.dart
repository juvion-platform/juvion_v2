// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_late_acks_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachLateAcksInner _$NoticeReachLateAcksInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeReachLateAcksInner', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['at', 'group', 'identifier', 'name']);
  final val = NoticeReachLateAcksInner(
    at: $checkedConvert('at', (v) => v as String?),
    group: $checkedConvert('group', (v) => v as String),
    identifier: $checkedConvert('identifier', (v) => v as String?),
    name: $checkedConvert('name', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$NoticeReachLateAcksInnerToJson(
  NoticeReachLateAcksInner instance,
) => <String, dynamic>{
  'at': instance.at,
  'group': instance.group,
  'identifier': instance.identifier,
  'name': instance.name,
};
