// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spaces_groups_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SpacesGroupsInner _$SpacesGroupsInnerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SpacesGroupsInner', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['channels', 'key', 'title']);
      final val = SpacesGroupsInner(
        channels: $checkedConvert(
          'channels',
          (v) => (v as List<dynamic>)
              .map(
                (e) => SpacesGroupsInnerChannelsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        emptyHint: $checkedConvert('emptyHint', (v) => v as String?),
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(_$SpacesGroupsInnerKeyEnumEnumMap, v),
        ),
        title: $checkedConvert('title', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SpacesGroupsInnerToJson(SpacesGroupsInner instance) =>
    <String, dynamic>{
      'channels': instance.channels.map((e) => e.toJson()).toList(),
      'emptyHint': ?instance.emptyHint,
      'key': _$SpacesGroupsInnerKeyEnumEnumMap[instance.key]!,
      'title': instance.title,
    };

const _$SpacesGroupsInnerKeyEnumEnumMap = {
  SpacesGroupsInnerKeyEnum.college: 'college',
  SpacesGroupsInnerKeyEnum.department: 'department',
  SpacesGroupsInnerKeyEnum.batch: 'batch',
  SpacesGroupsInnerKeyEnum.courses: 'courses',
  SpacesGroupsInnerKeyEnum.hostel: 'hostel',
  SpacesGroupsInnerKeyEnum.archived: 'archived',
};
