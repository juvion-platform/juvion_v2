// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_attachment_url.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeAttachmentUrl _$NoticeAttachmentUrlFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeAttachmentUrl', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['expiresAt', 'url']);
      final val = NoticeAttachmentUrl(
        expiresAt: $checkedConvert('expiresAt', (v) => v as String),
        url: $checkedConvert('url', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$NoticeAttachmentUrlToJson(
  NoticeAttachmentUrl instance,
) => <String, dynamic>{'expiresAt': instance.expiresAt, 'url': instance.url};
