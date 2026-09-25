//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'config_quiet_hours_default.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfigQuietHoursDefault {
  /// Returns a new [ConfigQuietHoursDefault] instance.
  ConfigQuietHoursDefault({

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
    bool operator ==(Object other) => identical(this, other) || other is ConfigQuietHoursDefault &&
      other.end == end &&
      other.start == start;

    @override
    int get hashCode =>
        end.hashCode +
        start.hashCode;

  factory ConfigQuietHoursDefault.fromJson(Map<String, dynamic> json) => _$ConfigQuietHoursDefaultFromJson(json);

  Map<String, dynamic> toJson() => _$ConfigQuietHoursDefaultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

