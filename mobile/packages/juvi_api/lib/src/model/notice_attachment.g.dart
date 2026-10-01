// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_attachment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeAttachment _$NoticeAttachmentFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeAttachment', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'mime', 'name', 'size']);
      final val = NoticeAttachment(
        key: $checkedConvert('key', (v) => v as String),
        mime: $checkedConvert('mime', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        size: $checkedConvert('size', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$NoticeAttachmentToJson(NoticeAttachment instance) =>
    <String, dynamic>{
      'key': instance.key,
      'mime': instance.mime,
      'name': instance.name,
      'size': instance.size,
    };
