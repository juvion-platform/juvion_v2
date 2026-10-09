//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/student_academics_attendance_courses_inner.dart';
import 'package:juvi_api/src/model/student_academics_attendance_overall.dart';
import 'package:json_annotation/json_annotation.dart';

part 'student_academics_attendance.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudentAcademicsAttendance {
  /// Returns a new [StudentAcademicsAttendance] instance.
  StudentAcademicsAttendance({

    required  this.available,

    required  this.courses,

    required  this.overall,

    required  this.showHeadroom,

    required  this.threshold,
  });

  @JsonKey(
    
    name: r'available',
    required: true,
    includeIfNull: false,
  )


  final bool available;



  @JsonKey(
    
    name: r'courses',
    required: true,
    includeIfNull: false,
  )


  final List<StudentAcademicsAttendanceCoursesInner> courses;



  @JsonKey(
    
    name: r'overall',
    required: true,
    includeIfNull: false,
  )


  final StudentAcademicsAttendanceOverall overall;



  @JsonKey(
    
    name: r'showHeadroom',
    required: true,
    includeIfNull: false,
  )


  final bool showHeadroom;



  @JsonKey(
    
    name: r'threshold',
    required: true,
    includeIfNull: false,
  )


  final num threshold;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudentAcademicsAttendance &&
      other.available == available &&
      other.courses == courses &&
      other.overall == overall &&
      other.showHeadroom == showHeadroom &&
      other.threshold == threshold;

    @override
    int get hashCode =>
        available.hashCode +
        courses.hashCode +
        overall.hashCode +
        showHeadroom.hashCode +
        threshold.hashCode;

  factory StudentAcademicsAttendance.fromJson(Map<String, dynamic> json) => _$StudentAcademicsAttendanceFromJson(json);

  Map<String, dynamic> toJson() => _$StudentAcademicsAttendanceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

