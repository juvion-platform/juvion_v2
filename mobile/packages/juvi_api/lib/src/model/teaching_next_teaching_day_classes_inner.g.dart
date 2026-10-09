// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teaching_next_teaching_day_classes_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TeachingNextTeachingDayClassesInner
_$TeachingNextTeachingDayClassesInnerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TeachingNextTeachingDayClassesInner', json, (
      $checkedConvert,
    ) {
      $checkKeys(
        json,
        requiredKeys: const [
          'courseCode',
          'end',
          'offeringId',
          'section',
          'slotType',
          'start',
          'status',
          'title',
        ],
      );
      final val = TeachingNextTeachingDayClassesInner(
        channelId: $checkedConvert('channelId', (v) => v as String?),
        courseCode: $checkedConvert('courseCode', (v) => v as String),
        end: $checkedConvert('end', (v) => v as String),
        faculty: $checkedConvert('faculty', (v) => v as String?),
        movedFrom: $checkedConvert(
          'movedFrom',
          (v) => v == null
              ? null
              : DayClassMovedFrom.fromJson(v as Map<String, dynamic>),
        ),
        offeringId: $checkedConvert('offeringId', (v) => v as String),
        registered: $checkedConvert('registered', (v) => (v as num?)?.toInt()),
        room: $checkedConvert('room', (v) => v as String?),
        section: $checkedConvert('section', (v) => v as String),
        slotType: $checkedConvert('slotType', (v) => v as String),
        start: $checkedConvert('start', (v) => v as String),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$TeachingNextTeachingDayClassesInnerStatusEnumEnumMap,
            v,
          ),
        ),
        title: $checkedConvert('title', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$TeachingNextTeachingDayClassesInnerToJson(
  TeachingNextTeachingDayClassesInner instance,
) => <String, dynamic>{
  'channelId': ?instance.channelId,
  'courseCode': instance.courseCode,
  'end': instance.end,
  'faculty': ?instance.faculty,
  'movedFrom': ?instance.movedFrom?.toJson(),
  'offeringId': instance.offeringId,
  'registered': ?instance.registered,
  'room': ?instance.room,
  'section': instance.section,
  'slotType': instance.slotType,
  'start': instance.start,
  'status':
      _$TeachingNextTeachingDayClassesInnerStatusEnumEnumMap[instance.status]!,
  'title': instance.title,
};

const _$TeachingNextTeachingDayClassesInnerStatusEnumEnumMap = {
  TeachingNextTeachingDayClassesInnerStatusEnum.cancelled: 'cancelled',
  TeachingNextTeachingDayClassesInnerStatusEnum.rescheduled: 'rescheduled',
  TeachingNextTeachingDayClassesInnerStatusEnum.scheduled: 'scheduled',
};
