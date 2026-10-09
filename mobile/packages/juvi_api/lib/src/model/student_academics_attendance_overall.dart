//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'student_academics_attendance_overall.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudentAcademicsAttendanceOverall {
  /// Returns a new [StudentAcademicsAttendanceOverall] instance.
  StudentAcademicsAttendanceOverall({

    required  this.attended,

    required  this.held,

    required  this.pct,
  });

  @JsonKey(
    
    name: r'attended',
    required: true,
    includeIfNull: false,
  )


  final num attended;



  @JsonKey(
    
    name: r'held',
    required: true,
    includeIfNull: false,
  )


  final num held;



  @JsonKey(
    
    name: r'pct',
    required: true,
    includeIfNull: true,
  )


  final num? pct;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudentAcademicsAttendanceOverall &&
      other.attended == attended &&
      other.held == held &&
      other.pct == pct;

    @override
    int get hashCode =>
        attended.hashCode +
        held.hashCode +
        (pct == null ? 0 : pct.hashCode);

  factory StudentAcademicsAttendanceOverall.fromJson(Map<String, dynamic> json) => _$StudentAcademicsAttendanceOverallFromJson(json);

  Map<String, dynamic> toJson() => _$StudentAcademicsAttendanceOverallToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

