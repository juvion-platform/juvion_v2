// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tokens.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Tokens _$TokensFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Tokens', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['accessExpiresIn', 'accessToken', 'refreshToken'],
      );
      final val = Tokens(
        accessExpiresIn: $checkedConvert(
          'accessExpiresIn',
          (v) => (v as num).toInt(),
        ),
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$TokensToJson(Tokens instance) => <String, dynamic>{
  'accessExpiresIn': instance.accessExpiresIn,
  'accessToken': instance.accessToken,
  'refreshToken': instance.refreshToken,
};
