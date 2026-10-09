//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'events_request_events_inner.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EventsRequestEventsInner {
  /// Returns a new [EventsRequestEventsInner] instance.
  EventsRequestEventsInner({

    required  this.at,

    required  this.name,

     this.props,
  });

  @JsonKey(
    
    name: r'at',
    required: true,
    includeIfNull: false,
  )


  final DateTime at;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final EventsRequestEventsInnerNameEnum name;



      /// Up to 10 keys, 1 KB serialised; each value a string of at most 64 characters matching ^[A-Za-z0-9_.:-]*$, a number or a boolean.
  @JsonKey(
    
    name: r'props',
    required: false,
    includeIfNull: false,
  )


  final Map<String, Object>? props;





    @override
    bool operator ==(Object other) => identical(this, other) || other is EventsRequestEventsInner &&
      other.at == at &&
      other.name == name &&
      other.props == props;

    @override
    int get hashCode =>
        at.hashCode +
        name.hashCode +
        props.hashCode;

  factory EventsRequestEventsInner.fromJson(Map<String, dynamic> json) => _$EventsRequestEventsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$EventsRequestEventsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum EventsRequestEventsInnerNameEnum {
@JsonValue(r'app.opened')
appPeriodOpened(r'app.opened'),
@JsonValue(r'account.signed_in')
accountPeriodSignedIn(r'account.signed_in'),
@JsonValue(r'onboarding.step_completed')
onboardingPeriodStepCompleted(r'onboarding.step_completed'),
@JsonValue(r'onboarding.completed')
onboardingPeriodCompleted(r'onboarding.completed'),
@JsonValue(r'settings.changed')
settingsPeriodChanged(r'settings.changed'),
@JsonValue(r'channel.muted')
channelPeriodMuted(r'channel.muted'),
@JsonValue(r'notice.seen')
noticePeriodSeen(r'notice.seen'),
@JsonValue(r'notice.acknowledged')
noticePeriodAcknowledged(r'notice.acknowledged'),
@JsonValue(r'notice.dismissed')
noticePeriodDismissed(r'notice.dismissed'),
@JsonValue(r'notification.opened')
notificationPeriodOpened(r'notification.opened'),
@JsonValue(r'notification.permission')
notificationPeriodPermission(r'notification.permission'),
@JsonValue(r'permission_card.shown')
permissionCardPeriodShown(r'permission_card.shown'),
@JsonValue(r'permission_card.dismissed')
permissionCardPeriodDismissed(r'permission_card.dismissed'),
@JsonValue(r'timeline.class_opened')
timelinePeriodClassOpened(r'timeline.class_opened'),
@JsonValue(r'glance.opened')
glancePeriodOpened(r'glance.opened'),
@JsonValue(r'post_class_prompt.shown')
postClassPromptPeriodShown(r'post_class_prompt.shown'),
@JsonValue(r'post_class_prompt.opened')
postClassPromptPeriodOpened(r'post_class_prompt.opened');

const EventsRequestEventsInnerNameEnum(this.value);

final String value;

@override
String toString() => value;
}


