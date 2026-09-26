// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_patch.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SettingsPatch _$SettingsPatchFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SettingsPatch', json, ($checkedConvert) {
      final val = SettingsPatch(
        language: $checkedConvert(
          'language',
          (v) => $enumDecodeNullable(_$SettingsPatchLanguageEnumEnumMap, v),
        ),
        quietHours: $checkedConvert(
          'quietHours',
          (v) => v == null
              ? null
              : MeSettingsQuietHours.fromJson(v as Map<String, dynamic>),
        ),
        tiers: $checkedConvert(
          'tiers',
          (v) => v == null
              ? null
              : SettingsPatchTiers.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SettingsPatchToJson(SettingsPatch instance) =>
    <String, dynamic>{
      'language': ?_$SettingsPatchLanguageEnumEnumMap[instance.language],
      'quietHours': ?instance.quietHours?.toJson(),
      'tiers': ?instance.tiers?.toJson(),
    };

const _$SettingsPatchLanguageEnumEnumMap = {SettingsPatchLanguageEnum.en: 'en'};
