//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'error_envelope_error.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ErrorEnvelopeError {
  /// Returns a new [ErrorEnvelopeError] instance.
  ErrorEnvelopeError({

    required  this.code,

    required  this.message,
  });

  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorCodeEnum code;



  @JsonKey(
    
    name: r'message',
    required: true,
    includeIfNull: false,
  )


  final String message;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ErrorEnvelopeError &&
      other.code == code &&
      other.message == message;

    @override
    int get hashCode =>
        code.hashCode +
        message.hashCode;

  factory ErrorEnvelopeError.fromJson(Map<String, dynamic> json) => _$ErrorEnvelopeErrorFromJson(json);

  Map<String, dynamic> toJson() => _$ErrorEnvelopeErrorToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum ErrorEnvelopeErrorCodeEnum {
@JsonValue(r'VALIDATION_FAILED')
VALIDATION_FAILED(r'VALIDATION_FAILED'),
@JsonValue(r'INVALID_CREDENTIALS')
INVALID_CREDENTIALS(r'INVALID_CREDENTIALS'),
@JsonValue(r'TOKEN_EXPIRED')
TOKEN_EXPIRED(r'TOKEN_EXPIRED'),
@JsonValue(r'SESSION_INVALIDATED')
SESSION_INVALIDATED(r'SESSION_INVALIDATED'),
@JsonValue(r'ACCOUNT_DEACTIVATED')
ACCOUNT_DEACTIVATED(r'ACCOUNT_DEACTIVATED'),
@JsonValue(r'FORBIDDEN')
FORBIDDEN(r'FORBIDDEN'),
@JsonValue(r'NOT_FOUND')
NOT_FOUND(r'NOT_FOUND'),
@JsonValue(r'GONE')
GONE(r'GONE'),
@JsonValue(r'UPDATE_REQUIRED')
UPDATE_REQUIRED(r'UPDATE_REQUIRED'),
@JsonValue(r'COOLDOWN')
COOLDOWN(r'COOLDOWN'),
@JsonValue(r'INSTITUTION_PAUSED')
INSTITUTION_PAUSED(r'INSTITUTION_PAUSED'),
@JsonValue(r'INTERNAL')
INTERNAL(r'INTERNAL');

const ErrorEnvelopeErrorCodeEnum(this.value);

final String value;

@override
String toString() => value;
}


