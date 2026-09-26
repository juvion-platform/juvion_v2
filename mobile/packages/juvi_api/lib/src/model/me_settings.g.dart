// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_settings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSettings _$MeSettingsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeSettings', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['language', 'quietHours', 'tiers']);
      final val = MeSettings(
        language: $checkedConvert(
          'language',
          (v) => $enumDecode(_$MeSettingsLanguageEnumEnumMap, v),
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

Map<String, dynamic> _$MeSettingsToJson(MeSettings instance) =>
    <String, dynamic>{
      'language': _$MeSettingsLanguageEnumEnumMap[instance.language]!,
      'quietHours': instance.quietHours.toJson(),
      'tiers': instance.tiers.toJson(),
    };

const _$MeSettingsLanguageEnumEnumMap = {MeSettingsLanguageEnum.en: 'en'};
