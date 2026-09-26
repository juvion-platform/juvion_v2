// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_envelope_error.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorEnvelopeError _$ErrorEnvelopeErrorFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ErrorEnvelopeError', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'message']);
      final val = ErrorEnvelopeError(
        code: $checkedConvert(
          'code',
          (v) => $enumDecode(_$ErrorEnvelopeErrorCodeEnumEnumMap, v),
        ),
        message: $checkedConvert('message', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ErrorEnvelopeErrorToJson(ErrorEnvelopeError instance) =>
    <String, dynamic>{
      'code': _$ErrorEnvelopeErrorCodeEnumEnumMap[instance.code]!,
      'message': instance.message,
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
};
