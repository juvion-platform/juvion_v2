// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_feature_flags.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConfigFeatureFlags _$ConfigFeatureFlagsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ConfigFeatureFlags', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['languageRoadmap']);
      final val = ConfigFeatureFlags(
        languageRoadmap: $checkedConvert('languageRoadmap', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$ConfigFeatureFlagsToJson(ConfigFeatureFlags instance) =>
    <String, dynamic>{'languageRoadmap': instance.languageRoadmap};
