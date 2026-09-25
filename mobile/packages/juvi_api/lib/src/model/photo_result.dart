//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'photo_result.g.dart';


@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PhotoResult {
  /// Returns a new [PhotoResult] instance.
  PhotoResult({

    required  this.photoUrl,
  });

  @JsonKey(
    
    name: r'photoUrl',
    required: true,
    includeIfNull: true,
  )


  final String? photoUrl;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PhotoResult &&
      other.photoUrl == photoUrl;

    @override
    int get hashCode =>
        (photoUrl == null ? 0 : photoUrl.hashCode);

  factory PhotoResult.fromJson(Map<String, dynamic> json) => _$PhotoResultFromJson(json);

  Map<String, dynamic> toJson() => _$PhotoResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

