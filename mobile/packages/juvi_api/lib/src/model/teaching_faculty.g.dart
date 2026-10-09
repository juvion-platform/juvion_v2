// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teaching_faculty.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TeachingFaculty _$TeachingFacultyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TeachingFaculty', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['kind']);
      final val = TeachingFaculty(
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(_$TeachingFacultyKindEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TeachingFacultyToJson(TeachingFaculty instance) =>
    <String, dynamic>{'kind': _$TeachingFacultyKindEnumEnumMap[instance.kind]!};

const _$TeachingFacultyKindEnumEnumMap = {
  TeachingFacultyKindEnum.regular: 'regular',
  TeachingFacultyKindEnum.hod: 'hod',
  TeachingFacultyKindEnum.adjunct: 'adjunct',
};
