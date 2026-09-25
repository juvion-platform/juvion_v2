// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'photo_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PhotoResult _$PhotoResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PhotoResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['photoUrl']);
      final val = PhotoResult(
        photoUrl: $checkedConvert('photoUrl', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$PhotoResultToJson(PhotoResult instance) =>
    <String, dynamic>{'photoUrl': instance.photoUrl};
