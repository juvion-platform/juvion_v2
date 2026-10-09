// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teaching_next_teaching_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TeachingNextTeachingDay _$TeachingNextTeachingDayFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TeachingNextTeachingDay', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['classes', 'date']);
  final val = TeachingNextTeachingDay(
    classes: $checkedConvert(
      'classes',
      (v) => (v as List<dynamic>)
          .map(
            (e) => TeachingNextTeachingDayClassesInner.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
    date: $checkedConvert('date', (v) => v as String),
    holiday: $checkedConvert('holiday', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$TeachingNextTeachingDayToJson(
  TeachingNextTeachingDay instance,
) => <String, dynamic>{
  'classes': instance.classes.map((e) => e.toJson()).toList(),
  'date': instance.date,
  'holiday': ?instance.holiday,
};
