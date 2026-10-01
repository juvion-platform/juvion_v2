//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_pending_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticePendingItemsInner {
  /// Returns a new [NoticePendingItemsInner] instance.
  NoticePendingItemsInner({

    required  this.group,

    required  this.identifier,

    required  this.lastSeenInApp,

    required  this.name,

    required  this.state,
  });

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
    
    name: r'lastSeenInApp',
    required: true,
    includeIfNull: true,
  )


  final String? lastSeenInApp;



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


  final NoticePendingItemsInnerStateEnum state;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticePendingItemsInner &&
      other.group == group &&
      other.identifier == identifier &&
      other.lastSeenInApp == lastSeenInApp &&
      other.name == name &&
      other.state == state;

    @override
    int get hashCode =>
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        (lastSeenInApp == null ? 0 : lastSeenInApp.hashCode) +
        name.hashCode +
        state.hashCode;

  factory NoticePendingItemsInner.fromJson(Map<String, dynamic> json) => _$NoticePendingItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticePendingItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum NoticePendingItemsInnerStateEnum {
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'not_seen')
notSeen(r'not_seen'),
@JsonValue(r'not_on_juvi')
notOnJuvi(r'not_on_juvi');

const NoticePendingItemsInnerStateEnum(this.value);

final String value;

@override
String toString() => value;
}


