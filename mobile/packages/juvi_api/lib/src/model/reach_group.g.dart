// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reach_group.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReachGroup _$ReachGroupFromJson(Map<String, dynamic> json) => $checkedCreate(
  'ReachGroup',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'acknowledged',
        'label',
        'notOnJuvi',
        'notSeen',
        'seen',
        'total',
      ],
    );
    final val = ReachGroup(
      acknowledged: $checkedConvert('acknowledged', (v) => (v as num).toInt()),
      label: $checkedConvert('label', (v) => v as String),
      notOnJuvi: $checkedConvert('notOnJuvi', (v) => (v as num).toInt()),
      notSeen: $checkedConvert('notSeen', (v) => (v as num).toInt()),
      seen: $checkedConvert('seen', (v) => (v as num).toInt()),
      total: $checkedConvert('total', (v) => (v as num).toInt()),
    );
    return val;
  },
);

Map<String, dynamic> _$ReachGroupToJson(ReachGroup instance) =>
    <String, dynamic>{
      'acknowledged': instance.acknowledged,
      'label': instance.label,
      'notOnJuvi': instance.notOnJuvi,
      'notSeen': instance.notSeen,
      'seen': instance.seen,
      'total': instance.total,
    };
