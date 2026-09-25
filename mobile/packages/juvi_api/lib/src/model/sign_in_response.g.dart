// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInResponse _$SignInResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInResponse', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accessExpiresIn',
          'accessToken',
          'account',
          'refreshToken',
        ],
      );
      final val = SignInResponse(
        accessExpiresIn: $checkedConvert(
          'accessExpiresIn',
          (v) => (v as num).toInt(),
        ),
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        account: $checkedConvert(
          'account',
          (v) => MeAccount.fromJson(v as Map<String, dynamic>),
        ),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SignInResponseToJson(SignInResponse instance) =>
    <String, dynamic>{
      'accessExpiresIn': instance.accessExpiresIn,
      'accessToken': instance.accessToken,
      'account': instance.account.toJson(),
      'refreshToken': instance.refreshToken,
    };
