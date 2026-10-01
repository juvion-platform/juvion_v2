//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_late_acks_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachLateAcksInner {
  /// Returns a new [NoticeReachLateAcksInner] instance.
  NoticeReachLateAcksInner({

    required  this.at,

    required  this.group,

    required  this.identifier,

    required  this.name,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: true,
  )


  final String? at;



  @JsonKey(
    
    name: r'group',
    required: true,
    includeIfNull: false,
  )


  final String group;



  @JsonKey(
    
    name: r'identifier',
    required: true,
    includeIfNull: true,
  )


  final String? identifier;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachLateAcksInner &&
      other.at == at &&
      other.group == group &&
      other.identifier == identifier &&
      other.name == name;

    @override
    int get hashCode =>
        (at == null ? 0 : at.hashCode) +
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        name.hashCode;

  factory NoticeReachLateAcksInner.fromJson(Map<String, dynamic> json) => _$NoticeReachLateAcksInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachLateAcksInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

