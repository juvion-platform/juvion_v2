//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'error_envelope_error_reminders.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ErrorEnvelopeErrorReminders {
  /// Returns a new [ErrorEnvelopeErrorReminders] instance.
  ErrorEnvelopeErrorReminders({

    required  this.lastAt,

    required  this.max,

    required  this.used,
  });

  @JsonKey(
    
    name: r'lastAt',
    required: true,
    includeIfNull: true,
  )


  final String? lastAt;



  @JsonKey(
    
    name: r'max',
    required: true,
    includeIfNull: false,
  )


  final int max;



  @JsonKey(
    
    name: r'used',
    required: true,
    includeIfNull: false,
  )


  final int used;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ErrorEnvelopeErrorReminders &&
      other.lastAt == lastAt &&
      other.max == max &&
      other.used == used;

    @override
    int get hashCode =>
        (lastAt == null ? 0 : lastAt.hashCode) +
        max.hashCode +
        used.hashCode;

  factory ErrorEnvelopeErrorReminders.fromJson(Map<String, dynamic> json) => _$ErrorEnvelopeErrorRemindersFromJson(json);

  Map<String, dynamic> toJson() => _$ErrorEnvelopeErrorRemindersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

