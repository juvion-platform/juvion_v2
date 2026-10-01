//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_reminders.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReminders {
  /// Returns a new [NoticeReminders] instance.
  NoticeReminders({

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
    bool operator ==(Object other) => identical(this, other) || other is NoticeReminders &&
      other.lastAt == lastAt &&
      other.max == max &&
      other.used == used;

    @override
    int get hashCode =>
        (lastAt == null ? 0 : lastAt.hashCode) +
        max.hashCode +
        used.hashCode;

  factory NoticeReminders.fromJson(Map<String, dynamic> json) => _$NoticeRemindersFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeRemindersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

