// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInRequest _$SignInRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInRequest', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['collegeId', 'device', 'identifier', 'password'],
      );
      final val = SignInRequest(
        collegeId: $checkedConvert('collegeId', (v) => v as String),
        device: $checkedConvert(
          'device',
          (v) => SignInRequestDevice.fromJson(v as Map<String, dynamic>),
        ),
        identifier: $checkedConvert('identifier', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SignInRequestToJson(SignInRequest instance) =>
    <String, dynamic>{
      'collegeId': instance.collegeId,
      'device': instance.device.toJson(),
      'identifier': instance.identifier,
      'password': instance.password,
    };
