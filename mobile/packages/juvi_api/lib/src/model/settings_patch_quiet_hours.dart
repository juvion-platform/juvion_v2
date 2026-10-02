//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'settings_patch_quiet_hours.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SettingsPatchQuietHours {
  /// Returns a new [SettingsPatchQuietHours] instance.
  SettingsPatchQuietHours({

    required  this.end,

    required  this.start,
  });

  @JsonKey(
    
    name: r'end',
    required: true,
    includeIfNull: false,
  )


  final String end;



  @JsonKey(
    
    name: r'start',
    required: true,
    includeIfNull: false,
  )


  final String start;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SettingsPatchQuietHours &&
      other.end == end &&
      other.start == start;

    @override
    int get hashCode =>
        end.hashCode +
        start.hashCode;

  factory SettingsPatchQuietHours.fromJson(Map<String, dynamic> json) => _$SettingsPatchQuietHoursFromJson(json);

  Map<String, dynamic> toJson() => _$SettingsPatchQuietHoursToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

