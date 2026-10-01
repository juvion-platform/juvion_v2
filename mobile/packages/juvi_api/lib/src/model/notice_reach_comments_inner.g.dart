// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_comments_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachCommentsInner _$NoticeReachCommentsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeReachCommentsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'at',
      'comment',
      'group',
      'identifier',
      'late',
      'name',
    ],
  );
  final val = NoticeReachCommentsInner(
    at: $checkedConvert('at', (v) => v as String?),
    comment: $checkedConvert('comment', (v) => v as String),
    group: $checkedConvert('group', (v) => v as String),
    identifier: $checkedConvert('identifier', (v) => v as String?),
    late_: $checkedConvert('late', (v) => v as bool),
    name: $checkedConvert('name', (v) => v as String),
  );
  return val;
}, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$NoticeReachCommentsInnerToJson(
  NoticeReachCommentsInner instance,
) => <String, dynamic>{
  'at': instance.at,
  'comment': instance.comment,
  'group': instance.group,
  'identifier': instance.identifier,
  'late': instance.late_,
  'name': instance.name,
};
