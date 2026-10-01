// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reminders.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReminders _$NoticeRemindersFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticeReminders', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['lastAt', 'max', 'used']);
      final val = NoticeReminders(
        lastAt: $checkedConvert('lastAt', (v) => v as String?),
        max: $checkedConvert('max', (v) => (v as num).toInt()),
        used: $checkedConvert('used', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$NoticeRemindersToJson(NoticeReminders instance) =>
    <String, dynamic>{
      'lastAt': instance.lastAt,
      'max': instance.max,
      'used': instance.used,
    };
