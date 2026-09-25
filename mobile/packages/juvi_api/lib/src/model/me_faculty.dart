//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_faculty.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeFaculty {
  /// Returns a new [MeFaculty] instance.
  MeFaculty({

    required  this.department,

    required  this.designation,

    required  this.employeeCode,

    required  this.isHod,
  });

  @JsonKey(
    
    name: r'department',
    required: true,
    includeIfNull: true,
  )


  final String? department;



  @JsonKey(
    
    name: r'designation',
    required: true,
    includeIfNull: false,
  )


  final String designation;



  @JsonKey(
    
    name: r'employeeCode',
    required: true,
    includeIfNull: false,
  )


  final String employeeCode;



  @JsonKey(
    
    name: r'isHod',
    required: true,
    includeIfNull: false,
  )


  final bool isHod;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeFaculty &&
      other.department == department &&
      other.designation == designation &&
      other.employeeCode == employeeCode &&
      other.isHod == isHod;

    @override
    int get hashCode =>
        (department == null ? 0 : department.hashCode) +
        designation.hashCode +
        employeeCode.hashCode +
        isHod.hashCode;

  factory MeFaculty.fromJson(Map<String, dynamic> json) => _$MeFacultyFromJson(json);

  Map<String, dynamic> toJson() => _$MeFacultyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

