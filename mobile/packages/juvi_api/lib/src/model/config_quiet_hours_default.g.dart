// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_quiet_hours_default.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConfigQuietHoursDefault _$ConfigQuietHoursDefaultFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ConfigQuietHoursDefault', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['end', 'start']);
  final val = ConfigQuietHoursDefault(
    end: $checkedConvert('end', (v) => v as String),
    start: $checkedConvert('start', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ConfigQuietHoursDefaultToJson(
  ConfigQuietHoursDefault instance,
) => <String, dynamic>{'end': instance.end, 'start': instance.start};
