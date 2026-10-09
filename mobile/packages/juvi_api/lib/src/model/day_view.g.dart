// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'day_view.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DayView _$DayViewFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DayView', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['classes', 'date']);
      final val = DayView(
        classes: $checkedConvert(
          'classes',
          (v) => (v as List<dynamic>)
              .map((e) => DayClass.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        date: $checkedConvert('date', (v) => v as String),
        holiday: $checkedConvert('holiday', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$DayViewToJson(DayView instance) => <String, dynamic>{
  'classes': instance.classes.map((e) => e.toJson()).toList(),
  'date': instance.date,
  'holiday': ?instance.holiday,
};
