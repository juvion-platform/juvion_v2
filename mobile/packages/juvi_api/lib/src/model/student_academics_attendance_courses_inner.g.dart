// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_academics_attendance_courses_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StudentAcademicsAttendanceCoursesInner
_$StudentAcademicsAttendanceCoursesInnerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StudentAcademicsAttendanceCoursesInner', json, (
      $checkedConvert,
    ) {
      $checkKeys(
        json,
        requiredKeys: const [
          'attended',
          'courseCode',
          'headroom',
          'held',
          'offeringId',
          'pct',
          'title',
        ],
      );
      final val = StudentAcademicsAttendanceCoursesInner(
        attended: $checkedConvert('attended', (v) => v as num),
        channelId: $checkedConvert('channelId', (v) => v as String?),
        courseCode: $checkedConvert('courseCode', (v) => v as String),
        headroom: $checkedConvert('headroom', (v) => v as num),
        held: $checkedConvert('held', (v) => v as num),
        offeringId: $checkedConvert('offeringId', (v) => v as String),
        pct: $checkedConvert('pct', (v) => v as num?),
        title: $checkedConvert('title', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$StudentAcademicsAttendanceCoursesInnerToJson(
  StudentAcademicsAttendanceCoursesInner instance,
) => <String, dynamic>{
  'attended': instance.attended,
  'channelId': ?instance.channelId,
  'courseCode': instance.courseCode,
  'headroom': instance.headroom,
  'held': instance.held,
  'offeringId': instance.offeringId,
  'pct': instance.pct,
  'title': instance.title,
};
