// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_student.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeStudent _$MeStudentFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeStudent', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'batch',
          'branch',
          'department',
          'hostel',
          'isLateralEntry',
          'programme',
          'rollNumber',
          'section',
        ],
      );
      final val = MeStudent(
        batch: $checkedConvert('batch', (v) => v as String?),
        branch: $checkedConvert('branch', (v) => v as String?),
        department: $checkedConvert('department', (v) => v as String?),
        hostel: $checkedConvert('hostel', (v) => v as String?),
        isLateralEntry: $checkedConvert('isLateralEntry', (v) => v as bool),
        programme: $checkedConvert('programme', (v) => v as String?),
        rollNumber: $checkedConvert('rollNumber', (v) => v as String?),
        section: $checkedConvert('section', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$MeStudentToJson(MeStudent instance) => <String, dynamic>{
  'batch': instance.batch,
  'branch': instance.branch,
  'department': instance.department,
  'hostel': instance.hostel,
  'isLateralEntry': instance.isLateralEntry,
  'programme': instance.programme,
  'rollNumber': instance.rollNumber,
  'section': instance.section,
};
