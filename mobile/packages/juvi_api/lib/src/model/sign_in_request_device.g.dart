// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_request_device.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInRequestDevice _$SignInRequestDeviceFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInRequestDevice', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'appVersion',
          'id',
          'name',
          'osVersion',
          'platform',
        ],
      );
      final val = SignInRequestDevice(
        appVersion: $checkedConvert('appVersion', (v) => v as String),
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        osVersion: $checkedConvert('osVersion', (v) => v as String),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecode(_$SignInRequestDevicePlatformEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SignInRequestDeviceToJson(
  SignInRequestDevice instance,
) => <String, dynamic>{
  'appVersion': instance.appVersion,
  'id': instance.id,
  'name': instance.name,
  'osVersion': instance.osVersion,
  'platform': _$SignInRequestDevicePlatformEnumEnumMap[instance.platform]!,
};

const _$SignInRequestDevicePlatformEnumEnumMap = {
  SignInRequestDevicePlatformEnum.android: 'android',
  SignInRequestDevicePlatformEnum.ios: 'ios',
};
