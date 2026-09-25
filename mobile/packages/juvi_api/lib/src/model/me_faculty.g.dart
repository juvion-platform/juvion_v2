// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_faculty.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeFaculty _$MeFacultyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeFaculty', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'department',
          'designation',
          'employeeCode',
          'isHod',
        ],
      );
      final val = MeFaculty(
        department: $checkedConvert('department', (v) => v as String?),
        designation: $checkedConvert('designation', (v) => v as String),
        employeeCode: $checkedConvert('employeeCode', (v) => v as String),
        isHod: $checkedConvert('isHod', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$MeFacultyToJson(MeFaculty instance) => <String, dynamic>{
  'department': instance.department,
  'designation': instance.designation,
  'employeeCode': instance.employeeCode,
  'isHod': instance.isHod,
};
