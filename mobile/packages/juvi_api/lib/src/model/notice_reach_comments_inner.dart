//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_comments_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachCommentsInner {
  /// Returns a new [NoticeReachCommentsInner] instance.
  NoticeReachCommentsInner({

    required  this.at,

    required  this.comment,

    required  this.group,

    required  this.identifier,

    required  this.late_,

    required  this.name,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: true,
  )


  final String? at;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: false,
  )


  final String comment;



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
    
    name: r'late',
    required: true,
    includeIfNull: false,
  )


  final bool late_;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachCommentsInner &&
      other.at == at &&
      other.comment == comment &&
      other.group == group &&
      other.identifier == identifier &&
      other.late_ == late_ &&
      other.name == name;

    @override
    int get hashCode =>
        (at == null ? 0 : at.hashCode) +
        comment.hashCode +
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        late_.hashCode +
        name.hashCode;

  factory NoticeReachCommentsInner.fromJson(Map<String, dynamic> json) => _$NoticeReachCommentsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachCommentsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

