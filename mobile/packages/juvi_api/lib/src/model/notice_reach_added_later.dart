//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_reach_added_later_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_added_later.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachAddedLater {
  /// Returns a new [NoticeReachAddedLater] instance.
  NoticeReachAddedLater({

    required  this.acknowledged,

    required  this.items,

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
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeReachAddedLaterItemsInner> items;



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
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachAddedLater &&
      other.acknowledged == acknowledged &&
      other.items == items &&
      other.seen == seen &&
      other.total == total;

    @override
    int get hashCode =>
        acknowledged.hashCode +
        items.hashCode +
        seen.hashCode +
        total.hashCode;

  factory NoticeReachAddedLater.fromJson(Map<String, dynamic> json) => _$NoticeReachAddedLaterFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachAddedLaterToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

