// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'channel_detail_linked_object.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChannelDetailLinkedObject _$ChannelDetailLinkedObjectFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ChannelDetailLinkedObject', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'type']);
  final val = ChannelDetailLinkedObject(
    id: $checkedConvert('id', (v) => v as String?),
    type: $checkedConvert('type', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ChannelDetailLinkedObjectToJson(
  ChannelDetailLinkedObject instance,
) => <String, dynamic>{'id': instance.id, 'type': instance.type};
