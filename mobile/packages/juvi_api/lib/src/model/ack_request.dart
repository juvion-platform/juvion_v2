//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'ack_request.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AckRequest {
  /// Returns a new [AckRequest] instance.
  AckRequest({

     this.clientAt,

     this.comment,

    required  this.method,

     this.offline = false,
  });

  @JsonKey(
    
    name: r'clientAt',
    required: false,
    includeIfNull: false,
  )


  final DateTime? clientAt;



  @JsonKey(
    
    name: r'comment',
    required: false,
    includeIfNull: false,
  )


  final String? comment;



  @JsonKey(
    
    name: r'method',
    required: true,
    includeIfNull: false,
  )


  final AckRequestMethodEnum method;



  @JsonKey(
    defaultValue: false,
    name: r'offline',
    required: false,
    includeIfNull: false,
  )


  final bool? offline;





    @override
    bool operator ==(Object other) => identical(this, other) || other is AckRequest &&
      other.clientAt == clientAt &&
      other.comment == comment &&
      other.method == method &&
      other.offline == offline;

    @override
    int get hashCode =>
        clientAt.hashCode +
        comment.hashCode +
        method.hashCode +
        offline.hashCode;

  factory AckRequest.fromJson(Map<String, dynamic> json) => _$AckRequestFromJson(json);

  Map<String, dynamic> toJson() => _$AckRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}


enum AckRequestMethodEnum {
@JsonValue(r'hold')
hold(r'hold'),
@JsonValue(r'confirm')
confirm(r'confirm');

const AckRequestMethodEnum(this.value);

final String value;

@override
String toString() => value;
}


