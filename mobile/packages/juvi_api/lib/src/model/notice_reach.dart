//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/notice_reach_comments_inner.dart';
import 'package:juvi_api/src/model/notice_reach_groups_inner.dart';
import 'package:juvi_api/src/model/notice_reach_added_later.dart';
import 'package:juvi_api/src/model/error_envelope_error_reminders.dart';
import 'package:juvi_api/src/model/notice_reach_delivery.dart';
import 'package:juvi_api/src/model/notice_reach_late_acks_inner.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notice_reach.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NoticeReach {
  /// Returns a new [NoticeReach] instance.
  NoticeReach({

    required  this.ackRequired,

    required  this.acknowledged,

    required  this.addedLater,

    required  this.asOf,

    required  this.audience,

    required  this.comments,

    required  this.deadline,

    required  this.delivery,

    required  this.dismissed,

    required  this.groups,

    required  this.late_,

    required  this.lateAcks,

    required  this.notOnJuvi,

    required  this.notSeen,

    required  this.noticeId,

    required  this.publishedAt,

    required  this.reminders,

    required  this.seen,

    required  this.sparkline,

    required  this.status,

    required  this.title,
  });

  @JsonKey(
    
    name: r'ackRequired',
    required: true,
    includeIfNull: false,
  )


  final bool ackRequired;



  @JsonKey(
    
    name: r'acknowledged',
    required: true,
    includeIfNull: false,
  )


  final int acknowledged;



  @JsonKey(
    
    name: r'addedLater',
    required: true,
    includeIfNull: false,
  )


  final NoticeReachAddedLater addedLater;



  @JsonKey(
    
    name: r'asOf',
    required: true,
    includeIfNull: false,
  )


  final String asOf;



  @JsonKey(
    
    name: r'audience',
    required: true,
    includeIfNull: false,
  )


  final int audience;



  @JsonKey(
    
    name: r'comments',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeReachCommentsInner> comments;



  @JsonKey(
    
    name: r'deadline',
    required: true,
    includeIfNull: true,
  )


  final String? deadline;



  @JsonKey(
    
    name: r'delivery',
    required: true,
    includeIfNull: false,
  )


  final NoticeReachDelivery delivery;



  @JsonKey(
    
    name: r'dismissed',
    required: true,
    includeIfNull: false,
  )


  final int dismissed;



  @JsonKey(
    
    name: r'groups',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeReachGroupsInner> groups;



  @JsonKey(
    
    name: r'late',
    required: true,
    includeIfNull: false,
  )


  final int late_;



  @JsonKey(
    
    name: r'lateAcks',
    required: true,
    includeIfNull: false,
  )


  final List<NoticeReachLateAcksInner> lateAcks;



  @JsonKey(
    
    name: r'notOnJuvi',
    required: true,
    includeIfNull: false,
  )


  final int notOnJuvi;



  @JsonKey(
    
    name: r'notSeen',
    required: true,
    includeIfNull: false,
  )


  final int notSeen;



  @JsonKey(
    
    name: r'noticeId',
    required: true,
    includeIfNull: false,
  )


  final String noticeId;



  @JsonKey(
    
    name: r'publishedAt',
    required: true,
    includeIfNull: true,
  )


  final String? publishedAt;



  @JsonKey(
    
    name: r'reminders',
    required: true,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorReminders reminders;



  @JsonKey(
    
    name: r'seen',
    required: true,
    includeIfNull: false,
  )


  final int seen;



  @JsonKey(
    
    name: r'sparkline',
    required: true,
    includeIfNull: false,
  )


  final List<int> sparkline;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final NoticeReachStatusEnum status;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;





    @override
    bool operator ==(Object other) => identical(this, other) || other is NoticeReach &&
      other.ackRequired == ackRequired &&
      other.acknowledged == acknowledged &&
      other.addedLater == addedLater &&
      other.asOf == asOf &&
      other.audience == audience &&
      other.comments == comments &&
      other.deadline == deadline &&
      other.delivery == delivery &&
      other.dismissed == dismissed &&
      other.groups == groups &&
      other.late_ == late_ &&
      other.lateAcks == lateAcks &&
      other.notOnJuvi == notOnJuvi &&
      other.notSeen == notSeen &&
      other.noticeId == noticeId &&
      other.publishedAt == publishedAt &&
      other.reminders == reminders &&
      other.seen == seen &&
      other.sparkline == sparkline &&
      other.status == status &&
      other.title == title;

    @override
    int get hashCode =>
        ackRequired.hashCode +
        acknowledged.hashCode +
        addedLater.hashCode +
        asOf.hashCode +
        audience.hashCode +
        comments.hashCode +
        (deadline == null ? 0 : deadline.hashCode) +
        delivery.hashCode +
        dismissed.hashCode +
        groups.hashCode +
        late_.hashCode +
        lateAcks.hashCode +
        notOnJuvi.hashCode +
        notSeen.hashCode +
        noticeId.hashCode +
        (publishedAt == null ? 0 : publishedAt.hashCode) +
        reminders.hashCode +
        seen.hashCode +
        sparkline.hashCode +
        status.hashCode +
        title.hashCode;

  factory NoticeReach.fromJson(Map<String, dynamic> json) => _$NoticeReachFromJson(json);

  Map<String, dynamic> toJson() => _$NoticeReachToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum NoticeReachStatusEnum {
@JsonValue(r'publishing')
publishing(r'publishing'),
@JsonValue(r'published')
published(r'published'),
@JsonValue(r'archived')
archived(r'archived');

const NoticeReachStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


