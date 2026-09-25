//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'config_feature_flags.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfigFeatureFlags {
  /// Returns a new [ConfigFeatureFlags] instance.
  ConfigFeatureFlags({

    required  this.languageRoadmap,
  });

  @JsonKey(
    
    name: r'languageRoadmap',
    required: true,
    includeIfNull: false,
  )


  final bool languageRoadmap;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ConfigFeatureFlags &&
      other.languageRoadmap == languageRoadmap;

    @override
    int get hashCode =>
        languageRoadmap.hashCode;

  factory ConfigFeatureFlags.fromJson(Map<String, dynamic> json) => _$ConfigFeatureFlagsFromJson(json);

  Map<String, dynamic> toJson() => _$ConfigFeatureFlagsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

