//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_list_items_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_list.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeList {
  /// Returns a new [NoticeList] instance.
  NoticeList({

    required  this.items,

    required  this.nextCursor,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeListItemsInner> items;



  @JsonKey(
    
    name: r'nextCursor',
    required: true,
    includeIfNull: true,
  )


  final String? nextCursor;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeList &&
      other.items == items &&
      other.nextCursor == nextCursor;

    @override
    int get hashCode =>
        items.hashCode +
        (nextCursor == null ? 0 : nextCursor.hashCode);

  factory NoticeList.fromJson(Map<String, dynamic> json) => _$NoticeListFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeListToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

