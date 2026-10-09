// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'courses_taught_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CoursesTaughtItem _$CoursesTaughtItemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CoursesTaughtItem', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['courseCode', 'offeringId', 'section', 'title'],
      );
      final val = CoursesTaughtItem(
        channelId: $checkedConvert('channelId', (v) => v as String?),
        courseCode: $checkedConvert('courseCode', (v) => v as String),
        offeringId: $checkedConvert('offeringId', (v) => v as String),
        section: $checkedConvert('section', (v) => v as String),
        title: $checkedConvert('title', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$CoursesTaughtItemToJson(CoursesTaughtItem instance) =>
    <String, dynamic>{
      'channelId': ?instance.channelId,
      'courseCode': instance.courseCode,
      'offeringId': instance.offeringId,
      'section': instance.section,
      'title': instance.title,
    };
