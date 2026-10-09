// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_academics_attendance_overall.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StudentAcademicsAttendanceOverall _$StudentAcademicsAttendanceOverallFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StudentAcademicsAttendanceOverall', json, (
  $checkedConvert,
) {
  $checkKeys(json, requiredKeys: const ['attended', 'held', 'pct']);
  final val = StudentAcademicsAttendanceOverall(
    attended: $checkedConvert('attended', (v) => v as num),
    held: $checkedConvert('held', (v) => v as num),
    pct: $checkedConvert('pct', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$StudentAcademicsAttendanceOverallToJson(
  StudentAcademicsAttendanceOverall instance,
) => <String, dynamic>{
  'attended': instance.attended,
  'held': instance.held,
  'pct': instance.pct,
};
