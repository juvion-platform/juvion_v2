import 'package:juvi_api/src/model/ack_request.dart';
import 'package:juvi_api/src/model/ack_result.dart';
import 'package:juvi_api/src/model/attention.dart';
import 'package:juvi_api/src/model/attention_items_inner.dart';
import 'package:juvi_api/src/model/change_password_request.dart';
import 'package:juvi_api/src/model/channel_detail.dart';
import 'package:juvi_api/src/model/channel_detail_linked_object.dart';
import 'package:juvi_api/src/model/config.dart';
import 'package:juvi_api/src/model/config_feature_flags.dart';
import 'package:juvi_api/src/model/config_min_app_version.dart';
import 'package:juvi_api/src/model/config_quiet_hours_default.dart';
import 'package:juvi_api/src/model/config_support_contact.dart';
import 'package:juvi_api/src/model/devices.dart';
import 'package:juvi_api/src/model/devices_items_inner.dart';
import 'package:juvi_api/src/model/dismiss_result.dart';
import 'package:juvi_api/src/model/error_envelope.dart';
import 'package:juvi_api/src/model/error_envelope_error.dart';
import 'package:juvi_api/src/model/error_envelope_error_ack.dart';
import 'package:juvi_api/src/model/error_envelope_error_reminders.dart';
import 'package:juvi_api/src/model/events_request.dart';
import 'package:juvi_api/src/model/events_request_events_inner.dart';
import 'package:juvi_api/src/model/events_result.dart';
import 'package:juvi_api/src/model/institution_lookup.dart';
import 'package:juvi_api/src/model/me.dart';
import 'package:juvi_api/src/model/me_account.dart';
import 'package:juvi_api/src/model/me_faculty.dart';
import 'package:juvi_api/src/model/me_institution.dart';
import 'package:juvi_api/src/model/me_person.dart';
import 'package:juvi_api/src/model/me_settings.dart';
import 'package:juvi_api/src/model/me_settings_quiet_hours.dart';
import 'package:juvi_api/src/model/me_settings_tiers.dart';
import 'package:juvi_api/src/model/me_student.dart';
import 'package:juvi_api/src/model/mute_result.dart';
import 'package:juvi_api/src/model/notice_attachment.dart';
import 'package:juvi_api/src/model/notice_attachment_url.dart';
import 'package:juvi_api/src/model/notice_card.dart';
import 'package:juvi_api/src/model/notice_detail.dart';
import 'package:juvi_api/src/model/notice_detail_attachments_inner.dart';
import 'package:juvi_api/src/model/notice_list.dart';
import 'package:juvi_api/src/model/notice_pending.dart';
import 'package:juvi_api/src/model/notice_pending_groups_inner.dart';
import 'package:juvi_api/src/model/notice_pending_items_inner.dart';
import 'package:juvi_api/src/model/notice_reach.dart';
import 'package:juvi_api/src/model/notice_reach_added_later.dart';
import 'package:juvi_api/src/model/notice_reach_added_later_items_inner.dart';
import 'package:juvi_api/src/model/notice_reach_comments_inner.dart';
import 'package:juvi_api/src/model/notice_reach_groups_inner.dart';
import 'package:juvi_api/src/model/notice_reach_late_acks_inner.dart';
import 'package:juvi_api/src/model/notice_reminders.dart';
import 'package:juvi_api/src/model/onboarding_advance.dart';
import 'package:juvi_api/src/model/onboarding_state.dart';
import 'package:juvi_api/src/model/pending_person.dart';
import 'package:juvi_api/src/model/photo_result.dart';
import 'package:juvi_api/src/model/push_token_request.dart';
import 'package:juvi_api/src/model/reach_comment.dart';
import 'package:juvi_api/src/model/reach_group.dart';
import 'package:juvi_api/src/model/reach_person.dart';
import 'package:juvi_api/src/model/read_result.dart';
import 'package:juvi_api/src/model/receipts_request.dart';
import 'package:juvi_api/src/model/receipts_request_items_inner.dart';
import 'package:juvi_api/src/model/receipts_result.dart';
import 'package:juvi_api/src/model/refresh_request.dart';
import 'package:juvi_api/src/model/remind_result.dart';
import 'package:juvi_api/src/model/revoked_count.dart';
import 'package:juvi_api/src/model/seen_result.dart';
import 'package:juvi_api/src/model/settings.dart';
import 'package:juvi_api/src/model/settings_patch.dart';
import 'package:juvi_api/src/model/settings_patch_quiet_hours.dart';
import 'package:juvi_api/src/model/settings_patch_tiers.dart';
import 'package:juvi_api/src/model/sign_in_request.dart';
import 'package:juvi_api/src/model/sign_in_request_device.dart';
import 'package:juvi_api/src/model/sign_in_response.dart';
import 'package:juvi_api/src/model/spaces.dart';
import 'package:juvi_api/src/model/spaces_groups_inner.dart';
import 'package:juvi_api/src/model/spaces_groups_inner_channels_inner.dart';
import 'package:juvi_api/src/model/tokens.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

  ReturnType deserialize<ReturnType, BaseType>(dynamic value, String targetType, {bool growable= true}) {
      switch (targetType) {
        case 'String':
          return '$value' as ReturnType;
        case 'int':
          return (value is int ? value : int.parse('$value')) as ReturnType;
        case 'bool':
          if (value is bool) {
            return value as ReturnType;
          }
          final valueString = '$value'.toLowerCase();
          return (valueString == 'true' || valueString == '1') as ReturnType;
        case 'double':
          return (value is double ? value : double.parse('$value')) as ReturnType;
        case 'AckRequest':
          return AckRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'AckResult':
          return AckResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Attention':
          return Attention.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'AttentionItemsInner':
          return AttentionItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ChangePasswordRequest':
          return ChangePasswordRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ChannelDetail':
          return ChannelDetail.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ChannelDetailLinkedObject':
          return ChannelDetailLinkedObject.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Config':
          return Config.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ConfigFeatureFlags':
          return ConfigFeatureFlags.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ConfigMinAppVersion':
          return ConfigMinAppVersion.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ConfigQuietHoursDefault':
          return ConfigQuietHoursDefault.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ConfigSupportContact':
          return ConfigSupportContact.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Devices':
          return Devices.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'DevicesItemsInner':
          return DevicesItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'DismissResult':
          return DismissResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ErrorEnvelope':
          return ErrorEnvelope.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ErrorEnvelopeError':
          return ErrorEnvelopeError.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ErrorEnvelopeErrorAck':
          return ErrorEnvelopeErrorAck.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ErrorEnvelopeErrorReminders':
          return ErrorEnvelopeErrorReminders.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'EventsRequest':
          return EventsRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'EventsRequestEventsInner':
          return EventsRequestEventsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'EventsResult':
          return EventsResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'InstitutionLookup':
          return InstitutionLookup.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Me':
          return Me.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeAccount':
          return MeAccount.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeFaculty':
          return MeFaculty.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeInstitution':
          return MeInstitution.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MePerson':
          return MePerson.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSettings':
          return MeSettings.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSettingsQuietHours':
          return MeSettingsQuietHours.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeSettingsTiers':
          return MeSettingsTiers.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MeStudent':
          return MeStudent.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MuteResult':
          return MuteResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeAttachment':
          return NoticeAttachment.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeAttachmentUrl':
          return NoticeAttachmentUrl.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeCard':
          return NoticeCard.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeDetail':
          return NoticeDetail.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeDetailAttachmentsInner':
          return NoticeDetailAttachmentsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeList':
          return NoticeList.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticePending':
          return NoticePending.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticePendingGroupsInner':
          return NoticePendingGroupsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticePendingItemsInner':
          return NoticePendingItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReach':
          return NoticeReach.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReachAddedLater':
          return NoticeReachAddedLater.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReachAddedLaterItemsInner':
          return NoticeReachAddedLaterItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReachCommentsInner':
          return NoticeReachCommentsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReachGroupsInner':
          return NoticeReachGroupsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReachLateAcksInner':
          return NoticeReachLateAcksInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'NoticeReminders':
          return NoticeReminders.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'OnboardingAdvance':
          return OnboardingAdvance.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'OnboardingState':
          return OnboardingState.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PendingPerson':
          return PendingPerson.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PhotoResult':
          return PhotoResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PushTokenRequest':
          return PushTokenRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReachComment':
          return ReachComment.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReachGroup':
          return ReachGroup.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReachPerson':
          return ReachPerson.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReadResult':
          return ReadResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReceiptsRequest':
          return ReceiptsRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReceiptsRequestItemsInner':
          return ReceiptsRequestItemsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ReceiptsResult':
          return ReceiptsResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RefreshRequest':
          return RefreshRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RemindResult':
          return RemindResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RevokedCount':
          return RevokedCount.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SeenResult':
          return SeenResult.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Settings':
          return Settings.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SettingsPatch':
          return SettingsPatch.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SettingsPatchQuietHours':
          return SettingsPatchQuietHours.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SettingsPatchTiers':
          return SettingsPatchTiers.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInRequest':
          return SignInRequest.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInRequestDevice':
          return SignInRequestDevice.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SignInResponse':
          return SignInResponse.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Spaces':
          return Spaces.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SpacesGroupsInner':
          return SpacesGroupsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SpacesGroupsInnerChannelsInner':
          return SpacesGroupsInnerChannelsInner.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Tokens':
          return Tokens.fromJson(value as Map<String, dynamic>) as ReturnType;
        default:
          RegExpMatch? match;

          if (value is List && (match = _regList.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toList(growable: growable) as ReturnType;
          }
          if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toSet() as ReturnType;
          }
          if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
            targetType = match![1]!.trim(); // ignore: parameter_assignments
            return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable)),
            ) as ReturnType;
          }
          break;
    }
    throw Exception('Cannot deserialize');
  }