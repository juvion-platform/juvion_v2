//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/student_academics_attendance.dart';
import 'package:juvi_api/src/model/student_dues.dart';
import 'package:json_annotation/json_annotation.dart';

part 'student_academics.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudentAcademics {
  /// Returns a new [StudentAcademics] instance.
  StudentAcademics({

    required  this.attendance,

    required  this.dues,
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





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudentAcademics &&
      other.attendance == attendance &&
      other.dues == dues;

    @override
    int get hashCode =>
        attendance.hashCode +
        dues.hashCode;

  factory StudentAcademics.fromJson(Map<String, dynamic> json) => _$StudentAcademicsFromJson(json);

  Map<String, dynamic> toJson() => _$StudentAcademicsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

