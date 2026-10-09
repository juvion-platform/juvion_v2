// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_academics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeAcademics _$MeAcademicsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MeAcademics', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['attendance', 'dues', 'coursesTaught'],
      );
      final val = MeAcademics(
        attendance: $checkedConvert(
          'attendance',
          (v) => StudentAcademicsAttendance.fromJson(v as Map<String, dynamic>),
        ),
        dues: $checkedConvert(
          'dues',
          (v) => StudentDues.fromJson(v as Map<String, dynamic>),
        ),
        coursesTaught: $checkedConvert(
          'coursesTaught',
          (v) => (v as List<dynamic>)
              .map((e) => CoursesTaughtItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MeAcademicsToJson(MeAcademics instance) =>
    <String, dynamic>{
      'attendance': instance.attendance.toJson(),
      'dues': instance.dues.toJson(),
      'coursesTaught': instance.coursesTaught.map((e) => e.toJson()).toList(),
    };
