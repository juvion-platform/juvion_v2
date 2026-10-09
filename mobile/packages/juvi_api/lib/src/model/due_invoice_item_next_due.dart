//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'due_invoice_item_next_due.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DueInvoiceItemNextDue {
  /// Returns a new [DueInvoiceItemNextDue] instance.
  DueInvoiceItemNextDue({

    required  this.amount,

    required  this.date,
  });

  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final int amount;



  @JsonKey(
    
    name: r'date',
    required: true,
    includeIfNull: false,
  )


  final String date;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DueInvoiceItemNextDue &&
      other.amount == amount &&
      other.date == date;

    @override
    int get hashCode =>
        amount.hashCode +
        date.hashCode;

  factory DueInvoiceItemNextDue.fromJson(Map<String, dynamic> json) => _$DueInvoiceItemNextDueFromJson(json);

  Map<String, dynamic> toJson() => _$DueInvoiceItemNextDueToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

