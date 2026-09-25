//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/channel_detail_linked_object.dart';
import 'package:json_annotation/json_annotation.dart';

part 'channel_detail.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChannelDetail {
  /// Returns a new [ChannelDetail] instance.
  ChannelDetail({

    required  this.about,

    required  this.canPost,

    required  this.canReply,

    required  this.defaultPriority,

    required  this.id,

    required  this.linkedObject,

    required  this.memberCount,

    required  this.muted,

    required  this.name,

    required  this.replyRule,

    required  this.role,

    required  this.scopeType,

    required  this.status,

    required  this.templateCode,

    required  this.whoCanPost,
  });

  @JsonKey(
    
    name: r'about',
    required: true,
    includeIfNull: false,
  )


  final String about;



  @JsonKey(
    
    name: r'canPost',
    required: true,
    includeIfNull: false,
  )


  final bool canPost;



  @JsonKey(
    
    name: r'canReply',
    required: true,
    includeIfNull: false,
  )


  final bool canReply;



  @JsonKey(
    
    name: r'defaultPriority',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailDefaultPriorityEnum defaultPriority;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'linkedObject',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailLinkedObject linkedObject;



  @JsonKey(
    
    name: r'memberCount',
    required: true,
    includeIfNull: false,
  )


  final int memberCount;



  @JsonKey(
    
    name: r'muted',
    required: true,
    includeIfNull: false,
  )


  final bool muted;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'replyRule',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailReplyRuleEnum replyRule;



  @JsonKey(
    
    name: r'role',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailRoleEnum role;



  @JsonKey(
    
    name: r'scopeType',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailScopeTypeEnum scopeType;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailStatusEnum status;



  @JsonKey(
    
    name: r'templateCode',
    required: true,
    includeIfNull: false,
  )


  final ChannelDetailTemplateCodeEnum templateCode;



  @JsonKey(
    
    name: r'whoCanPost',
    required: true,
    includeIfNull: false,
  )


  final String whoCanPost;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ChannelDetail &&
      other.about == about &&
      other.canPost == canPost &&
      other.canReply == canReply &&
      other.defaultPriority == defaultPriority &&
      other.id == id &&
      other.linkedObject == linkedObject &&
      other.memberCount == memberCount &&
      other.muted == muted &&
      other.name == name &&
      other.replyRule == replyRule &&
      other.role == role &&
      other.scopeType == scopeType &&
      other.status == status &&
      other.templateCode == templateCode &&
      other.whoCanPost == whoCanPost;

    @override
    int get hashCode =>
        about.hashCode +
        canPost.hashCode +
        canReply.hashCode +
        defaultPriority.hashCode +
        id.hashCode +
        linkedObject.hashCode +
        memberCount.hashCode +
        muted.hashCode +
        name.hashCode +
        replyRule.hashCode +
        role.hashCode +
        scopeType.hashCode +
        status.hashCode +
        templateCode.hashCode +
        whoCanPost.hashCode;

  factory ChannelDetail.fromJson(Map<String, dynamic> json) => _$ChannelDetailFromJson(json);

  Map<String, dynamic> toJson() => _$ChannelDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum ChannelDetailDefaultPriorityEnum {
@JsonValue(r'routine')
routine(r'routine'),
@JsonValue(r'important')
important(r'important');

const ChannelDetailDefaultPriorityEnum(this.value);

final String value;

@override
String toString() => value;
}



enum ChannelDetailReplyRuleEnum {
@JsonValue(r'allowed')
allowed(r'allowed'),
@JsonValue(r'announcement_only')
announcementOnly(r'announcement_only');

const ChannelDetailReplyRuleEnum(this.value);

final String value;

@override
String toString() => value;
}



enum ChannelDetailRoleEnum {
@JsonValue(r'member')
member(r'member'),
@JsonValue(r'publisher')
publisher(r'publisher');

const ChannelDetailRoleEnum(this.value);

final String value;

@override
String toString() => value;
}



enum ChannelDetailScopeTypeEnum {
@JsonValue(r'college')
college(r'college'),
@JsonValue(r'department')
department(r'department'),
@JsonValue(r'batch')
batch(r'batch'),
@JsonValue(r'course_offering')
courseOffering(r'course_offering'),
@JsonValue(r'hostel_block')
hostelBlock(r'hostel_block');

const ChannelDetailScopeTypeEnum(this.value);

final String value;

@override
String toString() => value;
}



enum ChannelDetailStatusEnum {
@JsonValue(r'active')
active(r'active'),
@JsonValue(r'archived')
archived(r'archived');

const ChannelDetailStatusEnum(this.value);

final String value;

@override
String toString() => value;
}



enum ChannelDetailTemplateCodeEnum {
@JsonValue(r'college')
college(r'college'),
@JsonValue(r'department')
department(r'department'),
@JsonValue(r'batch')
batch(r'batch'),
@JsonValue(r'course')
course(r'course'),
@JsonValue(r'hostel')
hostel(r'hostel');

const ChannelDetailTemplateCodeEnum(this.value);

final String value;

@override
String toString() => value;
}


