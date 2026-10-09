//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/student_academics.dart';
import 'package:juvi_api/src/model/student_academics_attendance.dart';
import 'package:juvi_api/src/model/faculty_courses.dart';
import 'package:juvi_api/src/model/student_dues.dart';
import 'package:juvi_api/src/model/courses_taught_item.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_academics.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeAcademics {
  /// Returns a new [MeAcademics] instance.
  MeAcademics({

    required  this.attendance,

    required  this.dues,

    required  this.coursesTaught,
  });

  @JsonKey(
    
    name: r'attendance',
    required: true,
    includeIfNull: false,
  )


  final StudentAcademicsAttendance attendance;



  @JsonKey(
    
    name: r'dues',
    required: true,
    includeIfNull: false,
  )


  final StudentDues dues;



  @JsonKey(
    
    name: r'coursesTaught',
    required: true,
    includeIfNull: false,
  )


  final List<CoursesTaughtItem> coursesTaught;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeAcademics &&
      other.attendance == attendance &&
      other.dues == dues &&
      other.coursesTaught == coursesTaught;

    @override
    int get hashCode =>
        attendance.hashCode +
        dues.hashCode +
        coursesTaught.hashCode;

  factory MeAcademics.fromJson(Map<String, dynamic> json) => _$MeAcademicsFromJson(json);

  Map<String, dynamic> toJson() => _$MeAcademicsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

