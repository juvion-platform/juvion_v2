// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'due_invoice_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DueInvoiceItem _$DueInvoiceItemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DueInvoiceItem', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'nextDue',
          'number',
          'outstanding',
          'overdue',
          'type',
        ],
      );
      final val = DueInvoiceItem(
        nextDue: $checkedConvert(
          'nextDue',
          (v) => DueInvoiceItemNextDue.fromJson(v as Map<String, dynamic>),
        ),
        number: $checkedConvert('number', (v) => v as String),
        outstanding: $checkedConvert('outstanding', (v) => (v as num).toInt()),
        overdue: $checkedConvert('overdue', (v) => v as bool),
        type: $checkedConvert('type', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DueInvoiceItemToJson(DueInvoiceItem instance) =>
    <String, dynamic>{
      'nextDue': instance.nextDue.toJson(),
      'number': instance.number,
      'outstanding': instance.outstanding,
      'overdue': instance.overdue,
      'type': instance.type,
    };
