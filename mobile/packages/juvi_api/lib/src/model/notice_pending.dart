//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_pending_groups_inner.dart';
import 'package:juvi_api/src/model/notice_pending_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_pending.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticePending {
  /// Returns a new [NoticePending] instance.
  NoticePending({

    required  this.groups,

    required  this.items,

    required  this.nextCursor,

    required  this.total,
  });

  @JsonKey(
    
    name: r'groups',
    required: true,
    includeIfNull: false,
  )


  final List<NoticePendingGroupsInner> groups;



  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<NoticePendingItemsInner> items;



  @JsonKey(
    
    name: r'nextCursor',
    required: true,
    includeIfNull: true,
  )


  final String? nextCursor;



  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final int total;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticePending &&
      other.groups == groups &&
      other.items == items &&
      other.nextCursor == nextCursor &&
      other.total == total;

    @override
    int get hashCode =>
        groups.hashCode +
        items.hashCode +
        (nextCursor == null ? 0 : nextCursor.hashCode) +
        total.hashCode;

  factory NoticePending.fromJson(Map<String, dynamic> json) => _$NoticePendingFromJson(json);

  Map<String, dynamic> toJson() => _$NoticePendingToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

