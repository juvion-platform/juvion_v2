//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/me_settings.dart';
import 'package:juvi_api/src/model/me_account.dart';
import 'package:juvi_api/src/model/me_person.dart';
import 'package:juvi_api/src/model/me_faculty.dart';
import 'package:juvi_api/src/model/me_student.dart';
import 'package:juvi_api/src/model/me_institution.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Me {
  /// Returns a new [Me] instance.
  Me({

    required  this.account,

    required  this.asOf,

    required  this.deletionRequestedAt,

    required  this.deletionRequestedVia,

    required  this.faculty,

    required  this.institution,

    required  this.person,

    required  this.settings,

    required  this.student,
  });

  @JsonKey(
    
    name: r'account',
    required: true,
    includeIfNull: false,
  )


  final MeAccount account;



  @JsonKey(
    
    name: r'asOf',
    required: true,
    includeIfNull: false,
  )


  final String asOf;



  @JsonKey(
    
    name: r'deletionRequestedAt',
    required: true,
    includeIfNull: true,
  )


  final String? deletionRequestedAt;



  @JsonKey(
    
    name: r'deletionRequestedVia',
    required: true,
    includeIfNull: true,
  )


  final String? deletionRequestedVia;



  @JsonKey(
    
    name: r'faculty',
    required: true,
    includeIfNull: false,
  )


  final MeFaculty faculty;



  @JsonKey(
    
    name: r'institution',
    required: true,
    includeIfNull: false,
  )


  final MeInstitution institution;



  @JsonKey(
    
    name: r'person',
    required: true,
    includeIfNull: false,
  )


  final MePerson person;



  @JsonKey(
    
    name: r'settings',
    required: true,
    includeIfNull: false,
  )


  final MeSettings settings;



  @JsonKey(
    
    name: r'student',
    required: true,
    includeIfNull: false,
  )


  final MeStudent student;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Me &&
      other.account == account &&
      other.asOf == asOf &&
      other.deletionRequestedAt == deletionRequestedAt &&
      other.deletionRequestedVia == deletionRequestedVia &&
      other.faculty == faculty &&
      other.institution == institution &&
      other.person == person &&
      other.settings == settings &&
      other.student == student;

    @override
    int get hashCode =>
        account.hashCode +
        asOf.hashCode +
        (deletionRequestedAt == null ? 0 : deletionRequestedAt.hashCode) +
        (deletionRequestedVia == null ? 0 : deletionRequestedVia.hashCode) +
        faculty.hashCode +
        institution.hashCode +
        person.hashCode +
        settings.hashCode +
        student.hashCode;

  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  Map<String, dynamic> toJson() => _$MeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

