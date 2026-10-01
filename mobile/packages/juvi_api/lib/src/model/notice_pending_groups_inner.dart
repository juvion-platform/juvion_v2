//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_pending_groups_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticePendingGroupsInner {
  /// Returns a new [NoticePendingGroupsInner] instance.
  NoticePendingGroupsInner({

    required  this.count,

    required  this.label,
  });

  @JsonKey(
    
    name: r'count',
    required: true,
    includeIfNull: false,
  )


  final int count;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticePendingGroupsInner &&
      other.count == count &&
      other.label == label;

    @override
    int get hashCode =>
        count.hashCode +
        label.hashCode;

  factory NoticePendingGroupsInner.fromJson(Map<String, dynamic> json) => _$NoticePendingGroupsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticePendingGroupsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

