//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/day_class.dart';
import 'package:json_annotation/json_annotation.dart';

part 'day_view.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DayView {
  /// Returns a new [DayView] instance.
  DayView({

    required  this.classes,

    required  this.date,

     this.holiday,
  });

  @JsonKey(
    
    name: r'classes',
    required: true,
    includeIfNull: false,
  )


  final List<DayClass> classes;



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
    bool operator ==(Object other) => identical(this, other) || other is DayView &&
      other.classes == classes &&
      other.date == date &&
      other.holiday == holiday;

    @override
    int get hashCode =>
        classes.hashCode +
        date.hashCode +
        holiday.hashCode;

  factory DayView.fromJson(Map<String, dynamic> json) => _$DayViewFromJson(json);

  Map<String, dynamic> toJson() => _$DayViewToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

