//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/teaching_faculty.dart';
import 'package:juvi_api/src/model/teaching_next_teaching_day.dart';
import 'package:juvi_api/src/model/day_view.dart';
import 'package:json_annotation/json_annotation.dart';

part 'teaching.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Teaching {
  /// Returns a new [Teaching] instance.
  Teaching({

    required  this.asOf,

    required  this.faculty,

     this.nextTeachingDay,

    required  this.today,

    required  this.tomorrow,
  });

  @JsonKey(
    
    name: r'asOf',
    required: true,
    includeIfNull: false,
  )


  final String asOf;



  @JsonKey(
    
    name: r'faculty',
    required: true,
    includeIfNull: false,
  )


  final TeachingFaculty faculty;



  @JsonKey(
    
    name: r'nextTeachingDay',
    required: false,
    includeIfNull: false,
  )


  final TeachingNextTeachingDay? nextTeachingDay;



  @JsonKey(
    
    name: r'today',
    required: true,
    includeIfNull: false,
  )


  final DayView today;



  @JsonKey(
    
    name: r'tomorrow',
    required: true,
    includeIfNull: false,
  )


  final DayView tomorrow;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Teaching &&
      other.asOf == asOf &&
      other.faculty == faculty &&
      other.nextTeachingDay == nextTeachingDay &&
      other.today == today &&
      other.tomorrow == tomorrow;

    @override
    int get hashCode =>
        asOf.hashCode +
        faculty.hashCode +
        nextTeachingDay.hashCode +
        today.hashCode +
        tomorrow.hashCode;

  factory Teaching.fromJson(Map<String, dynamic> json) => _$TeachingFromJson(json);

  Map<String, dynamic> toJson() => _$TeachingToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

