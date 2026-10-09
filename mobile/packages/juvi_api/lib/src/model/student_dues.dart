//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:juvi_api/src/model/due_invoice_item.dart';
import 'package:juvi_api/src/model/due_invoice_item_next_due.dart';
import 'package:json_annotation/json_annotation.dart';

part 'student_dues.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudentDues {
  /// Returns a new [StudentDues] instance.
  StudentDues({

    required  this.available,

    required  this.invoices,

     this.lastPayment,

     this.payUrl,

    required  this.totalOutstanding,
  });

  @JsonKey(
    
    name: r'available',
    required: true,
    includeIfNull: false,
  )


  final bool available;



  @JsonKey(
    
    name: r'invoices',
    required: true,
    includeIfNull: false,
  )


  final List<DueInvoiceItem> invoices;



  @JsonKey(
    
    name: r'lastPayment',
    required: false,
    includeIfNull: false,
  )


  final DueInvoiceItemNextDue? lastPayment;



  @JsonKey(
    
    name: r'payUrl',
    required: false,
    includeIfNull: false,
  )


  final String? payUrl;



  @JsonKey(
    
    name: r'totalOutstanding',
    required: true,
    includeIfNull: false,
  )


  final int totalOutstanding;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudentDues &&
      other.available == available &&
      other.invoices == invoices &&
      other.lastPayment == lastPayment &&
      other.payUrl == payUrl &&
      other.totalOutstanding == totalOutstanding;

    @override
    int get hashCode =>
        available.hashCode +
        invoices.hashCode +
        lastPayment.hashCode +
        payUrl.hashCode +
        totalOutstanding.hashCode;

  factory StudentDues.fromJson(Map<String, dynamic> json) => _$StudentDuesFromJson(json);

  Map<String, dynamic> toJson() => _$StudentDuesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

