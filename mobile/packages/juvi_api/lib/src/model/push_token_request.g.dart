// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'push_token_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PushTokenRequest _$PushTokenRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PushTokenRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['platform', 'token']);
      final val = PushTokenRequest(
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecode(_$PushTokenRequestPlatformEnumEnumMap, v),
        ),
        token: $checkedConvert('token', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PushTokenRequestToJson(PushTokenRequest instance) =>
    <String, dynamic>{
      'platform': _$PushTokenRequestPlatformEnumEnumMap[instance.platform]!,
      'token': instance.token,
    };

const _$PushTokenRequestPlatformEnumEnumMap = {
  PushTokenRequestPlatformEnum.android: 'android',
};
