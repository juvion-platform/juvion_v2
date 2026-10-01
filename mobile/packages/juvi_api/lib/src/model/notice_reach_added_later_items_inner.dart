//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach_added_later_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReachAddedLaterItemsInner {
  /// Returns a new [NoticeReachAddedLaterItemsInner] instance.
  NoticeReachAddedLaterItemsInner({

    required  this.at,

    required  this.group,

    required  this.identifier,

    required  this.name,

    required  this.state,
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



  @JsonKey(
    
    name: r'state',
    required: true,
    includeIfNull: false,
  )


  final NoticeReachAddedLaterItemsInnerStateEnum state;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReachAddedLaterItemsInner &&
      other.at == at &&
      other.group == group &&
      other.identifier == identifier &&
      other.name == name &&
      other.state == state;

    @override
    int get hashCode =>
        (at == null ? 0 : at.hashCode) +
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        name.hashCode +
        state.hashCode;

  factory NoticeReachAddedLaterItemsInner.fromJson(Map<String, dynamic> json) => _$NoticeReachAddedLaterItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachAddedLaterItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum NoticeReachAddedLaterItemsInnerStateEnum {
@JsonValue(r'acknowledged')
acknowledged(r'acknowledged'),
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'not_seen')
notSeen(r'not_seen'),
@JsonValue(r'not_on_juvi')
notOnJuvi(r'not_on_juvi');

const NoticeReachAddedLaterItemsInnerStateEnum(this.value);

final String value;

@override
String toString() => value;
}


