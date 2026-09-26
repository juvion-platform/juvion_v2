// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Settings _$SettingsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Settings', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['language', 'quietHours', 'tiers']);
      final val = Settings(
        language: $checkedConvert(
          'language',
          (v) => $enumDecode(_$SettingsLanguageEnumEnumMap, v),
        ),
        quietHours: $checkedConvert(
          'quietHours',
          (v) => MeSettingsQuietHours.fromJson(v as Map<String, dynamic>),
        ),
        tiers: $checkedConvert(
          'tiers',
          (v) => MeSettingsTiers.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SettingsToJson(Settings instance) => <String, dynamic>{
  'language': _$SettingsLanguageEnumEnumMap[instance.language]!,
  'quietHours': instance.quietHours.toJson(),
  'tiers': instance.tiers.toJson(),
};

const _$SettingsLanguageEnumEnumMap = {SettingsLanguageEnum.en: 'en'};
