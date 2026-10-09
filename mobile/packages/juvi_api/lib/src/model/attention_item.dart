//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'attention_item.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AttentionItem {
  /// Returns a new [AttentionItem] instance.
  AttentionItem({

     this.ackAt,

     this.ackCommentAllowed,

     this.ackRequired,

     this.amount,

     this.archived,

     this.at,

     this.attachmentCount,

     this.audienceLine,

     this.channelId,

     this.courseCode,

     this.date,

     this.deadline,

     this.dueDate,

    required  this.id,

     this.invoiceNumber,

     this.isPublisher,

    required  this.kind,

     this.late_,

     this.newDate,

     this.newStart,

     this.offeringId,

     this.office,

     this.overdue,

     this.preview,

     this.priority,

     this.publishedAt,

     this.purpose,

     this.remindedAt,

     this.room,

     this.seenAt,

     this.start,

     this.state,

     this.title,

     this.type,
  });

  @JsonKey(
    
    name: r'ackAt',
    required: false,
    includeIfNull: false,
  )


  final String? ackAt;



  @JsonKey(
    
    name: r'ackCommentAllowed',
    required: false,
    includeIfNull: false,
  )


  final bool? ackCommentAllowed;



  @JsonKey(
    
    name: r'ackRequired',
    required: false,
    includeIfNull: false,
  )


  final bool? ackRequired;



  @JsonKey(
    
    name: r'amount',
    required: false,
    includeIfNull: false,
  )


  final int? amount;



  @JsonKey(
    
    name: r'archived',
    required: false,
    includeIfNull: false,
  )


  final bool? archived;



  @JsonKey(
    
    name: r'at',
    required: false,
    includeIfNull: false,
  )


  final String? at;



  @JsonKey(
    
    name: r'attachmentCount',
    required: false,
    includeIfNull: false,
  )


  final int? attachmentCount;



  @JsonKey(
    
    name: r'audienceLine',
    required: false,
    includeIfNull: false,
  )


  final String? audienceLine;



  @JsonKey(
    
    name: r'channelId',
    required: false,
    includeIfNull: false,
  )


  final String? channelId;



  @JsonKey(
    
    name: r'courseCode',
    required: false,
    includeIfNull: false,
  )


  final String? courseCode;



  @JsonKey(
    
    name: r'date',
    required: false,
    includeIfNull: false,
  )


  final String? date;



  @JsonKey(
    
    name: r'deadline',
    required: false,
    includeIfNull: false,
  )


  final String? deadline;



  @JsonKey(
    
    name: r'dueDate',
    required: false,
    includeIfNull: false,
  )


  final String? dueDate;



  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'invoiceNumber',
    required: false,
    includeIfNull: false,
  )


  final String? invoiceNumber;



  @JsonKey(
    
    name: r'isPublisher',
    required: false,
    includeIfNull: false,
  )


  final bool? isPublisher;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final AttentionItemKindEnum kind;



  @JsonKey(
    
    name: r'late',
    required: false,
    includeIfNull: false,
  )


  final bool? late_;



  @JsonKey(
    
    name: r'newDate',
    required: false,
    includeIfNull: false,
  )


  final String? newDate;



  @JsonKey(
    
    name: r'newStart',
    required: false,
    includeIfNull: false,
  )


  final String? newStart;



  @JsonKey(
    
    name: r'offeringId',
    required: false,
    includeIfNull: false,
  )


  final String? offeringId;



  @JsonKey(
    
    name: r'office',
    required: false,
    includeIfNull: false,
  )


  final String? office;



  @JsonKey(
    
    name: r'overdue',
    required: false,
    includeIfNull: false,
  )


  final bool? overdue;



  @JsonKey(
    
    name: r'preview',
    required: false,
    includeIfNull: false,
  )


  final String? preview;



  @JsonKey(
    
    name: r'priority',
    required: false,
    includeIfNull: false,
  )


  final AttentionItemPriorityEnum? priority;



  @JsonKey(
    
    name: r'publishedAt',
    required: false,
    includeIfNull: false,
  )


  final String? publishedAt;



  @JsonKey(
    
    name: r'purpose',
    required: false,
    includeIfNull: false,
  )


  final AttentionItemPurposeEnum? purpose;



  @JsonKey(
    
    name: r'remindedAt',
    required: false,
    includeIfNull: false,
  )


  final String? remindedAt;



  @JsonKey(
    
    name: r'room',
    required: false,
    includeIfNull: false,
  )


  final String? room;



  @JsonKey(
    
    name: r'seenAt',
    required: false,
    includeIfNull: false,
  )


  final String? seenAt;



  @JsonKey(
    
    name: r'start',
    required: false,
    includeIfNull: false,
  )


  final String? start;



  @JsonKey(
    
    name: r'state',
    required: false,
    includeIfNull: false,
  )


  final AttentionItemStateEnum? state;



  @JsonKey(
    
    name: r'title',
    required: false,
    includeIfNull: false,
  )


  final String? title;



  @JsonKey(
    
    name: r'type',
    required: false,
    includeIfNull: false,
  )


  final AttentionItemTypeEnum? type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is AttentionItem &&
      other.ackAt == ackAt &&
      other.ackCommentAllowed == ackCommentAllowed &&
      other.ackRequired == ackRequired &&
      other.amount == amount &&
      other.archived == archived &&
      other.at == at &&
      other.attachmentCount == attachmentCount &&
      other.audienceLine == audienceLine &&
      other.channelId == channelId &&
      other.courseCode == courseCode &&
      other.date == date &&
      other.deadline == deadline &&
      other.dueDate == dueDate &&
      other.id == id &&
      other.invoiceNumber == invoiceNumber &&
      other.isPublisher == isPublisher &&
      other.kind == kind &&
      other.late_ == late_ &&
      other.newDate == newDate &&
      other.newStart == newStart &&
      other.offeringId == offeringId &&
      other.office == office &&
      other.overdue == overdue &&
      other.preview == preview &&
      other.priority == priority &&
      other.publishedAt == publishedAt &&
      other.purpose == purpose &&
      other.remindedAt == remindedAt &&
      other.room == room &&
      other.seenAt == seenAt &&
      other.start == start &&
      other.state == state &&
      other.title == title &&
      other.type == type;

    @override
    int get hashCode =>
        (ackAt == null ? 0 : ackAt.hashCode) +
        ackCommentAllowed.hashCode +
        ackRequired.hashCode +
        amount.hashCode +
        archived.hashCode +
        at.hashCode +
        attachmentCount.hashCode +
        audienceLine.hashCode +
        channelId.hashCode +
        courseCode.hashCode +
        date.hashCode +
        (deadline == null ? 0 : deadline.hashCode) +
        dueDate.hashCode +
        id.hashCode +
        invoiceNumber.hashCode +
        isPublisher.hashCode +
        kind.hashCode +
        late_.hashCode +
        newDate.hashCode +
        newStart.hashCode +
        offeringId.hashCode +
        office.hashCode +
        overdue.hashCode +
        preview.hashCode +
        priority.hashCode +
        (publishedAt == null ? 0 : publishedAt.hashCode) +
        purpose.hashCode +
        (remindedAt == null ? 0 : remindedAt.hashCode) +
        room.hashCode +
        (seenAt == null ? 0 : seenAt.hashCode) +
        start.hashCode +
        state.hashCode +
        title.hashCode +
        type.hashCode;

  factory AttentionItem.fromJson(Map<String, dynamic> json) => _$AttentionItemFromJson(json);

  Map<String, dynamic> toJson() => _$AttentionItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum AttentionItemKindEnum {
@JsonValue(r'notice')
notice(r'notice'),
@JsonValue(r'class_change')
classChange(r'class_change'),
@JsonValue(r'fee_due')
feeDue(r'fee_due'),
@JsonValue(r'assessment')
assessment(r'assessment');

const AttentionItemKindEnum(this.value);

final String value;

@override
String toString() => value;
}



enum AttentionItemPriorityEnum {
@JsonValue(r'routine')
routine(r'routine'),
@JsonValue(r'important')
important(r'important'),
@JsonValue(r'urgent')
urgent(r'urgent');

const AttentionItemPriorityEnum(this.value);

final String value;

@override
String toString() => value;
}



enum AttentionItemPurposeEnum {
@JsonValue(r'standard')
standard(r'standard'),
@JsonValue(r'welcome')
welcome(r'welcome');

const AttentionItemPurposeEnum(this.value);

final String value;

@override
String toString() => value;
}



enum AttentionItemStateEnum {
@JsonValue(r'received')
received(r'received'),
@JsonValue(r'seen')
seen(r'seen'),
@JsonValue(r'acknowledged')
acknowledged(r'acknowledged'),
@JsonValue(r'dismissed')
dismissed(r'dismissed');

const AttentionItemStateEnum(this.value);

final String value;

@override
String toString() => value;
}



enum AttentionItemTypeEnum {
@JsonValue(r'cancelled')
cancelled(r'cancelled'),
@JsonValue(r'rescheduled')
rescheduled(r'rescheduled');

const AttentionItemTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


