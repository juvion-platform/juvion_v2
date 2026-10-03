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
