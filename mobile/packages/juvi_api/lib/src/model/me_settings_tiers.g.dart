// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_settings_tiers.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSettingsTiers _$MeSettingsTiersFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeSettingsTiers', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['important', 'routine']);
      final val = MeSettingsTiers(
        important: $checkedConvert('important', (v) => v as bool),
        routine: $checkedConvert('routine', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$MeSettingsTiersToJson(MeSettingsTiers instance) =>
    <String, dynamic>{
      'important': instance.important,
      'routine': instance.routine,
    };
