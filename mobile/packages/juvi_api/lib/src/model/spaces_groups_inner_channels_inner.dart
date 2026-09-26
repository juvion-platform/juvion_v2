//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'spaces_groups_inner_channels_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SpacesGroupsInnerChannelsInner {
  /// Returns a new [SpacesGroupsInnerChannelsInner] instance.
  SpacesGroupsInnerChannelsInner({

    required  this.about,

    required  this.archived,

    required  this.id,

    required  this.memberCount,

    required  this.muted,

    required  this.name,

    required  this.nextClassAt,

    required  this.nextClassLabel,

    required  this.role,

    required  this.scopeType,

    required  this.templateCode,
  });

  @JsonKey(
    
    name: r'about',
    required: true,
    includeIfNull: false,
  )


  final String about;



  @JsonKey(
    
    name: r'archived',
    required: true,
    includeIfNull: false,
  )


  final bool archived;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



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
    
    name: r'nextClassAt',
    required: true,
    includeIfNull: true,
  )


  final String? nextClassAt;



  @JsonKey(
    
    name: r'nextClassLabel',
    required: true,
    includeIfNull: true,
  )


  final String? nextClassLabel;



  @JsonKey(
    
    name: r'role',
    required: true,
    includeIfNull: false,
  )


  final SpacesGroupsInnerChannelsInnerRoleEnum role;



  @JsonKey(
    
    name: r'scopeType',
    required: true,
    includeIfNull: false,
  )


  final SpacesGroupsInnerChannelsInnerScopeTypeEnum scopeType;



  @JsonKey(
    
    name: r'templateCode',
    required: true,
    includeIfNull: false,
  )


  final SpacesGroupsInnerChannelsInnerTemplateCodeEnum templateCode;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SpacesGroupsInnerChannelsInner &&
      other.about == about &&
      other.archived == archived &&
      other.id == id &&
      other.memberCount == memberCount &&
      other.muted == muted &&
      other.name == name &&
      other.nextClassAt == nextClassAt &&
      other.nextClassLabel == nextClassLabel &&
      other.role == role &&
      other.scopeType == scopeType &&
      other.templateCode == templateCode;

    @override
    int get hashCode =>
        about.hashCode +
        archived.hashCode +
        id.hashCode +
        memberCount.hashCode +
        muted.hashCode +
        name.hashCode +
        (nextClassAt == null ? 0 : nextClassAt.hashCode) +
        (nextClassLabel == null ? 0 : nextClassLabel.hashCode) +
        role.hashCode +
        scopeType.hashCode +
        templateCode.hashCode;

  factory SpacesGroupsInnerChannelsInner.fromJson(Map<String, dynamic> json) => _$SpacesGroupsInnerChannelsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$SpacesGroupsInnerChannelsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SpacesGroupsInnerChannelsInnerRoleEnum {
@JsonValue(r'member')
member(r'member'),
@JsonValue(r'publisher')
publisher(r'publisher');

const SpacesGroupsInnerChannelsInnerRoleEnum(this.value);

final String value;

@override
String toString() => value;
}



enum SpacesGroupsInnerChannelsInnerScopeTypeEnum {
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

const SpacesGroupsInnerChannelsInnerScopeTypeEnum(this.value);

final String value;

@override
String toString() => value;
}



enum SpacesGroupsInnerChannelsInnerTemplateCodeEnum {
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

const SpacesGroupsInnerChannelsInnerTemplateCodeEnum(this.value);

final String value;

@override
String toString() => value;
}


