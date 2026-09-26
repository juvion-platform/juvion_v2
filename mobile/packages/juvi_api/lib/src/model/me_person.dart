//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_person.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MePerson {
  /// Returns a new [MePerson] instance.
  MePerson({

    required  this.firstName,

    required  this.name,

    required  this.photoUrl,
  });

  @JsonKey(
    
    name: r'firstName',
    required: true,
    includeIfNull: false,
  )


  final String firstName;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'photoUrl',
    required: true,
    includeIfNull: true,
  )


  final String? photoUrl;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MePerson &&
      other.firstName == firstName &&
      other.name == name &&
      other.photoUrl == photoUrl;

    @override
    int get hashCode =>
        firstName.hashCode +
        name.hashCode +
        (photoUrl == null ? 0 : photoUrl.hashCode);

  factory MePerson.fromJson(Map<String, dynamic> json) => _$MePersonFromJson(json);

  Map<String, dynamic> toJson() => _$MePersonToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

