// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me_settings_quiet_hours.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeSettingsQuietHours _$MeSettingsQuietHoursFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MeSettingsQuietHours', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['end', 'start']);
  final val = MeSettingsQuietHours(
    end: $checkedConvert('end', (v) => v as String),
    start: $checkedConvert('start', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$MeSettingsQuietHoursToJson(
  MeSettingsQuietHours instance,
) => <String, dynamic>{'end': instance.end, 'start': instance.start};
