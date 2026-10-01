// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_envelope_error_ack.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorEnvelopeErrorAck _$ErrorEnvelopeErrorAckFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ErrorEnvelopeErrorAck', json, ($checkedConvert) {
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
  final val = ErrorEnvelopeErrorAck(
    ackAt: $checkedConvert('ackAt', (v) => v as String),
    clientAt: $checkedConvert('clientAt', (v) => v as String?),
    comment: $checkedConvert('comment', (v) => v as String?),
    late_: $checkedConvert('late', (v) => v as bool),
    method: $checkedConvert(
      'method',
      (v) => $enumDecode(_$ErrorEnvelopeErrorAckMethodEnumEnumMap, v),
    ),
    offline: $checkedConvert('offline', (v) => v as bool),
  );
  return val;
}, fieldKeyMap: const {'late_': 'late'});

Map<String, dynamic> _$ErrorEnvelopeErrorAckToJson(
  ErrorEnvelopeErrorAck instance,
) => <String, dynamic>{
  'ackAt': instance.ackAt,
  'clientAt': instance.clientAt,
  'comment': instance.comment,
  'late': instance.late_,
  'method': _$ErrorEnvelopeErrorAckMethodEnumEnumMap[instance.method]!,
  'offline': instance.offline,
};

const _$ErrorEnvelopeErrorAckMethodEnumEnumMap = {
  ErrorEnvelopeErrorAckMethodEnum.hold: 'hold',
  ErrorEnvelopeErrorAckMethodEnum.confirm: 'confirm',
};
