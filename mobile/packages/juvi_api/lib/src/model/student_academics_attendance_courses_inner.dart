//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'student_academics_attendance_courses_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudentAcademicsAttendanceCoursesInner {
  /// Returns a new [StudentAcademicsAttendanceCoursesInner] instance.
  StudentAcademicsAttendanceCoursesInner({

    required  this.attended,

     this.channelId,

    required  this.courseCode,

    required  this.headroom,

    required  this.held,

    required  this.offeringId,

    required  this.pct,

    required  this.title,
  });

  @JsonKey(
    
    name: r'attended',
    required: true,
    includeIfNull: false,
  )


  final num attended;



  @JsonKey(
    
    name: r'channelId',
    required: false,
    includeIfNull: false,
  )


  final String? channelId;



  @JsonKey(
    
    name: r'courseCode',
    required: true,
    includeIfNull: false,
  )


  final String courseCode;



  @JsonKey(
    
    name: r'headroom',
    required: true,
    includeIfNull: false,
  )


  final num headroom;



  @JsonKey(
    
    name: r'held',
    required: true,
    includeIfNull: false,
  )


  final num held;



  @JsonKey(
    
    name: r'offeringId',
    required: true,
    includeIfNull: false,
  )


  final String offeringId;



  @JsonKey(
    
    name: r'pct',
    required: true,
    includeIfNull: true,
  )


  final num? pct;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudentAcademicsAttendanceCoursesInner &&
      other.attended == attended &&
      other.channelId == channelId &&
      other.courseCode == courseCode &&
      other.headroom == headroom &&
      other.held == held &&
      other.offeringId == offeringId &&
      other.pct == pct &&
      other.title == title;

    @override
    int get hashCode =>
        attended.hashCode +
        channelId.hashCode +
        courseCode.hashCode +
        headroom.hashCode +
        held.hashCode +
        offeringId.hashCode +
        (pct == null ? 0 : pct.hashCode) +
        title.hashCode;

  factory StudentAcademicsAttendanceCoursesInner.fromJson(Map<String, dynamic> json) => _$StudentAcademicsAttendanceCoursesInnerFromJson(json);

  Map<String, dynamic> toJson() => _$StudentAcademicsAttendanceCoursesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

