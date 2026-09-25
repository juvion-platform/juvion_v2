//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/me_account.dart';
import 'package:json_annotation/json_annotation.dart';

part 'sign_in_response.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SignInResponse {
  /// Returns a new [SignInResponse] instance.
  SignInResponse({

    required  this.accessExpiresIn,

    required  this.accessToken,

    required  this.account,

    required  this.refreshToken,
  });

  @JsonKey(
    
    name: r'accessExpiresIn',
    required: true,
    includeIfNull: false,
  )


  final int accessExpiresIn;



  @JsonKey(
    
    name: r'accessToken',
    required: true,
    includeIfNull: false,
  )


  final String accessToken;



  @JsonKey(
    
    name: r'account',
    required: true,
    includeIfNull: false,
  )


  final MeAccount account;



  @JsonKey(
    
    name: r'refreshToken',
    required: true,
    includeIfNull: false,
  )


  final String refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SignInResponse &&
      other.accessExpiresIn == accessExpiresIn &&
      other.accessToken == accessToken &&
      other.account == account &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        accessExpiresIn.hashCode +
        accessToken.hashCode +
        account.hashCode +
        refreshToken.hashCode;

  factory SignInResponse.fromJson(Map<String, dynamic> json) => _$SignInResponseFromJson(json);

  Map<String, dynamic> toJson() => _$SignInResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

