//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'config_min_app_version.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfigMinAppVersion {
  /// Returns a new [ConfigMinAppVersion] instance.
  ConfigMinAppVersion({

     this.android,

     this.ios,
  });

  @JsonKey(
    
    name: r'android',
    required: false,
    includeIfNull: false,
  )


  final String? android;



  @JsonKey(
    
    name: r'ios',
    required: false,
    includeIfNull: false,
  )


  final String? ios;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ConfigMinAppVersion &&
      other.android == android &&
      other.ios == ios;

    @override
    int get hashCode =>
        android.hashCode +
        ios.hashCode;

  factory ConfigMinAppVersion.fromJson(Map<String, dynamic> json) => _$ConfigMinAppVersionFromJson(json);

  Map<String, dynamic> toJson() => _$ConfigMinAppVersionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

