// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'devices.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Devices _$DevicesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Devices', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items']);
      final val = Devices(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => DevicesItemsInner.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DevicesToJson(Devices instance) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
};
