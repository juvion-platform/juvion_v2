//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'settings_patch_tiers.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SettingsPatchTiers {
  /// Returns a new [SettingsPatchTiers] instance.
  SettingsPatchTiers({

     this.important,

     this.routine,
  });

  @JsonKey(
    
    name: r'important',
    required: false,
    includeIfNull: false,
  )


  final bool? important;



  @JsonKey(
    
    name: r'routine',
    required: false,
    includeIfNull: false,
  )


  final bool? routine;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SettingsPatchTiers &&
      other.important == important &&
      other.routine == routine;

    @override
    int get hashCode =>
        important.hashCode +
        routine.hashCode;

  factory SettingsPatchTiers.fromJson(Map<String, dynamic> json) => _$SettingsPatchTiersFromJson(json);

  Map<String, dynamic> toJson() => _$SettingsPatchTiersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

