// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'remind_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RemindResult _$RemindResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RemindResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['reminders']);
      final val = RemindResult(
        reminders: $checkedConvert(
          'reminders',
          (v) =>
              ErrorEnvelopeErrorReminders.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RemindResultToJson(RemindResult instance) =>
    <String, dynamic>{'reminders': instance.reminders.toJson()};
