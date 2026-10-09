//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'notice_list_items_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeListItemsInner {
  /// Returns a new [NoticeListItemsInner] instance.
  NoticeListItemsInner({

    required  this.ackAt,

    required  this.ackCommentAllowed,

    required  this.ackRequired,

    required  this.archived,

    required  this.attachmentCount,

    required  this.audienceLine,

    required  this.deadline,

    required  this.id,

    required  this.isPublisher,

    required  this.late_,

    required  this.office,

    required  this.preview,

    required  this.priority,

    required  this.publishedAt,

    required  this.purpose,

    required  this.remindedAt,

    required  this.seenAt,

    required  this.state,

    required  this.title,
  });

  @JsonKey(
    
    name: r'ackAt',
    required: true,
    includeIfNull: true,
  )


  final String? ackAt;



  @JsonKey(
    
    name: r'ackCommentAllowed',
    required: true,
    includeIfNull: false,
  )


  final bool ackCommentAllowed;



  @JsonKey(
    
    name: r'ackRequired',
    required: true,
    includeIfNull: false,
  )


  final bool ackRequired;



  @JsonKey(
    
    name: r'archived',
    required: true,
    includeIfNull: false,
  )


  final bool archived;



  @JsonKey(
    
    name: r'attachmentCount',
    required: true,
    includeIfNull: false,
  )


  final int attachmentCount;



  @JsonKey(
    
    name: r'audienceLine',
    required: true,
    includeIfNull: false,
  )


  final String audienceLine;



  @JsonKey(
    
    name: r'deadline',
    required: true,
    includeIfNull: true,
  )


  final String? deadline;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'isPublisher',
    required: true,
    includeIfNull: false,
  )


  final bool isPublisher;



  @JsonKey(
    
    name: r'late',
    required: true,
    includeIfNull: false,
  )


  final bool late_;



  @JsonKey(
    
    name: r'office',
    required: true,
    includeIfNull: false,
  )


  final String office;



  @JsonKey(
    
    name: r'preview',
    required: true,
    includeIfNull: false,
  )


  final String preview;



  @JsonKey(
    
    name: r'priority',
    required: true,
    includeIfNull: false,
  )


  final NoticeListItemsInnerPriorityEnum priority;



  @JsonKey(
    
    name: r'publishedAt',
    required: true,
    includeIfNull: true,
  )


  final String? publishedAt;



  @JsonKey(
    
    name: r'purpose',
    required: true,
    includeIfNull: false,
  )


  final NoticeListItemsInnerPurposeEnum purpose;



  @JsonKey(
    
    name: r'remindedAt',
    required: true,
    includeIfNull: true,
  )


  final String? remindedAt;



  @JsonKey(
    
    name: r'seenAt',
    required: true,
    includeIfNull: true,
  )


  final String? seenAt;



  @JsonKey(
    
    name: r'state',
    required: true,
    includeIfNull: false,
  )


  final NoticeListItemsInnerStateEnum state;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeListItemsInner &&
      other.ackAt == ackAt &&
      other.ackCommentAllowed == ackCommentAllowed &&
      other.ackRequired == ackRequired &&
      other.archived == archived &&
      other.attachmentCount == attachmentCount &&
      other.audienceLine == audienceLine &&
      other.deadline == deadline &&
      other.id == id &&
      other.isPublisher == isPublisher &&
      other.late_ == late_ &&
      other.office == office &&
      other.preview == preview &&
      other.priority == priority &&
      other.publishedAt == publishedAt &&
      other.purpose == purpose &&
      other.remindedAt == remindedAt &&
      other.seenAt == seenAt &&
      other.state == state &&
      other.title == title;

    @override
    int get hashCode =>
        (ackAt == null ? 0 : ackAt.hashCode) +
        ackCommentAllowed.hashCode +
        ackRequired.hashCode +
        archived.hashCode +
        attachmentCount.hashCode +
        audienceLine.hashCode +
        (deadline == null ? 0 : deadline.hashCode) +
        id.hashCode +
        isPublisher.hashCode +
        late_.hashCode +
        office.hashCode +
        preview.hashCode +
        priority.hashCode +
        (publishedAt == null ? 0 : publishedAt.hashCode) +
        purpose.hashCode +
        (remindedAt == null ? 0 : remindedAt.hashCode) +
        (seenAt == null ? 0 : seenAt.hashCode) +
        state.hashCode +
        title.hashCode;

  factory NoticeListItemsInner.fromJson(Map<String, dynamic> json) => _$NoticeListItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeListItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum NoticeListItemsInnerPriorityEnum {
@JsonValue(r'routine')
routine(r'routine'),
@JsonValue(r'important')
important(r'important'),
@JsonValue(r'urgent')
urgent(r'urgent');

const NoticeListItemsInnerPriorityEnum(this.value);

final String value;

@override
String toString() => value;
}



enum NoticeListItemsInnerPurposeEnum {
@JsonValue(r'standard')
standard(r'standard'),
@JsonValue(r'welcome')
welcome(r'welcome');

const NoticeListItemsInnerPurposeEnum(this.value);

final String value;

@override
String toString() => value;
}



enum NoticeListItemsInnerStateEnum {
@JsonValue(r'received')
received(r'received'),
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'acknowledged')
acknowledged(r'acknowledged'),
@JsonValue(r'dismissed')
dismissed(r'dismissed');

const NoticeListItemsInnerStateEnum(this.value);

final String value;

@override
String toString() => value;
}


