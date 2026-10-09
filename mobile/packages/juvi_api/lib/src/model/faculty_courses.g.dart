// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'faculty_courses.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FacultyCourses _$FacultyCoursesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FacultyCourses', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['coursesTaught']);
      final val = FacultyCourses(
        coursesTaught: $checkedConvert(
          'coursesTaught',
          (v) => (v as List<dynamic>)
              .map((e) => CoursesTaughtItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FacultyCoursesToJson(FacultyCourses instance) =>
    <String, dynamic>{
      'coursesTaught': instance.coursesTaught.map((e) => e.toJson()).toList(),
    };
