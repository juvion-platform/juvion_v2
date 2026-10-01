// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ack_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AckResult _$AckResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AckResult', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'ackAt',
          'clientAt',
          'comment',
          'late',
          'method',
          'offline',
        ],
      );
      final val = AckResult(
        ackAt: $checkedConvert('ackAt', (v) => v as String),
        clientAt: $checkedConvert('clientAt', (v) => v as String?),
        comment: $checkedConvert('comment', (v) => v as String?),
        late_: $checkedConvert('late', (v) => v as bool),
        method: $checkedConvert(
          'method',
          (v) => $enumDecode(_$AckResultMethodEnumEnumMap, v),
        ),
        offline: $checkedConvert('offline', (v) => v as bool),
      );
      return val;
    }, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$AckResultToJson(AckResult instance) => <String, dynamic>{
  'ackAt': instance.ackAt,
  'clientAt': instance.clientAt,
  'comment': instance.comment,
  'late': instance.late_,
  'method': _$AckResultMethodEnumEnumMap[instance.method]!,
  'offline': instance.offline,
};

const _$AckResultMethodEnumEnumMap = {
  AckResultMethodEnum.hold: 'hold',
  AckResultMethodEnum.confirm: 'confirm',
};
