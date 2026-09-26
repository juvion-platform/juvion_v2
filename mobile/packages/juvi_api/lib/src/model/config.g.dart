// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Config _$ConfigFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Config', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accentColor',
          'code',
          'featureFlags',
          'logoUrl',
          'minAppVersion',
          'name',
          'onboardingSteps',
          'quietHoursDefault',
          'supportContact',
          'timezone',
        ],
      );
      final val = Config(
        accentColor: $checkedConvert('accentColor', (v) => v as String?),
        code: $checkedConvert('code', (v) => v as String),
        featureFlags: $checkedConvert(
          'featureFlags',
          (v) => ConfigFeatureFlags.fromJson(v as Map<String, dynamic>),
        ),
        logoUrl: $checkedConvert('logoUrl', (v) => v as String?),
        minAppVersion: $checkedConvert(
          'minAppVersion',
          (v) => ConfigMinAppVersion.fromJson(v as Map<String, dynamic>),
        ),
        name: $checkedConvert('name', (v) => v as String),
        onboardingSteps: $checkedConvert(
          'onboardingSteps',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        quietHoursDefault: $checkedConvert(
          'quietHoursDefault',
          (v) => ConfigQuietHoursDefault.fromJson(v as Map<String, dynamic>),
        ),
        supportContact: $checkedConvert(
          'supportContact',
          (v) => ConfigSupportContact.fromJson(v as Map<String, dynamic>),
        ),
        timezone: $checkedConvert('timezone', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ConfigToJson(Config instance) => <String, dynamic>{
  'accentColor': instance.accentColor,
  'code': instance.code,
  'featureFlags': instance.featureFlags.toJson(),
  'logoUrl': instance.logoUrl,
  'minAppVersion': instance.minAppVersion.toJson(),
  'name': instance.name,
  'onboardingSteps': instance.onboardingSteps,
  'quietHoursDefault': instance.quietHoursDefault.toJson(),
  'supportContact': instance.supportContact.toJson(),
  'timezone': instance.timezone,
};
