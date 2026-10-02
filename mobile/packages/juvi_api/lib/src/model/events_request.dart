//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/events_request_events_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'events_request.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EventsRequest {
  /// Returns a new [EventsRequest] instance.
  EventsRequest({

    required  this.events,
  });

  @JsonKey(
    
    name: r'events',
    required: true,
    includeIfNull: false,
  )


  final List<EventsRequestEventsInner> events;





    @override
    bool operator ==(Object other) => identical(this, other) || other is EventsRequest &&
      other.events == events;

    @override
    int get hashCode =>
        events.hashCode;

  factory EventsRequest.fromJson(Map<String, dynamic> json) => _$EventsRequestFromJson(json);

  Map<String, dynamic> toJson() => _$EventsRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

