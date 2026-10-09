//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/teaching_next_teaching_day_classes_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'teaching_next_teaching_day.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TeachingNextTeachingDay {
  /// Returns a new [TeachingNextTeachingDay] instance.
  TeachingNextTeachingDay({

    required  this.classes,

    required  this.date,

     this.holiday,
  });

  @JsonKey(
    
    name: r'classes',
    required: true,
    includeIfNull: false,
  )


  final List<TeachingNextTeachingDayClassesInner> classes;



  @JsonKey(
    
    name: r'date',
    required: true,
    includeIfNull: false,
  )


  final String date;



  @JsonKey(
    
    name: r'holiday',
    required: false,
    includeIfNull: false,
  )


  final String? holiday;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TeachingNextTeachingDay &&
      other.classes == classes &&
      other.date == date &&
      other.holiday == holiday;

    @override
    int get hashCode =>
        classes.hashCode +
        date.hashCode +
        holiday.hashCode;

  factory TeachingNextTeachingDay.fromJson(Map<String, dynamic> json) => _$TeachingNextTeachingDayFromJson(json);

  Map<String, dynamic> toJson() => _$TeachingNextTeachingDayToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

