// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'today_glance_next_assessment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TodayGlanceNextAssessment _$TodayGlanceNextAssessmentFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TodayGlanceNextAssessment', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['at', 'courseCode', 'offeringId', 'title'],
  );
  final val = TodayGlanceNextAssessment(
    at: $checkedConvert('at', (v) => v as String),
    channelId: $checkedConvert('channelId', (v) => v as String?),
    courseCode: $checkedConvert('courseCode', (v) => v as String),
    offeringId: $checkedConvert('offeringId', (v) => v as String),
    title: $checkedConvert('title', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$TodayGlanceNextAssessmentToJson(
  TodayGlanceNextAssessment instance,
) => <String, dynamic>{
  'at': instance.at,
  'channelId': ?instance.channelId,
  'courseCode': instance.courseCode,
  'offeringId': instance.offeringId,
  'title': instance.title,
};
