//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_request_device.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInRequestDevice {
  /// Returns a new [SignInRequestDevice] instance.
  SignInRequestDevice({

    required  this.appVersion,

    required  this.id,

    required  this.name,

    required  this.osVersion,

    required  this.platform,
  });

  @JsonKey(
    
    name: r'appVersion',
    required: true,
    includeIfNull: false,
  )


  final String appVersion;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'osVersion',
    required: true,
    includeIfNull: false,
  )


  final String osVersion;



  @JsonKey(
    
    name: r'platform',
    required: true,
    includeIfNull: false,
  )


  final SignInRequestDevicePlatformEnum platform;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInRequestDevice &&
      other.appVersion == appVersion &&
      other.id == id &&
      other.name == name &&
      other.osVersion == osVersion &&
      other.platform == platform;

    @override
    int get hashCode =>
        appVersion.hashCode +
        id.hashCode +
        name.hashCode +
        osVersion.hashCode +
        platform.hashCode;

  factory SignInRequestDevice.fromJson(Map<String, dynamic> json) => _$SignInRequestDeviceFromJson(json);

  Map<String, dynamic> toJson() => _$SignInRequestDeviceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SignInRequestDevicePlatformEnum {
@JsonValue(r'android')
android(r'android'),
@JsonValue(r'ios')
ios(r'ios');

const SignInRequestDevicePlatformEnum(this.value);

final String value;

@override
String toString() => value;
}


