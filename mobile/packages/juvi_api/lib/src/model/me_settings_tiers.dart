//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_settings_tiers.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSettingsTiers {
  /// Returns a new [MeSettingsTiers] instance.
  MeSettingsTiers({

    required  this.important,

    required  this.routine,
  });

  @JsonKey(
    
    name: r'important',
    required: true,
    includeIfNull: false,
  )


  final bool important;



  @JsonKey(
    
    name: r'routine',
    required: true,
    includeIfNull: false,
  )


  final bool routine;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MeSettingsTiers &&
      other.important == important &&
      other.routine == routine;

    @override
    int get hashCode =>
        important.hashCode +
        routine.hashCode;

  factory MeSettingsTiers.fromJson(Map<String, dynamic> json) => _$MeSettingsTiersFromJson(json);

  Map<String, dynamic> toJson() => _$MeSettingsTiersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

