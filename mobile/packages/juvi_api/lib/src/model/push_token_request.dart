//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'push_token_request.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PushTokenRequest {
  /// Returns a new [PushTokenRequest] instance.
  PushTokenRequest({

    required  this.platform,

    required  this.token,
  });

  @JsonKey(
    
    name: r'platform',
    required: true,
    includeIfNull: false,
  )


  final PushTokenRequestPlatformEnum platform;



  @JsonKey(
    
    name: r'token',
    required: true,
    includeIfNull: false,
  )


  final String token;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PushTokenRequest &&
      other.platform == platform &&
      other.token == token;

    @override
    int get hashCode =>
        platform.hashCode +
        token.hashCode;

  factory PushTokenRequest.fromJson(Map<String, dynamic> json) => _$PushTokenRequestFromJson(json);

  Map<String, dynamic> toJson() => _$PushTokenRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum PushTokenRequestPlatformEnum {
@JsonValue(r'android')
android(r'android');

const PushTokenRequestPlatformEnum(this.value);

final String value;

@override
String toString() => value;
}


