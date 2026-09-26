// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'institution_lookup.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InstitutionLookup _$InstitutionLookupFromJson(Map<String, dynamic> json) =>
    $checkedCreate('InstitutionLookup', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accentColor',
          'collegeId',
          'logoUrl',
          'minAppVersion',
          'name',
          'paused',
          'pausedMessage',
        ],
      );
      final val = InstitutionLookup(
        accentColor: $checkedConvert('accentColor', (v) => v as String?),
        collegeId: $checkedConvert('collegeId', (v) => v as String),
        logoUrl: $checkedConvert('logoUrl', (v) => v as String?),
        minAppVersion: $checkedConvert(
          'minAppVersion',
          (v) => ConfigMinAppVersion.fromJson(v as Map<String, dynamic>),
        ),
        name: $checkedConvert('name', (v) => v as String),
        paused: $checkedConvert('paused', (v) => v as bool),
        pausedMessage: $checkedConvert('pausedMessage', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$InstitutionLookupToJson(InstitutionLookup instance) =>
    <String, dynamic>{
      'accentColor': instance.accentColor,
      'collegeId': instance.collegeId,
      'logoUrl': instance.logoUrl,
      'minAppVersion': instance.minAppVersion.toJson(),
      'name': instance.name,
      'paused': instance.paused,
      'pausedMessage': instance.pausedMessage,
    };
