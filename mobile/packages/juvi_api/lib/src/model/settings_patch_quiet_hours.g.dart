// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_patch_quiet_hours.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SettingsPatchQuietHours _$SettingsPatchQuietHoursFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SettingsPatchQuietHours', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['end', 'start']);
  final val = SettingsPatchQuietHours(
    end: $checkedConvert('end', (v) => v as String),
    start: $checkedConvert('start', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$SettingsPatchQuietHoursToJson(
  SettingsPatchQuietHours instance,
) => <String, dynamic>{'end': instance.end, 'start': instance.start};
