// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'events_request_events_inner.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EventsRequestEventsInner _$EventsRequestEventsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EventsRequestEventsInner', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['at', 'name']);
  final val = EventsRequestEventsInner(
    at: $checkedConvert('at', (v) => DateTime.parse(v as String)),
    name: $checkedConvert(
      'name',
      (v) => $enumDecode(_$EventsRequestEventsInnerNameEnumEnumMap, v),
    ),
    props: $checkedConvert(
      'props',
      (v) =>
          (v as Map<String, dynamic>?)?.map((k, e) => MapEntry(k, e as Object)),
    ),
  );
  return val;
});

Map<String, dynamic> _$EventsRequestEventsInnerToJson(
  EventsRequestEventsInner instance,
) => <String, dynamic>{
  'at': instance.at.toIso8601String(),
  'name': _$EventsRequestEventsInnerNameEnumEnumMap[instance.name]!,
  'props': ?instance.props,
};

const _$EventsRequestEventsInnerNameEnumEnumMap = {
  EventsRequestEventsInnerNameEnum.appPeriodOpened: 'app.opened',
  EventsRequestEventsInnerNameEnum.accountPeriodSignedIn: 'account.signed_in',
  EventsRequestEventsInnerNameEnum.onboardingPeriodStepCompleted:
      'onboarding.step_completed',
  EventsRequestEventsInnerNameEnum.onboardingPeriodCompleted:
      'onboarding.completed',
  EventsRequestEventsInnerNameEnum.settingsPeriodChanged: 'settings.changed',
  EventsRequestEventsInnerNameEnum.channelPeriodMuted: 'channel.muted',
  EventsRequestEventsInnerNameEnum.noticePeriodSeen: 'notice.seen',
  EventsRequestEventsInnerNameEnum.noticePeriodAcknowledged:
      'notice.acknowledged',
  EventsRequestEventsInnerNameEnum.noticePeriodDismissed: 'notice.dismissed',
  EventsRequestEventsInnerNameEnum.notificationPeriodOpened:
      'notification.opened',
  EventsRequestEventsInnerNameEnum.notificationPeriodPermission:
      'notification.permission',
  EventsRequestEventsInnerNameEnum.permissionCardPeriodShown:
      'permission_card.shown',
  EventsRequestEventsInnerNameEnum.permissionCardPeriodDismissed:
      'permission_card.dismissed',
};
