// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teaching.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Teaching _$TeachingFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Teaching', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['asOf', 'faculty', 'today', 'tomorrow'],
      );
      final val = Teaching(
        asOf: $checkedConvert('asOf', (v) => v as String),
        faculty: $checkedConvert(
          'faculty',
          (v) => TeachingFaculty.fromJson(v as Map<String, dynamic>),
        ),
        nextTeachingDay: $checkedConvert(
          'nextTeachingDay',
          (v) => v == null
              ? null
              : TeachingNextTeachingDay.fromJson(v as Map<String, dynamic>),
        ),
        today: $checkedConvert(
          'today',
          (v) => DayView.fromJson(v as Map<String, dynamic>),
        ),
        tomorrow: $checkedConvert(
          'tomorrow',
          (v) => DayView.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TeachingToJson(Teaching instance) => <String, dynamic>{
  'asOf': instance.asOf,
  'faculty': instance.faculty.toJson(),
  'nextTeachingDay': ?instance.nextTeachingDay?.toJson(),
  'today': instance.today.toJson(),
  'tomorrow': instance.tomorrow.toJson(),
};
