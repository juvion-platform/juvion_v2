// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ack_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AckRequest _$AckRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AckRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['method']);
      final val = AckRequest(
        clientAt: $checkedConvert(
          'clientAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        comment: $checkedConvert('comment', (v) => v as String?),
        method: $checkedConvert(
          'method',
          (v) => $enumDecode(_$AckRequestMethodEnumEnumMap, v),
        ),
        offline: $checkedConvert('offline', (v) => v as bool? ?? false),
      );
      return val;
    });

Map<String, dynamic> _$AckRequestToJson(AckRequest instance) =>
    <String, dynamic>{
      'clientAt': ?instance.clientAt?.toIso8601String(),
      'comment': ?instance.comment,
      'method': _$AckRequestMethodEnumEnumMap[instance.method]!,
      'offline': ?instance.offline,
    };

const _$AckRequestMethodEnumEnumMap = {
  AckRequestMethodEnum.hold: 'hold',
  AckRequestMethodEnum.confirm: 'confirm',
};
