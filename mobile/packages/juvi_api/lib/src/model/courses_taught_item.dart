//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'courses_taught_item.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CoursesTaughtItem {
  /// Returns a new [CoursesTaughtItem] instance.
  CoursesTaughtItem({

     this.channelId,

    required  this.courseCode,

    required  this.offeringId,

    required  this.section,

    required  this.title,
  });

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
    
    name: r'section',
    required: true,
    includeIfNull: false,
  )


  final String section;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CoursesTaughtItem &&
      other.channelId == channelId &&
      other.courseCode == courseCode &&
      other.offeringId == offeringId &&
      other.section == section &&
      other.title == title;

    @override
    int get hashCode =>
        channelId.hashCode +
        courseCode.hashCode +
        offeringId.hashCode +
        section.hashCode +
        title.hashCode;

  factory CoursesTaughtItem.fromJson(Map<String, dynamic> json) => _$CoursesTaughtItemFromJson(json);

  Map<String, dynamic> toJson() => _$CoursesTaughtItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

