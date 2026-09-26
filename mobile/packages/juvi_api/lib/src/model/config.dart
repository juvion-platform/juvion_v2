//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/config_support_contact.dart';
import 'package:juvi_api/src/model/config_quiet_hours_default.dart';
import 'package:juvi_api/src/model/config_feature_flags.dart';
import 'package:juvi_api/src/model/config_min_app_version.dart';
import 'package:json_annotation/json_annotation.dart';

part 'config.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Config {
  /// Returns a new [Config] instance.
  Config({

    required  this.accentColor,

    required  this.code,

    required  this.featureFlags,

    required  this.logoUrl,

    required  this.minAppVersion,

    required  this.name,

    required  this.onboardingSteps,

    required  this.quietHoursDefault,

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
    
    name: r'featureFlags',
    required: true,
    includeIfNull: false,
  )


  final ConfigFeatureFlags featureFlags;



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
    
    name: r'onboardingSteps',
    required: true,
    includeIfNull: false,
  )


  final List<String> onboardingSteps;



  @JsonKey(
    
    name: r'quietHoursDefault',
    required: true,
    includeIfNull: false,
  )


  final ConfigQuietHoursDefault quietHoursDefault;



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
    bool operator ==(Object other) => identical(this, other) || other is Config &&
      other.accentColor == accentColor &&
      other.code == code &&
      other.featureFlags == featureFlags &&
      other.logoUrl == logoUrl &&
      other.minAppVersion == minAppVersion &&
      other.name == name &&
      other.onboardingSteps == onboardingSteps &&
      other.quietHoursDefault == quietHoursDefault &&
      other.supportContact == supportContact &&
      other.timezone == timezone;

    @override
    int get hashCode =>
        (accentColor == null ? 0 : accentColor.hashCode) +
        code.hashCode +
        featureFlags.hashCode +
        (logoUrl == null ? 0 : logoUrl.hashCode) +
        minAppVersion.hashCode +
        name.hashCode +
        onboardingSteps.hashCode +
        quietHoursDefault.hashCode +
        supportContact.hashCode +
        timezone.hashCode;

  factory Config.fromJson(Map<String, dynamic> json) => _$ConfigFromJson(json);

  Map<String, dynamic> toJson() => _$ConfigToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

