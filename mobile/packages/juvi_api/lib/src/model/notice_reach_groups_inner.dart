//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_groups_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachGroupsInner {
  /// Returns a new [NoticeReachGroupsInner] instance.
  NoticeReachGroupsInner({

    required  this.acknowledged,

    required  this.label,

    required  this.notOnJuvi,

    required  this.notSeen,

    required  this.seen,

    required  this.total,
  });

  @JsonKey(
    
    name: r'acknowledged',
    required: true,
    includeIfNull: false,
  )


  final int acknowledged;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'notOnJuvi',
    required: true,
    includeIfNull: false,
  )


  final int notOnJuvi;



  @JsonKey(
    
    name: r'notSeen',
    required: true,
    includeIfNull: false,
  )


  final int notSeen;



  @JsonKey(
    
    name: r'seen',
    required: true,
    includeIfNull: false,
  )


  final int seen;



  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final int total;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachGroupsInner &&
      other.acknowledged == acknowledged &&
      other.label == label &&
      other.notOnJuvi == notOnJuvi &&
      other.notSeen == notSeen &&
      other.seen == seen &&
      other.total == total;

    @override
    int get hashCode =>
        acknowledged.hashCode +
        label.hashCode +
        notOnJuvi.hashCode +
        notSeen.hashCode +
        seen.hashCode +
        total.hashCode;

  factory NoticeReachGroupsInner.fromJson(Map<String, dynamic> json) => _$NoticeReachGroupsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachGroupsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

