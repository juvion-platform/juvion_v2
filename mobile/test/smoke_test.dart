import 'package:flutter_test/flutter_test.dart';
import 'package:juvi_api/juvi_api.dart';

void main() {
  test('generated client exposes MobileApi', () {
    final api = JuviApi(basePathOverride: 'http://localhost:3003/api/juvi-app/v1');
    expect(api.getMobileApi(), isA<MobileApi>());
  });
}
