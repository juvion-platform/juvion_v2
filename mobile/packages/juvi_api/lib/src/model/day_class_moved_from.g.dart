// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'day_class_moved_from.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DayClassMovedFrom _$DayClassMovedFromFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DayClassMovedFrom', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['date', 'start']);
      final val = DayClassMovedFrom(
        date: $checkedConvert('date', (v) => v as String),
        start: $checkedConvert('start', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DayClassMovedFromToJson(DayClassMovedFrom instance) =>
    <String, dynamic>{'date': instance.date, 'start': instance.start};
