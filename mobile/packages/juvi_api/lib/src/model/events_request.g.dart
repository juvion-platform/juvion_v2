// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'events_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EventsRequest _$EventsRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('EventsRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['events']);
      final val = EventsRequest(
        events: $checkedConvert(
          'events',
          (v) => (v as List<dynamic>)
              .map(
                (e) => EventsRequestEventsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$EventsRequestToJson(EventsRequest instance) =>
    <String, dynamic>{
      'events': instance.events.map((e) => e.toJson()).toList(),
    };
