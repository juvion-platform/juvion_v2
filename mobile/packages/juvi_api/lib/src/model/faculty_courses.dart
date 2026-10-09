//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/courses_taught_item.dart';
import 'package:json_annotation/json_annotation.dart';

part 'faculty_courses.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FacultyCourses {
  /// Returns a new [FacultyCourses] instance.
  FacultyCourses({

    required  this.coursesTaught,
  });

  @JsonKey(
    
    name: r'coursesTaught',
    required: true,
    includeIfNull: false,
  )


  final List<CoursesTaughtItem> coursesTaught;





    @override
    bool operator ==(Object other) => identical(this, other) || other is FacultyCourses &&
      other.coursesTaught == coursesTaught;

    @override
    int get hashCode =>
        coursesTaught.hashCode;

  factory FacultyCourses.fromJson(Map<String, dynamic> json) => _$FacultyCoursesFromJson(json);

  Map<String, dynamic> toJson() => _$FacultyCoursesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

