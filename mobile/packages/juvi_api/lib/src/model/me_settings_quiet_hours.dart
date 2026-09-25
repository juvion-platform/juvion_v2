//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'me_settings_quiet_hours.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeSettingsQuietHours {
  /// Returns a new [MeSettingsQuietHours] instance.
  MeSettingsQuietHours({

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
    bool operator ==(Object other) => identical(this, other) || other is MeSettingsQuietHours &&
      other.end == end &&
      other.start == start;

    @override
    int get hashCode =>
        end.hashCode +
        start.hashCode;

  factory MeSettingsQuietHours.fromJson(Map<String, dynamic> json) => _$MeSettingsQuietHoursFromJson(json);

  Map<String, dynamic> toJson() => _$MeSettingsQuietHoursToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

