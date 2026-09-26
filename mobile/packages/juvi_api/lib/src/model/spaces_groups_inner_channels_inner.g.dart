// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spaces_groups_inner_channels_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SpacesGroupsInnerChannelsInner _$SpacesGroupsInnerChannelsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SpacesGroupsInnerChannelsInner', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'about',
      'archived',
      'id',
      'memberCount',
      'muted',
      'name',
      'nextClassAt',
      'nextClassLabel',
      'role',
      'scopeType',
      'templateCode',
    ],
  );
  final val = SpacesGroupsInnerChannelsInner(
    about: $checkedConvert('about', (v) => v as String),
    archived: $checkedConvert('archived', (v) => v as bool),
    id: $checkedConvert('id', (v) => v as String),
    memberCount: $checkedConvert('memberCount', (v) => (v as num).toInt()),
    muted: $checkedConvert('muted', (v) => v as bool),
    name: $checkedConvert('name', (v) => v as String),
    nextClassAt: $checkedConvert('nextClassAt', (v) => v as String?),
    nextClassLabel: $checkedConvert('nextClassLabel', (v) => v as String?),
    role: $checkedConvert(
      'role',
      (v) => $enumDecode(_$SpacesGroupsInnerChannelsInnerRoleEnumEnumMap, v),
    ),
    scopeType: $checkedConvert(
      'scopeType',
      (v) =>
          $enumDecode(_$SpacesGroupsInnerChannelsInnerScopeTypeEnumEnumMap, v),
    ),
    templateCode: $checkedConvert(
      'templateCode',
      (v) => $enumDecode(
        _$SpacesGroupsInnerChannelsInnerTemplateCodeEnumEnumMap,
        v,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$SpacesGroupsInnerChannelsInnerToJson(
  SpacesGroupsInnerChannelsInner instance,
) => <String, dynamic>{
  'about': instance.about,
  'archived': instance.archived,
  'id': instance.id,
  'memberCount': instance.memberCount,
  'muted': instance.muted,
  'name': instance.name,
  'nextClassAt': instance.nextClassAt,
  'nextClassLabel': instance.nextClassLabel,
  'role': _$SpacesGroupsInnerChannelsInnerRoleEnumEnumMap[instance.role]!,
  'scopeType':
      _$SpacesGroupsInnerChannelsInnerScopeTypeEnumEnumMap[instance.scopeType]!,
  'templateCode':
      _$SpacesGroupsInnerChannelsInnerTemplateCodeEnumEnumMap[instance
          .templateCode]!,
};

const _$SpacesGroupsInnerChannelsInnerRoleEnumEnumMap = {
  SpacesGroupsInnerChannelsInnerRoleEnum.member: 'member',
  SpacesGroupsInnerChannelsInnerRoleEnum.publisher: 'publisher',
};

const _$SpacesGroupsInnerChannelsInnerScopeTypeEnumEnumMap = {
  SpacesGroupsInnerChannelsInnerScopeTypeEnum.college: 'college',
  SpacesGroupsInnerChannelsInnerScopeTypeEnum.department: 'department',
  SpacesGroupsInnerChannelsInnerScopeTypeEnum.batch: 'batch',
  SpacesGroupsInnerChannelsInnerScopeTypeEnum.courseOffering: 'course_offering',
  SpacesGroupsInnerChannelsInnerScopeTypeEnum.hostelBlock: 'hostel_block',
};

const _$SpacesGroupsInnerChannelsInnerTemplateCodeEnumEnumMap = {
  SpacesGroupsInnerChannelsInnerTemplateCodeEnum.college: 'college',
  SpacesGroupsInnerChannelsInnerTemplateCodeEnum.department: 'department',
  SpacesGroupsInnerChannelsInnerTemplateCodeEnum.batch: 'batch',
  SpacesGroupsInnerChannelsInnerTemplateCodeEnum.course: 'course',
  SpacesGroupsInnerChannelsInnerTemplateCodeEnum.hostel: 'hostel',
};
