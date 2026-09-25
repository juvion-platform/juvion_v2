// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_institution.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeInstitution _$MeInstitutionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeInstitution', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accentColor',
          'code',
          'logoUrl',
          'name',
          'supportContact',
          'timezone',
        ],
      );
      final val = MeInstitution(
        accentColor: $checkedConvert('accentColor', (v) => v as String?),
        code: $checkedConvert('code', (v) => v as String),
        logoUrl: $checkedConvert('logoUrl', (v) => v as String?),
        name: $checkedConvert('name', (v) => v as String),
        supportContact: $checkedConvert(
          'supportContact',
          (v) => ConfigSupportContact.fromJson(v as Map<String, dynamic>),
        ),
        timezone: $checkedConvert('timezone', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$MeInstitutionToJson(MeInstitution instance) =>
    <String, dynamic>{
      'accentColor': instance.accentColor,
      'code': instance.code,
      'logoUrl': instance.logoUrl,
      'name': instance.name,
      'supportContact': instance.supportContact.toJson(),
      'timezone': instance.timezone,
    };
