import 'package:juvi/core/push/local_notifications.dart';
import 'package:juvi/core/push/notice_push.dart';
import 'package:juvi/core/push/notification_permission.dart';

/// The FCM data message the backend builds (`backend/src/modules/juvi-app/notifications/payload.ts`):
/// every value a string, and no `title` key at all for a confidential notice or a batch.
Map<String, dynamic> pushData({
  String deliveryId = 'd00000000000000000000001',
  String tier = 'important',
  String variant = 'published',
  String count = '1',
  String? title = 'Hall tickets are out',
}) => {
  'deliveryId': deliveryId,
  'receipt': 'sig.1760000000',
  'kind': 'notice',
  'noticeId': 'n00000000000000000000001',
  'tier': tier,
  'groupKey': 'notice:n00000000000000000000001',
  'office': 'Exam Section',
  'variant': variant,
  'count': count,
  'title': ?title,
};

/// The OS permission, answered by the test: [granted] now, and what a prompt would return.
class FakeNotificationPermission implements NotificationPermission {
  FakeNotificationPermission({this.granted = false, this.grantOnRequest = true});
  bool granted;
  final bool grantOnRequest;
  int requests = 0;
  int settingsOpened = 0;
  @override
  Future<bool> isGranted() async => granted;
  @override
  Future<bool> request() async {
    requests++;
    return granted = grantOnRequest;
  }

  @override
  Future<void> openSettings() async => settingsOpened++;
}

/// Records what would have reached the tray.
class FakeLocalNotifications implements LocalNotifications {
  final shown = <NoticePush>[];
  String? launch;
  void Function(String? payload)? onTap;
  @override
  Future<void> init({void Function(String? payload)? onTap}) async => this.onTap = onTap;
  @override
  Future<void> show(NoticePush p) async => shown.add(p);
  @override
  Future<String?> launchPayload() async => launch;
}
