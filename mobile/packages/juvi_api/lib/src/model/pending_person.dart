//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'pending_person.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PendingPerson {
  /// Returns a new [PendingPerson] instance.
  PendingPerson({

    required  this.delivery,

    required  this.group,

    required  this.identifier,

    required  this.lastSeenInApp,

    required  this.name,

    required  this.state,
  });

  @JsonKey(
    
    name: r'delivery',
    required: true,
    includeIfNull: false,
  )


  final PendingPersonDeliveryEnum delivery;



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


  final PendingPersonStateEnum state;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PendingPerson &&
      other.delivery == delivery &&
      other.group == group &&
      other.identifier == identifier &&
      other.lastSeenInApp == lastSeenInApp &&
      other.name == name &&
      other.state == state;

    @override
    int get hashCode =>
        delivery.hashCode +
        group.hashCode +
        (identifier == null ? 0 : identifier.hashCode) +
        (lastSeenInApp == null ? 0 : lastSeenInApp.hashCode) +
        name.hashCode +
        state.hashCode;

  factory PendingPerson.fromJson(Map<String, dynamic> json) => _$PendingPersonFromJson(json);

  Map<String, dynamic> toJson() => _$PendingPersonToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum PendingPersonDeliveryEnum {
@JsonValue(r'not_delivered')
notDelivered(r'not_delivered'),
@JsonValue(r'delivered')
delivered(r'delivered'),
@JsonValue(r'opened')
opened(r'opened'),
@JsonValue(r'muted')
muted(r'muted'),
@JsonValue(r'tier_off')
tierOff(r'tier_off'),
@JsonValue(r'no_device')
noDevice(r'no_device'),
@JsonValue(r'scheduled')
scheduled(r'scheduled'),
@JsonValue(r'none')
none(r'none');

const PendingPersonDeliveryEnum(this.value);

final String value;

@override
String toString() => value;
}



enum PendingPersonStateEnum {
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'not_seen')
notSeen(r'not_seen'),
@JsonValue(r'not_on_juvi')
notOnJuvi(r'not_on_juvi');

const PendingPersonStateEnum(this.value);

final String value;

@override
String toString() => value;
}


