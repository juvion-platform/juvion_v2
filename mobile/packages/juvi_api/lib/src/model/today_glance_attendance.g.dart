// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'today_glance_attendance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TodayGlanceAttendance _$TodayGlanceAttendanceFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TodayGlanceAttendance', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['available', 'belowThreshold', 'threshold'],
  );
  final val = TodayGlanceAttendance(
    available: $checkedConvert('available', (v) => v as bool),
    belowThreshold: $checkedConvert('belowThreshold', (v) => v as bool),
    overallPct: $checkedConvert('overallPct', (v) => v as num?),
    threshold: $checkedConvert('threshold', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$TodayGlanceAttendanceToJson(
  TodayGlanceAttendance instance,
) => <String, dynamic>{
  'available': instance.available,
  'belowThreshold': instance.belowThreshold,
  'overallPct': ?instance.overallPct,
  'threshold': instance.threshold,
};
