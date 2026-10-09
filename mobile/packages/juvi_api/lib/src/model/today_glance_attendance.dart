//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'today_glance_attendance.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TodayGlanceAttendance {
  /// Returns a new [TodayGlanceAttendance] instance.
  TodayGlanceAttendance({

    required  this.available,

    required  this.belowThreshold,

     this.overallPct,

    required  this.threshold,
  });

  @JsonKey(
    
    name: r'available',
    required: true,
    includeIfNull: false,
  )


  final bool available;



  @JsonKey(
    
    name: r'belowThreshold',
    required: true,
    includeIfNull: false,
  )


  final bool belowThreshold;



  @JsonKey(
    
    name: r'overallPct',
    required: false,
    includeIfNull: false,
  )


  final num? overallPct;



  @JsonKey(
    
    name: r'threshold',
    required: true,
    includeIfNull: false,
  )


  final num threshold;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TodayGlanceAttendance &&
      other.available == available &&
      other.belowThreshold == belowThreshold &&
      other.overallPct == overallPct &&
      other.threshold == threshold;

    @override
    int get hashCode =>
        available.hashCode +
        belowThreshold.hashCode +
        overallPct.hashCode +
        threshold.hashCode;

  factory TodayGlanceAttendance.fromJson(Map<String, dynamic> json) => _$TodayGlanceAttendanceFromJson(json);

  Map<String, dynamic> toJson() => _$TodayGlanceAttendanceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

