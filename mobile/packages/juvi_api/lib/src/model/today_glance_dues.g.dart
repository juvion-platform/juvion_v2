// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'today_glance_dues.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TodayGlanceDues _$TodayGlanceDuesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TodayGlanceDues', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['available', 'totalOutstanding']);
      final val = TodayGlanceDues(
        available: $checkedConvert('available', (v) => v as bool),
        nextDue: $checkedConvert(
          'nextDue',
          (v) => v == null
              ? null
              : DueInvoiceItemNextDue.fromJson(v as Map<String, dynamic>),
        ),
        totalOutstanding: $checkedConvert(
          'totalOutstanding',
          (v) => (v as num).toInt(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TodayGlanceDuesToJson(TodayGlanceDues instance) =>
    <String, dynamic>{
      'available': instance.available,
      'nextDue': ?instance.nextDue?.toJson(),
      'totalOutstanding': instance.totalOutstanding,
    };
