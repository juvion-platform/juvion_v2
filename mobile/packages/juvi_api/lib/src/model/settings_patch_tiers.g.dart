// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_patch_tiers.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SettingsPatchTiers _$SettingsPatchTiersFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SettingsPatchTiers', json, ($checkedConvert) {
      final val = SettingsPatchTiers(
        important: $checkedConvert('important', (v) => v as bool?),
        routine: $checkedConvert('routine', (v) => v as bool?),
      );
      return val;
    });

Map<String, dynamic> _$SettingsPatchTiersToJson(SettingsPatchTiers instance) =>
    <String, dynamic>{
      'important': ?instance.important,
      'routine': ?instance.routine,
    };
