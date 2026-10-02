// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_reach_delivery_suppressed.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticeReachDeliverySuppressed _$NoticeReachDeliverySuppressedFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('NoticeReachDeliverySuppressed', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['muted', 'noDevice', 'tierOff']);
  final val = NoticeReachDeliverySuppressed(
    muted: $checkedConvert('muted', (v) => (v as num).toInt()),
    noDevice: $checkedConvert('noDevice', (v) => (v as num).toInt()),
    tierOff: $checkedConvert('tierOff', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$NoticeReachDeliverySuppressedToJson(
  NoticeReachDeliverySuppressed instance,
) => <String, dynamic>{
  'muted': instance.muted,
  'noDevice': instance.noDevice,
  'tierOff': instance.tierOff,
};
