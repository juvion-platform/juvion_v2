// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_academics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StudentAcademics _$StudentAcademicsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StudentAcademics', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['attendance', 'dues']);
      final val = StudentAcademics(
        attendance: $checkedConvert(
          'attendance',
          (v) => StudentAcademicsAttendance.fromJson(v as Map<String, dynamic>),
        ),
        dues: $checkedConvert(
          'dues',
          (v) => StudentDues.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$StudentAcademicsToJson(StudentAcademics instance) =>
    <String, dynamic>{
      'attendance': instance.attendance.toJson(),
      'dues': instance.dues.toJson(),
    };
