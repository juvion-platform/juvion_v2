//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'teaching_faculty.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TeachingFaculty {
  /// Returns a new [TeachingFaculty] instance.
  TeachingFaculty({

    required  this.kind,
  });

  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final TeachingFacultyKindEnum kind;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TeachingFaculty &&
      other.kind == kind;

    @override
    int get hashCode =>
        kind.hashCode;

  factory TeachingFaculty.fromJson(Map<String, dynamic> json) => _$TeachingFacultyFromJson(json);

  Map<String, dynamic> toJson() => _$TeachingFacultyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum TeachingFacultyKindEnum {
@JsonValue(r'regular')
regular(r'regular'),
@JsonValue(r'hod')
hod(r'hod'),
@JsonValue(r'adjunct')
adjunct(r'adjunct');

const TeachingFacultyKindEnum(this.value);

final String value;

@override
String toString() => value;
}


