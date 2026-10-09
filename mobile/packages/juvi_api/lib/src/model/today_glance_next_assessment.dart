//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'today_glance_next_assessment.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TodayGlanceNextAssessment {
  /// Returns a new [TodayGlanceNextAssessment] instance.
  TodayGlanceNextAssessment({

    required  this.at,

     this.channelId,

    required  this.courseCode,

    required  this.offeringId,

    required  this.title,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: false,
  )


  final String at;



  @JsonKey(
    
    name: r'channelId',
    required: false,
    includeIfNull: false,
  )


  final String? channelId;



  @JsonKey(
    
    name: r'courseCode',
    required: true,
    includeIfNull: false,
  )


  final String courseCode;



  @JsonKey(
    
    name: r'offeringId',
    required: true,
    includeIfNull: false,
  )


  final String offeringId;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TodayGlanceNextAssessment &&
      other.at == at &&
      other.channelId == channelId &&
      other.courseCode == courseCode &&
      other.offeringId == offeringId &&
      other.title == title;

    @override
    int get hashCode =>
        at.hashCode +
        channelId.hashCode +
        courseCode.hashCode +
        offeringId.hashCode +
        title.hashCode;

  factory TodayGlanceNextAssessment.fromJson(Map<String, dynamic> json) => _$TodayGlanceNextAssessmentFromJson(json);

  Map<String, dynamic> toJson() => _$TodayGlanceNextAssessmentToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

