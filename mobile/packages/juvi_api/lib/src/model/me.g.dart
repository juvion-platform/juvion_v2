// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Me _$MeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Me', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'account',
          'asOf',
          'faculty',
          'institution',
          'person',
          'settings',
          'student',
        ],
      );
      final val = Me(
        account: $checkedConvert(
          'account',
          (v) => MeAccount.fromJson(v as Map<String, dynamic>),
        ),
        asOf: $checkedConvert('asOf', (v) => v as String),
        faculty: $checkedConvert(
          'faculty',
          (v) => MeFaculty.fromJson(v as Map<String, dynamic>),
        ),
        institution: $checkedConvert(
          'institution',
          (v) => MeInstitution.fromJson(v as Map<String, dynamic>),
        ),
        person: $checkedConvert(
          'person',
          (v) => MePerson.fromJson(v as Map<String, dynamic>),
        ),
        settings: $checkedConvert(
          'settings',
          (v) => MeSettings.fromJson(v as Map<String, dynamic>),
        ),
        student: $checkedConvert(
          'student',
          (v) => MeStudent.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeToJson(Me instance) => <String, dynamic>{
  'account': instance.account.toJson(),
  'asOf': instance.asOf,
  'faculty': instance.faculty.toJson(),
  'institution': instance.institution.toJson(),
  'person': instance.person.toJson(),
  'settings': instance.settings.toJson(),
  'student': instance.student.toJson(),
};
