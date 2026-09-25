//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/config_support_contact.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_institution.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeInstitution {
  /// Returns a new [MeInstitution] instance.
  MeInstitution({

    required  this.accentColor,

    required  this.code,

    required  this.logoUrl,

    required  this.name,

    required  this.supportContact,

    required  this.timezone,
  });

  @JsonKey(
    
    name: r'accentColor',
    required: true,
    includeIfNull: true,
  )


  final String? accentColor;



  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



  @JsonKey(
    
    name: r'logoUrl',
    required: true,
    includeIfNull: true,
  )


  final String? logoUrl;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'supportContact',
    required: true,
    includeIfNull: false,
  )


  final ConfigSupportContact supportContact;



  @JsonKey(
    
    name: r'timezone',
    required: true,
    includeIfNull: false,
  )


  final String timezone;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeInstitution &&
      other.accentColor == accentColor &&
      other.code == code &&
      other.logoUrl == logoUrl &&
      other.name == name &&
      other.supportContact == supportContact &&
      other.timezone == timezone;

    @override
    int get hashCode =>
        (accentColor == null ? 0 : accentColor.hashCode) +
        code.hashCode +
        (logoUrl == null ? 0 : logoUrl.hashCode) +
        name.hashCode +
        supportContact.hashCode +
        timezone.hashCode;

  factory MeInstitution.fromJson(Map<String, dynamic> json) => _$MeInstitutionFromJson(json);

  Map<String, dynamic> toJson() => _$MeInstitutionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

