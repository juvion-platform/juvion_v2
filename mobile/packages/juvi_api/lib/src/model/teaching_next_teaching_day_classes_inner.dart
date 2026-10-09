//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/day_class_moved_from.dart';
import 'package:json_annotation/json_annotation.dart';

part 'teaching_next_teaching_day_classes_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TeachingNextTeachingDayClassesInner {
  /// Returns a new [TeachingNextTeachingDayClassesInner] instance.
  TeachingNextTeachingDayClassesInner({

     this.channelId,

    required  this.courseCode,

    required  this.end,

     this.faculty,

     this.movedFrom,

    required  this.offeringId,

     this.registered,

     this.room,

    required  this.section,

    required  this.slotType,

    required  this.start,

    required  this.status,

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
    
    name: r'end',
    required: true,
    includeIfNull: false,
  )


  final String end;



  @JsonKey(
    
    name: r'faculty',
    required: false,
    includeIfNull: false,
  )


  final String? faculty;



  @JsonKey(
    
    name: r'movedFrom',
    required: false,
    includeIfNull: false,
  )


  final DayClassMovedFrom? movedFrom;



  @JsonKey(
    
    name: r'offeringId',
    required: true,
    includeIfNull: false,
  )


  final String offeringId;



  @JsonKey(
    
    name: r'registered',
    required: false,
    includeIfNull: false,
  )


  final int? registered;



  @JsonKey(
    
    name: r'room',
    required: false,
    includeIfNull: false,
  )


  final String? room;



  @JsonKey(
    
    name: r'section',
    required: true,
    includeIfNull: false,
  )


  final String section;



  @JsonKey(
    
    name: r'slotType',
    required: true,
    includeIfNull: false,
  )


  final String slotType;



  @JsonKey(
    
    name: r'start',
    required: true,
    includeIfNull: false,
  )


  final String start;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final TeachingNextTeachingDayClassesInnerStatusEnum status;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TeachingNextTeachingDayClassesInner &&
      other.channelId == channelId &&
      other.courseCode == courseCode &&
      other.end == end &&
      other.faculty == faculty &&
      other.movedFrom == movedFrom &&
      other.offeringId == offeringId &&
      other.registered == registered &&
      other.room == room &&
      other.section == section &&
      other.slotType == slotType &&
      other.start == start &&
      other.status == status &&
      other.title == title;

    @override
    int get hashCode =>
        channelId.hashCode +
        courseCode.hashCode +
        end.hashCode +
        faculty.hashCode +
        movedFrom.hashCode +
        offeringId.hashCode +
        registered.hashCode +
        room.hashCode +
        section.hashCode +
        slotType.hashCode +
        start.hashCode +
        status.hashCode +
        title.hashCode;

  factory TeachingNextTeachingDayClassesInner.fromJson(Map<String, dynamic> json) => _$TeachingNextTeachingDayClassesInnerFromJson(json);

  Map<String, dynamic> toJson() => _$TeachingNextTeachingDayClassesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum TeachingNextTeachingDayClassesInnerStatusEnum {
@JsonValue(r'cancelled')
cancelled(r'cancelled'),
@JsonValue(r'rescheduled')
rescheduled(r'rescheduled'),
@JsonValue(r'scheduled')
scheduled(r'scheduled');

const TeachingNextTeachingDayClassesInnerStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


