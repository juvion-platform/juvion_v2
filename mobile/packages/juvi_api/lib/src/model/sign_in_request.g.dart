// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sign_in_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SignInRequest _$SignInRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['device', 'juviId', 'password']);
      final val = SignInRequest(
        device: $checkedConvert(
          'device',
          (v) => SignInRequestDevice.fromJson(v as Map<String, dynamic>),
        ),
        juviId: $checkedConvert('juviId', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SignInRequestToJson(SignInRequest instance) =>
    <String, dynamic>{
      'device': instance.device.toJson(),
      'juviId': instance.juviId,
      'password': instance.password,
    };
