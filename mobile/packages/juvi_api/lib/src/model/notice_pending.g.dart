// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notice_pending.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NoticePending _$NoticePendingFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NoticePending', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['groups', 'items', 'nextCursor', 'total'],
      );
      final val = NoticePending(
        groups: $checkedConvert(
          'groups',
          (v) => (v as List<dynamic>)
              .map(
                (e) => NoticePendingGroupsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    NoticePendingItemsInner.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
        total: $checkedConvert('total', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$NoticePendingToJson(NoticePending instance) =>
    <String, dynamic>{
      'groups': instance.groups.map((e) => e.toJson()).toList(),
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
      'total': instance.total,
    };
