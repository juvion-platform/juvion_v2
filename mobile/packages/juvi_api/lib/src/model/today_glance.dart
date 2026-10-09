//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/today_glance_attendance.dart';
import 'package:juvi_api/src/model/today_glance_dues.dart';
import 'package:juvi_api/src/model/today_glance_next_assessment.dart';
import 'package:json_annotation/json_annotation.dart';

part 'today_glance.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TodayGlance {
  /// Returns a new [TodayGlance] instance.
  TodayGlance({

    required  this.attendance,

    required  this.dues,

     this.nextAssessment,
  });

  @JsonKey(
    
    name: r'attendance',
    required: true,
    includeIfNull: false,
  )


  final TodayGlanceAttendance attendance;



  @JsonKey(
    
    name: r'dues',
    required: true,
    includeIfNull: false,
  )


  final TodayGlanceDues dues;



  @JsonKey(
    
    name: r'nextAssessment',
    required: false,
    includeIfNull: false,
  )


  final TodayGlanceNextAssessment? nextAssessment;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TodayGlance &&
      other.attendance == attendance &&
      other.dues == dues &&
      other.nextAssessment == nextAssessment;

    @override
    int get hashCode =>
        attendance.hashCode +
        dues.hashCode +
        nextAssessment.hashCode;

  factory TodayGlance.fromJson(Map<String, dynamic> json) => _$TodayGlanceFromJson(json);

  Map<String, dynamic> toJson() => _$TodayGlanceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

