// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'channel_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChannelDetail _$ChannelDetailFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ChannelDetail', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'about',
          'canPost',
          'canReply',
          'defaultPriority',
          'id',
          'linkedObject',
          'memberCount',
          'muted',
          'name',
          'replyRule',
          'role',
          'scopeType',
          'status',
          'templateCode',
          'whoCanPost',
        ],
      );
      final val = ChannelDetail(
        about: $checkedConvert('about', (v) => v as String),
        canPost: $checkedConvert('canPost', (v) => v as bool),
        canReply: $checkedConvert('canReply', (v) => v as bool),
        defaultPriority: $checkedConvert(
          'defaultPriority',
          (v) => $enumDecode(_$ChannelDetailDefaultPriorityEnumEnumMap, v),
        ),
        id: $checkedConvert('id', (v) => v as String),
        linkedObject: $checkedConvert(
          'linkedObject',
          (v) => ChannelDetailLinkedObject.fromJson(v as Map<String, dynamic>),
        ),
        memberCount: $checkedConvert('memberCount', (v) => (v as num).toInt()),
        muted: $checkedConvert('muted', (v) => v as bool),
        name: $checkedConvert('name', (v) => v as String),
        replyRule: $checkedConvert(
          'replyRule',
          (v) => $enumDecode(_$ChannelDetailReplyRuleEnumEnumMap, v),
        ),
        role: $checkedConvert(
          'role',
          (v) => $enumDecode(_$ChannelDetailRoleEnumEnumMap, v),
        ),
        scopeType: $checkedConvert(
          'scopeType',
          (v) => $enumDecode(_$ChannelDetailScopeTypeEnumEnumMap, v),
        ),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$ChannelDetailStatusEnumEnumMap, v),
        ),
        templateCode: $checkedConvert(
          'templateCode',
          (v) => $enumDecode(_$ChannelDetailTemplateCodeEnumEnumMap, v),
        ),
        whoCanPost: $checkedConvert('whoCanPost', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ChannelDetailToJson(ChannelDetail instance) =>
    <String, dynamic>{
      'about': instance.about,
      'canPost': instance.canPost,
      'canReply': instance.canReply,
      'defaultPriority':
          _$ChannelDetailDefaultPriorityEnumEnumMap[instance.defaultPriority]!,
      'id': instance.id,
      'linkedObject': instance.linkedObject.toJson(),
      'memberCount': instance.memberCount,
      'muted': instance.muted,
      'name': instance.name,
      'replyRule': _$ChannelDetailReplyRuleEnumEnumMap[instance.replyRule]!,
      'role': _$ChannelDetailRoleEnumEnumMap[instance.role]!,
      'scopeType': _$ChannelDetailScopeTypeEnumEnumMap[instance.scopeType]!,
      'status': _$ChannelDetailStatusEnumEnumMap[instance.status]!,
      'templateCode':
          _$ChannelDetailTemplateCodeEnumEnumMap[instance.templateCode]!,
      'whoCanPost': instance.whoCanPost,
    };

const _$ChannelDetailDefaultPriorityEnumEnumMap = {
  ChannelDetailDefaultPriorityEnum.routine: 'routine',
  ChannelDetailDefaultPriorityEnum.important: 'important',
};

const _$ChannelDetailReplyRuleEnumEnumMap = {
  ChannelDetailReplyRuleEnum.allowed: 'allowed',
  ChannelDetailReplyRuleEnum.announcementOnly: 'announcement_only',
};

const _$ChannelDetailRoleEnumEnumMap = {
  ChannelDetailRoleEnum.member: 'member',
  ChannelDetailRoleEnum.publisher: 'publisher',
};

const _$ChannelDetailScopeTypeEnumEnumMap = {
  ChannelDetailScopeTypeEnum.college: 'college',
  ChannelDetailScopeTypeEnum.department: 'department',
  ChannelDetailScopeTypeEnum.batch: 'batch',
  ChannelDetailScopeTypeEnum.courseOffering: 'course_offering',
  ChannelDetailScopeTypeEnum.hostelBlock: 'hostel_block',
};

const _$ChannelDetailStatusEnumEnumMap = {
  ChannelDetailStatusEnum.active: 'active',
  ChannelDetailStatusEnum.archived: 'archived',
};

const _$ChannelDetailTemplateCodeEnumEnumMap = {
  ChannelDetailTemplateCodeEnum.college: 'college',
  ChannelDetailTemplateCodeEnum.department: 'department',
  ChannelDetailTemplateCodeEnum.batch: 'batch',
  ChannelDetailTemplateCodeEnum.course: 'course',
  ChannelDetailTemplateCodeEnum.hostel: 'hostel',
};
