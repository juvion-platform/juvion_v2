//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/sign_in_request_device.dart';
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_request.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInRequest {
  /// Returns a new [SignInRequest] instance.
  SignInRequest({

    required  this.device,

    required  this.juviId,

    required  this.password,
  });

  @JsonKey(
    
    name: r'device',
    required: true,
    includeIfNull: false,
  )


  final SignInRequestDevice device;



  @JsonKey(
    
    name: r'juviId',
    required: true,
    includeIfNull: false,
  )


  final String juviId;



  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInRequest &&
      other.device == device &&
      other.juviId == juviId &&
      other.password == password;

    @override
    int get hashCode =>
        device.hashCode +
        juviId.hashCode +
        password.hashCode;

  factory SignInRequest.fromJson(Map<String, dynamic> json) => _$SignInRequestFromJson(json);

  Map<String, dynamic> toJson() => _$SignInRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

