//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'error_envelope_error_ack.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ErrorEnvelopeErrorAck {
  /// Returns a new [ErrorEnvelopeErrorAck] instance.
  ErrorEnvelopeErrorAck({

    required  this.ackAt,

    required  this.clientAt,

    required  this.comment,

    required  this.late_,

    required  this.method,

    required  this.offline,
  });

  @JsonKey(
    
    name: r'ackAt',
    required: true,
    includeIfNull: false,
  )


  final String ackAt;



  @JsonKey(
    
    name: r'clientAt',
    required: true,
    includeIfNull: true,
  )


  final String? clientAt;



  @JsonKey(
    
    name: r'comment',
    required: true,
    includeIfNull: true,
  )


  final String? comment;



  @JsonKey(
    
    name: r'late',
    required: true,
    includeIfNull: false,
  )


  final bool late_;



  @JsonKey(
    
    name: r'method',
    required: true,
    includeIfNull: false,
  )


  final ErrorEnvelopeErrorAckMethodEnum method;



  @JsonKey(
    
    name: r'offline',
    required: true,
    includeIfNull: false,
  )


  final bool offline;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ErrorEnvelopeErrorAck &&
      other.ackAt == ackAt &&
      other.clientAt == clientAt &&
      other.comment == comment &&
      other.late_ == late_ &&
      other.method == method &&
      other.offline == offline;

    @override
    int get hashCode =>
        ackAt.hashCode +
        (clientAt == null ? 0 : clientAt.hashCode) +
        (comment == null ? 0 : comment.hashCode) +
        late_.hashCode +
        method.hashCode +
        offline.hashCode;

  factory ErrorEnvelopeErrorAck.fromJson(Map<String, dynamic> json) => _$ErrorEnvelopeErrorAckFromJson(json);

  Map<String, dynamic> toJson() => _$ErrorEnvelopeErrorAckToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum ErrorEnvelopeErrorAckMethodEnum {
@JsonValue(r'hold')
hold(r'hold'),
@JsonValue(r'confirm')
confirm(r'confirm');

const ErrorEnvelopeErrorAckMethodEnum(this.value);

final String value;

@override
String toString() => value;
}


