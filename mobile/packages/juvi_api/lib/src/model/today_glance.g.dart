// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'today_glance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TodayGlance _$TodayGlanceFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TodayGlance', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['attendance', 'dues']);
      final val = TodayGlance(
        attendance: $checkedConvert(
          'attendance',
          (v) => TodayGlanceAttendance.fromJson(v as Map<String, dynamic>),
        ),
        dues: $checkedConvert(
          'dues',
          (v) => TodayGlanceDues.fromJson(v as Map<String, dynamic>),
        ),
        nextAssessment: $checkedConvert(
          'nextAssessment',
          (v) => v == null
              ? null
              : TodayGlanceNextAssessment.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TodayGlanceToJson(TodayGlance instance) =>
    <String, dynamic>{
      'attendance': instance.attendance.toJson(),
      'dues': instance.dues.toJson(),
      'nextAssessment': ?instance.nextAssessment?.toJson(),
    };
