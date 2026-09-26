// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices_items_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DevicesItemsInner _$DevicesItemsInnerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DevicesItemsInner', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'appVersion',
          'deviceName',
          'isCurrent',
          'lastActiveAt',
          'platform',
          'sessionId',
        ],
      );
      final val = DevicesItemsInner(
        appVersion: $checkedConvert('appVersion', (v) => v as String),
        deviceName: $checkedConvert('deviceName', (v) => v as String),
        isCurrent: $checkedConvert('isCurrent', (v) => v as bool),
        lastActiveAt: $checkedConvert('lastActiveAt', (v) => v as String),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecode(_$DevicesItemsInnerPlatformEnumEnumMap, v),
        ),
        sessionId: $checkedConvert('sessionId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DevicesItemsInnerToJson(DevicesItemsInner instance) =>
    <String, dynamic>{
      'appVersion': instance.appVersion,
      'deviceName': instance.deviceName,
      'isCurrent': instance.isCurrent,
      'lastActiveAt': instance.lastActiveAt,
      'platform': _$DevicesItemsInnerPlatformEnumEnumMap[instance.platform]!,
      'sessionId': instance.sessionId,
    };

const _$DevicesItemsInnerPlatformEnumEnumMap = {
  DevicesItemsInnerPlatformEnum.android: 'android',
  DevicesItemsInnerPlatformEnum.ios: 'ios',
};
