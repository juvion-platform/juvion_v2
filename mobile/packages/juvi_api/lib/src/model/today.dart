//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/today_glance.dart';
import 'package:juvi_api/src/model/day_view.dart';
import 'package:json_annotation/json_annotation.dart';

part 'today.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Today {
  /// Returns a new [Today] instance.
  Today({

    required  this.asOf,

    required  this.glance,

    required  this.today,

    required  this.tomorrow,
  });

  @JsonKey(
    
    name: r'asOf',
    required: true,
    includeIfNull: false,
  )


  final String asOf;



  @JsonKey(
    
    name: r'glance',
    required: true,
    includeIfNull: false,
  )


  final TodayGlance glance;



  @JsonKey(
    
    name: r'today',
    required: true,
    includeIfNull: false,
  )


  final DayView today;



  @JsonKey(
    
    name: r'tomorrow',
    required: true,
    includeIfNull: false,
  )


  final DayView tomorrow;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Today &&
      other.asOf == asOf &&
      other.glance == glance &&
      other.today == today &&
      other.tomorrow == tomorrow;

    @override
    int get hashCode =>
        asOf.hashCode +
        glance.hashCode +
        today.hashCode +
        tomorrow.hashCode;

  factory Today.fromJson(Map<String, dynamic> json) => _$TodayFromJson(json);

  Map<String, dynamic> toJson() => _$TodayToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

