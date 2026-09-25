//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/me_settings_quiet_hours.dart';
import 'package:juvi_api/src/model/me_settings_tiers.dart';
import 'package:json_annotation/json_annotation.dart';

part 'settings.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Settings {
  /// Returns a new [Settings] instance.
  Settings({

    required  this.language,

    required  this.quietHours,

    required  this.tiers,
  });

  @JsonKey(
    
    name: r'language',
    required: true,
    includeIfNull: false,
  )


  final SettingsLanguageEnum language;



  @JsonKey(
    
    name: r'quietHours',
    required: true,
    includeIfNull: false,
  )


  final MeSettingsQuietHours quietHours;



  @JsonKey(
    
    name: r'tiers',
    required: true,
    includeIfNull: false,
  )


  final MeSettingsTiers tiers;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Settings &&
      other.language == language &&
      other.quietHours == quietHours &&
      other.tiers == tiers;

    @override
    int get hashCode =>
        language.hashCode +
        quietHours.hashCode +
        tiers.hashCode;

  factory Settings.fromJson(Map<String, dynamic> json) => _$SettingsFromJson(json);

  Map<String, dynamic> toJson() => _$SettingsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum SettingsLanguageEnum {
@JsonValue(r'en')
en(r'en');

const SettingsLanguageEnum(this.value);

final String value;

@override
String toString() => value;
}


