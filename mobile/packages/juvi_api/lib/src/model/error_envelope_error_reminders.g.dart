// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_envelope_error_reminders.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorEnvelopeErrorReminders _$ErrorEnvelopeErrorRemindersFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ErrorEnvelopeErrorReminders', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['lastAt', 'max', 'used']);
  final val = ErrorEnvelopeErrorReminders(
    lastAt: $checkedConvert('lastAt', (v) => v as String?),
    max: $checkedConvert('max', (v) => (v as num).toInt()),
    used: $checkedConvert('used', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$ErrorEnvelopeErrorRemindersToJson(
  ErrorEnvelopeErrorReminders instance,
) => <String, dynamic>{
  'lastAt': instance.lastAt,
  'max': instance.max,
  'used': instance.used,
};
