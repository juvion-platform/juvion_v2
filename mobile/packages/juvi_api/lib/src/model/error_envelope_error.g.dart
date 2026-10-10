// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_envelope_error.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorEnvelopeError _$ErrorEnvelopeErrorFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ErrorEnvelopeError', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'message']);
      final val = ErrorEnvelopeError(
        ack: $checkedConvert(
          'ack',
          (v) => v == null
              ? null
              : ErrorEnvelopeErrorAck.fromJson(v as Map<String, dynamic>),
        ),
        code: $checkedConvert(
          'code',
          (v) => $enumDecode(_$ErrorEnvelopeErrorCodeEnumEnumMap, v),
        ),
        message: $checkedConvert('message', (v) => v as String),
        reminders: $checkedConvert(
          'reminders',
          (v) => v == null
              ? null
              : ErrorEnvelopeErrorReminders.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ErrorEnvelopeErrorToJson(ErrorEnvelopeError instance) =>
    <String, dynamic>{
      'ack': ?instance.ack?.toJson(),
      'code': _$ErrorEnvelopeErrorCodeEnumEnumMap[instance.code]!,
      'message': instance.message,
      'reminders': ?instance.reminders?.toJson(),
    };

const _$ErrorEnvelopeErrorCodeEnumEnumMap = {
  ErrorEnvelopeErrorCodeEnum.VALIDATION_FAILED: 'VALIDATION_FAILED',
  ErrorEnvelopeErrorCodeEnum.INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ErrorEnvelopeErrorCodeEnum.TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ErrorEnvelopeErrorCodeEnum.SESSION_INVALIDATED: 'SESSION_INVALIDATED',
  ErrorEnvelopeErrorCodeEnum.ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  ErrorEnvelopeErrorCodeEnum.FORBIDDEN: 'FORBIDDEN',
  ErrorEnvelopeErrorCodeEnum.NOT_FOUND: 'NOT_FOUND',
  ErrorEnvelopeErrorCodeEnum.GONE: 'GONE',
  ErrorEnvelopeErrorCodeEnum.UPDATE_REQUIRED: 'UPDATE_REQUIRED',
  ErrorEnvelopeErrorCodeEnum.COOLDOWN: 'COOLDOWN',
  ErrorEnvelopeErrorCodeEnum.INSTITUTION_PAUSED: 'INSTITUTION_PAUSED',
  ErrorEnvelopeErrorCodeEnum.INTERNAL: 'INTERNAL',
  ErrorEnvelopeErrorCodeEnum.NOTICE_NOT_FOUND: 'NOTICE_NOT_FOUND',
  ErrorEnvelopeErrorCodeEnum.ALREADY_ACKNOWLEDGED: 'ALREADY_ACKNOWLEDGED',
  ErrorEnvelopeErrorCodeEnum.NOTICE_ARCHIVED: 'NOTICE_ARCHIVED',
  ErrorEnvelopeErrorCodeEnum.NOT_PUBLISHER: 'NOT_PUBLISHER',
  ErrorEnvelopeErrorCodeEnum.REMINDER_LIMIT: 'REMINDER_LIMIT',
  ErrorEnvelopeErrorCodeEnum.ACK_REQUIRED: 'ACK_REQUIRED',
  ErrorEnvelopeErrorCodeEnum.ACK_NOT_REQUIRED: 'ACK_NOT_REQUIRED',
  ErrorEnvelopeErrorCodeEnum.RECEIPT_INVALID: 'RECEIPT_INVALID',
  ErrorEnvelopeErrorCodeEnum.DELETION_NOT_CANCELLABLE:
      'DELETION_NOT_CANCELLABLE',
};
