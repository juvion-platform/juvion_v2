// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_pending_groups_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticePendingGroupsInner _$NoticePendingGroupsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticePendingGroupsInner', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['count', 'label']);
  final val = NoticePendingGroupsInner(
    count: $checkedConvert('count', (v) => (v as num).toInt()),
    label: $checkedConvert('label', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$NoticePendingGroupsInnerToJson(
  NoticePendingGroupsInner instance,
) => <String, dynamic>{'count': instance.count, 'label': instance.label};
