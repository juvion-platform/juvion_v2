//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'devices_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DevicesItemsInner {
  /// Returns a new [DevicesItemsInner] instance.
  DevicesItemsInner({

    required  this.appVersion,

    required  this.deviceName,

    required  this.isCurrent,

    required  this.lastActiveAt,

    required  this.platform,

    required  this.sessionId,
  });

  @JsonKey(
    
    name: r'appVersion',
    required: true,
    includeIfNull: false,
  )


  final String appVersion;



  @JsonKey(
    
    name: r'deviceName',
    required: true,
    includeIfNull: false,
  )


  final String deviceName;



  @JsonKey(
    
    name: r'isCurrent',
    required: true,
    includeIfNull: false,
  )


  final bool isCurrent;



  @JsonKey(
    
    name: r'lastActiveAt',
    required: true,
    includeIfNull: false,
  )


  final String lastActiveAt;



  @JsonKey(
    
    name: r'platform',
    required: true,
    includeIfNull: false,
  )


  final DevicesItemsInnerPlatformEnum platform;



  @JsonKey(
    
    name: r'sessionId',
    required: true,
    includeIfNull: false,
  )


  final String sessionId;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DevicesItemsInner &&
      other.appVersion == appVersion &&
      other.deviceName == deviceName &&
      other.isCurrent == isCurrent &&
      other.lastActiveAt == lastActiveAt &&
      other.platform == platform &&
      other.sessionId == sessionId;

    @override
    int get hashCode =>
        appVersion.hashCode +
        deviceName.hashCode +
        isCurrent.hashCode +
        lastActiveAt.hashCode +
        platform.hashCode +
        sessionId.hashCode;

  factory DevicesItemsInner.fromJson(Map<String, dynamic> json) => _$DevicesItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$DevicesItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum DevicesItemsInnerPlatformEnum {
@JsonValue(r'android')
android(r'android'),
@JsonValue(r'ios')
ios(r'ios');

const DevicesItemsInnerPlatformEnum(this.value);

final String value;

@override
String toString() => value;
}


