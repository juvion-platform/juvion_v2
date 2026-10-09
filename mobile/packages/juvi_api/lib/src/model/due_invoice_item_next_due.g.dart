// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'due_invoice_item_next_due.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DueInvoiceItemNextDue _$DueInvoiceItemNextDueFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DueInvoiceItemNextDue', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['amount', 'date']);
  final val = DueInvoiceItemNextDue(
    amount: $checkedConvert('amount', (v) => (v as num).toInt()),
    date: $checkedConvert('date', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$DueInvoiceItemNextDueToJson(
  DueInvoiceItemNextDue instance,
) => <String, dynamic>{'amount': instance.amount, 'date': instance.date};
