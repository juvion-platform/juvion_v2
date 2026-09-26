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

    required  this.collegeId,

    required  this.device,

    required  this.identifier,

    required  this.password,
  });

  @JsonKey(
    
    name: r'collegeId',
    required: true,
    includeIfNull: false,
  )


  final String collegeId;



  @JsonKey(
    
    name: r'device',
    required: true,
    includeIfNull: false,
  )


  final SignInRequestDevice device;



  @JsonKey(
    
    name: r'identifier',
    required: true,
    includeIfNull: false,
  )


  final String identifier;



  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInRequest &&
      other.collegeId == collegeId &&
      other.device == device &&
      other.identifier == identifier &&
      other.password == password;

    @override
    int get hashCode =>
        collegeId.hashCode +
        device.hashCode +
        identifier.hashCode +
        password.hashCode;

  factory SignInRequest.fromJson(Map<String, dynamic> json) => _$SignInRequestFromJson(json);

  Map<String, dynamic> toJson() => _$SignInRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

