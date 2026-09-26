//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'tokens.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Tokens {
  /// Returns a new [Tokens] instance.
  Tokens({

    required  this.accessExpiresIn,

    required  this.accessToken,

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
    
    name: r'refreshToken',
    required: true,
    includeIfNull: false,
  )


  final String refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Tokens &&
      other.accessExpiresIn == accessExpiresIn &&
      other.accessToken == accessToken &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        accessExpiresIn.hashCode +
        accessToken.hashCode +
        refreshToken.hashCode;

  factory Tokens.fromJson(Map<String, dynamic> json) => _$TokensFromJson(json);

  Map<String, dynamic> toJson() => _$TokensToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

