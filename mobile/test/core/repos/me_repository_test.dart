import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/models.dart';

const Map<String, dynamic> meJson = {
  'account': {
    'id': 'a',
    'kind': 'student',
    'status': 'onboarding',
    'onboardingStep': 0,
    'onboardingSteps': ['identity', 'spaces', 'notifications'],
    'onboardingComplete': false,
    'mustChangePassword': false,
  },
  'person': {'name': 'Aditya Nair', 'firstName': 'Aditya', 'photoUrl': null},
  'student': {
    'rollNumber': '24JIT0001',
    'programme': 'B.Tech',
    'branch': 'CSE',
    'batch': '2024 Batch',
    'section': 'A',
    'department': 'Computer Science',
    'hostel': null,
    'isLateralEntry': false,
  },
  'faculty': null,
  'settings': {
    'quietHours': {'start': '22:00', 'end': '07:00'},
    'tiers': {'important': true, 'routine': true},
    'language': 'en',
  },
  'institution': {'name': 'JIT', 'code': 'JIT', 'logoUrl': null, 'accentColor': '#0B5FA5', 'supportContact': {'name': 'Office'}, 'timezone': 'Asia/Kolkata'},
  'asOf': '2026-09-23T08:14:00+05:30',
};

void main() {
  test('Me parses the /me payload, including nulls', () {
    final me = Me.fromJson(meJson);
    expect(me.person.firstName, 'Aditya');
    expect(me.student?.section, 'A');
    expect(me.faculty, isNull);
    expect(me.settings.tiers.routine, isTrue);
    expect(me.institution.supportContact?.name, 'Office');
    expect(me.toJson()['student'], isA<Map<String, dynamic>>());
  });
}
