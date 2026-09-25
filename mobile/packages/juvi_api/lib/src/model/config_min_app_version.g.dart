// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_min_app_version.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConfigMinAppVersion _$ConfigMinAppVersionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ConfigMinAppVersion', json, ($checkedConvert) {
      final val = ConfigMinAppVersion(
        android: $checkedConvert('android', (v) => v as String?),
        ios: $checkedConvert('ios', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$ConfigMinAppVersionToJson(
  ConfigMinAppVersion instance,
) => <String, dynamic>{'android': ?instance.android, 'ios': ?instance.ios};
