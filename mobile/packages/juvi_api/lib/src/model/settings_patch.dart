//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/me_settings_quiet_hours.dart';
import 'package:juvi_api/src/model/settings_patch_tiers.dart';
import 'package:json_annotation/json_annotation.dart';

part 'settings_patch.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SettingsPatch {
  /// Returns a new [SettingsPatch] instance.
  SettingsPatch({

     this.language,

     this.quietHours,

     this.tiers,
  });

  @JsonKey(
    
    name: r'language',
    required: false,
    includeIfNull: false,
  )


  final SettingsPatchLanguageEnum? language;



  @JsonKey(
    
    name: r'quietHours',
    required: false,
    includeIfNull: false,
  )


  final MeSettingsQuietHours? quietHours;



  @JsonKey(
    
    name: r'tiers',
    required: false,
    includeIfNull: false,
  )


  final SettingsPatchTiers? tiers;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SettingsPatch &&
      other.language == language &&
      other.quietHours == quietHours &&
      other.tiers == tiers;

    @override
    int get hashCode =>
        language.hashCode +
        quietHours.hashCode +
        tiers.hashCode;

  factory SettingsPatch.fromJson(Map<String, dynamic> json) => _$SettingsPatchFromJson(json);

  Map<String, dynamic> toJson() => _$SettingsPatchToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SettingsPatchLanguageEnum {
@JsonValue(r'en')
en(r'en');

const SettingsPatchLanguageEnum(this.value);

final String value;

@override
String toString() => value;
}


