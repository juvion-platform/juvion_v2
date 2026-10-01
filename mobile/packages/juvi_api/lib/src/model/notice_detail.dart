//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_detail_attachments_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_detail.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeDetail {
  /// Returns a new [NoticeDetail] instance.
  NoticeDetail({

    required  this.ackAt,

    required  this.ackClientAt,

    required  this.ackComment,

    required  this.ackCommentAllowed,

    required  this.ackMethod,

    required  this.ackOffline,

    required  this.ackRequired,

    required  this.archived,

    required  this.attachmentCount,

    required  this.attachments,

    required  this.audienceLine,

    required  this.body,

    required  this.deadline,

    required  this.dismissedAt,

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
    
    name: r'ackClientAt',
    required: true,
    includeIfNull: true,
  )


  final String? ackClientAt;



  @JsonKey(
    
    name: r'ackComment',
    required: true,
    includeIfNull: true,
  )


  final String? ackComment;



  @JsonKey(
    
    name: r'ackCommentAllowed',
    required: true,
    includeIfNull: false,
  )


  final bool ackCommentAllowed;



  @JsonKey(
    
    name: r'ackMethod',
    required: true,
    includeIfNull: true,
  )


  final NoticeDetailAckMethodEnum? ackMethod;



  @JsonKey(
    
    name: r'ackOffline',
    required: true,
    includeIfNull: false,
  )


  final bool ackOffline;



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
    
    name: r'attachments',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeDetailAttachmentsInner> attachments;



  @JsonKey(
    
    name: r'audienceLine',
    required: true,
    includeIfNull: false,
  )


  final String audienceLine;



  @JsonKey(
    
    name: r'body',
    required: true,
    includeIfNull: false,
  )


  final String body;



  @JsonKey(
    
    name: r'deadline',
    required: true,
    includeIfNull: true,
  )


  final String? deadline;



  @JsonKey(
    
    name: r'dismissedAt',
    required: true,
    includeIfNull: true,
  )


  final String? dismissedAt;



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


  final NoticeDetailPriorityEnum priority;



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


  final NoticeDetailPurposeEnum purpose;



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


  final NoticeDetailStateEnum state;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeDetail &&
      other.ackAt == ackAt &&
      other.ackClientAt == ackClientAt &&
      other.ackComment == ackComment &&
      other.ackCommentAllowed == ackCommentAllowed &&
      other.ackMethod == ackMethod &&
      other.ackOffline == ackOffline &&
      other.ackRequired == ackRequired &&
      other.archived == archived &&
      other.attachmentCount == attachmentCount &&
      other.attachments == attachments &&
      other.audienceLine == audienceLine &&
      other.body == body &&
      other.deadline == deadline &&
      other.dismissedAt == dismissedAt &&
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
        (ackClientAt == null ? 0 : ackClientAt.hashCode) +
        (ackComment == null ? 0 : ackComment.hashCode) +
        ackCommentAllowed.hashCode +
        (ackMethod == null ? 0 : ackMethod.hashCode) +
        ackOffline.hashCode +
        ackRequired.hashCode +
        archived.hashCode +
        attachmentCount.hashCode +
        attachments.hashCode +
        audienceLine.hashCode +
        body.hashCode +
        (deadline == null ? 0 : deadline.hashCode) +
        (dismissedAt == null ? 0 : dismissedAt.hashCode) +
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

  factory NoticeDetail.fromJson(Map<String, dynamic> json) => _$NoticeDetailFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum NoticeDetailAckMethodEnum {
@JsonValue(r'hold')
hold(r'hold'),
@JsonValue(r'confirm')
confirm(r'confirm');

const NoticeDetailAckMethodEnum(this.value);

final String value;

@override
String toString() => value;
}



enum NoticeDetailPriorityEnum {
@JsonValue(r'routine')
routine(r'routine'),
@JsonValue(r'important')
important(r'important'),
@JsonValue(r'urgent')
urgent(r'urgent');

const NoticeDetailPriorityEnum(this.value);

final String value;

@override
String toString() => value;
}



enum NoticeDetailPurposeEnum {
@JsonValue(r'standard')
standard(r'standard'),
@JsonValue(r'welcome')
welcome(r'welcome');

const NoticeDetailPurposeEnum(this.value);

final String value;

@override
String toString() => value;
}



enum NoticeDetailStateEnum {
@JsonValue(r'received')
received(r'received'),
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'acknowledged')
acknowledged(r'acknowledged'),
@JsonValue(r'dismissed')
dismissed(r'dismissed');

const NoticeDetailStateEnum(this.value);

final String value;

@override
String toString() => value;
}


