//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'day_class_moved_from.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DayClassMovedFrom {
  /// Returns a new [DayClassMovedFrom] instance.
  DayClassMovedFrom({

    required  this.date,

    required  this.start,
  });

  @JsonKey(
    
    name: r'date',
    required: true,
    includeIfNull: false,
  )


  final String date;



  @JsonKey(
    
    name: r'start',
    required: true,
    includeIfNull: false,
  )


  final String start;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DayClassMovedFrom &&
      other.date == date &&
      other.start == start;

    @override
    int get hashCode =>
        date.hashCode +
        start.hashCode;

  factory DayClassMovedFrom.fromJson(Map<String, dynamic> json) => _$DayClassMovedFromFromJson(json);

  Map<String, dynamic> toJson() => _$DayClassMovedFromToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

