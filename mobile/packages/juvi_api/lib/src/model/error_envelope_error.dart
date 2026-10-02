//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/error_envelope_error_ack.dart';
import 'package:juvi_api/src/model/error_envelope_error_reminders.dart';
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

     this.ack,

    required  this.code,

    required  this.message,

     this.reminders,
  });

  @JsonKey(
    
    name: r'ack',
    required: false,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorAck? ack;



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



  @JsonKey(
    
    name: r'reminders',
    required: false,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorReminders? reminders;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ErrorEnvelopeError &&
      other.ack == ack &&
      other.code == code &&
      other.message == message &&
      other.reminders == reminders;

    @override
    int get hashCode =>
        ack.hashCode +
        code.hashCode +
        message.hashCode +
        reminders.hashCode;

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
INTERNAL(r'INTERNAL'),
@JsonValue(r'NOTICE_NOT_FOUND')
NOTICE_NOT_FOUND(r'NOTICE_NOT_FOUND'),
@JsonValue(r'ALREADY_ACKNOWLEDGED')
ALREADY_ACKNOWLEDGED(r'ALREADY_ACKNOWLEDGED'),
@JsonValue(r'NOTICE_ARCHIVED')
NOTICE_ARCHIVED(r'NOTICE_ARCHIVED'),
@JsonValue(r'NOT_PUBLISHER')
NOT_PUBLISHER(r'NOT_PUBLISHER'),
@JsonValue(r'REMINDER_LIMIT')
REMINDER_LIMIT(r'REMINDER_LIMIT'),
@JsonValue(r'ACK_REQUIRED')
ACK_REQUIRED(r'ACK_REQUIRED'),
@JsonValue(r'ACK_NOT_REQUIRED')
ACK_NOT_REQUIRED(r'ACK_NOT_REQUIRED'),
@JsonValue(r'RECEIPT_INVALID')
RECEIPT_INVALID(r'RECEIPT_INVALID');

const ErrorEnvelopeErrorCodeEnum(this.value);

final String value;

@override
String toString() => value;
}


