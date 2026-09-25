// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_person.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MePerson _$MePersonFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MePerson', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['firstName', 'name', 'photoUrl']);
      final val = MePerson(
        firstName: $checkedConvert('firstName', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        photoUrl: $checkedConvert('photoUrl', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$MePersonToJson(MePerson instance) => <String, dynamic>{
  'firstName': instance.firstName,
  'name': instance.name,
  'photoUrl': instance.photoUrl,
};
