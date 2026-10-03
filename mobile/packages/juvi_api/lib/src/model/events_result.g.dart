// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'events_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EventsResult _$EventsResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('EventsResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['accepted', 'rejected']);
      final val = EventsResult(
        accepted: $checkedConvert('accepted', (v) => (v as num).toInt()),
        rejected: $checkedConvert('rejected', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$EventsResultToJson(EventsResult instance) =>
    <String, dynamic>{
      'accepted': instance.accepted,
      'rejected': instance.rejected,
    };
