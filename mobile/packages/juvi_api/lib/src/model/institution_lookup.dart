//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/config_min_app_version.dart';
import 'package:json_annotation/json_annotation.dart';

part 'institution_lookup.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InstitutionLookup {
  /// Returns a new [InstitutionLookup] instance.
  InstitutionLookup({

    required  this.accentColor,

    required  this.collegeId,

    required  this.logoUrl,

    required  this.minAppVersion,

    required  this.name,

    required  this.paused,

    required  this.pausedMessage,
  });

  @JsonKey(
    
    name: r'accentColor',
    required: true,
    includeIfNull: true,
  )


  final String? accentColor;



  @JsonKey(
    
    name: r'collegeId',
    required: true,
    includeIfNull: false,
  )


  final String collegeId;



  @JsonKey(
    
    name: r'logoUrl',
    required: true,
    includeIfNull: true,
  )


  final String? logoUrl;



  @JsonKey(
    
    name: r'minAppVersion',
    required: true,
    includeIfNull: false,
  )


  final ConfigMinAppVersion minAppVersion;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'paused',
    required: true,
    includeIfNull: false,
  )


  final bool paused;



  @JsonKey(
    
    name: r'pausedMessage',
    required: true,
    includeIfNull: true,
  )


  final String? pausedMessage;





    @override
    bool operator ==(Object other) => identical(this, other) || other is InstitutionLookup &&
      other.accentColor == accentColor &&
      other.collegeId == collegeId &&
      other.logoUrl == logoUrl &&
      other.minAppVersion == minAppVersion &&
      other.name == name &&
      other.paused == paused &&
      other.pausedMessage == pausedMessage;

    @override
    int get hashCode =>
        (accentColor == null ? 0 : accentColor.hashCode) +
        collegeId.hashCode +
        (logoUrl == null ? 0 : logoUrl.hashCode) +
        minAppVersion.hashCode +
        name.hashCode +
        paused.hashCode +
        (pausedMessage == null ? 0 : pausedMessage.hashCode);

  factory InstitutionLookup.fromJson(Map<String, dynamic> json) => _$InstitutionLookupFromJson(json);

  Map<String, dynamic> toJson() => _$InstitutionLookupToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

