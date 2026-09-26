//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_student.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeStudent {
  /// Returns a new [MeStudent] instance.
  MeStudent({

    required  this.batch,

    required  this.branch,

    required  this.department,

    required  this.hostel,

    required  this.isLateralEntry,

    required  this.programme,

    required  this.rollNumber,

    required  this.section,
  });

  @JsonKey(
    
    name: r'batch',
    required: true,
    includeIfNull: true,
  )


  final String? batch;



  @JsonKey(
    
    name: r'branch',
    required: true,
    includeIfNull: true,
  )


  final String? branch;



  @JsonKey(
    
    name: r'department',
    required: true,
    includeIfNull: true,
  )


  final String? department;



  @JsonKey(
    
    name: r'hostel',
    required: true,
    includeIfNull: true,
  )


  final String? hostel;



  @JsonKey(
    
    name: r'isLateralEntry',
    required: true,
    includeIfNull: false,
  )


  final bool isLateralEntry;



  @JsonKey(
    
    name: r'programme',
    required: true,
    includeIfNull: true,
  )


  final String? programme;



  @JsonKey(
    
    name: r'rollNumber',
    required: true,
    includeIfNull: true,
  )


  final String? rollNumber;



  @JsonKey(
    
    name: r'section',
    required: true,
    includeIfNull: true,
  )


  final String? section;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeStudent &&
      other.batch == batch &&
      other.branch == branch &&
      other.department == department &&
      other.hostel == hostel &&
      other.isLateralEntry == isLateralEntry &&
      other.programme == programme &&
      other.rollNumber == rollNumber &&
      other.section == section;

    @override
    int get hashCode =>
        (batch == null ? 0 : batch.hashCode) +
        (branch == null ? 0 : branch.hashCode) +
        (department == null ? 0 : department.hashCode) +
        (hostel == null ? 0 : hostel.hashCode) +
        isLateralEntry.hashCode +
        (programme == null ? 0 : programme.hashCode) +
        (rollNumber == null ? 0 : rollNumber.hashCode) +
        (section == null ? 0 : section.hashCode);

  factory MeStudent.fromJson(Map<String, dynamic> json) => _$MeStudentFromJson(json);

  Map<String, dynamic> toJson() => _$MeStudentToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

