//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'events_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EventsResult {
  /// Returns a new [EventsResult] instance.
  EventsResult({

    required  this.accepted,

    required  this.rejected,
  });

  @JsonKey(
    
    name: r'accepted',
    required: true,
    includeIfNull: false,
  )


  final int accepted;



  @JsonKey(
    
    name: r'rejected',
    required: true,
    includeIfNull: false,
  )


  final int rejected;





    @override
    bool operator ==(Object other) => identical(this, other) || other is EventsResult &&
      other.accepted == accepted &&
      other.rejected == rejected;

    @override
    int get hashCode =>
        accepted.hashCode +
        rejected.hashCode;

  factory EventsResult.fromJson(Map<String, dynamic> json) => _$EventsResultFromJson(json);

  Map<String, dynamic> toJson() => _$EventsResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

