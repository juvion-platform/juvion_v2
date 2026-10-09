// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'today.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Today _$TodayFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Today', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['asOf', 'glance', 'today', 'tomorrow'],
      );
      final val = Today(
        asOf: $checkedConvert('asOf', (v) => v as String),
        glance: $checkedConvert(
          'glance',
          (v) => TodayGlance.fromJson(v as Map<String, dynamic>),
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

Map<String, dynamic> _$TodayToJson(Today instance) => <String, dynamic>{
  'asOf': instance.asOf,
  'glance': instance.glance.toJson(),
  'today': instance.today.toJson(),
  'tomorrow': instance.tomorrow.toJson(),
};
