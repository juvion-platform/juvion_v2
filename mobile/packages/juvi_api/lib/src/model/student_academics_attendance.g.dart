// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_academics_attendance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StudentAcademicsAttendance _$StudentAcademicsAttendanceFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StudentAcademicsAttendance', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'available',
      'courses',
      'overall',
      'showHeadroom',
      'threshold',
    ],
  );
  final val = StudentAcademicsAttendance(
    available: $checkedConvert('available', (v) => v as bool),
    courses: $checkedConvert(
      'courses',
      (v) => (v as List<dynamic>)
          .map(
            (e) => StudentAcademicsAttendanceCoursesInner.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    overall: $checkedConvert(
      'overall',
      (v) =>
          StudentAcademicsAttendanceOverall.fromJson(v as Map<String, dynamic>),
    ),
    showHeadroom: $checkedConvert('showHeadroom', (v) => v as bool),
    threshold: $checkedConvert('threshold', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$StudentAcademicsAttendanceToJson(
  StudentAcademicsAttendance instance,
) => <String, dynamic>{
  'available': instance.available,
  'courses': instance.courses.map((e) => e.toJson()).toList(),
  'overall': instance.overall.toJson(),
  'showHeadroom': instance.showHeadroom,
  'threshold': instance.threshold,
};
