import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/app_localizations_en.dart';
import 'package:juvi/core/push/notice_push.dart';

import 'push_fixtures.dart';

void main() {
  final l = AppLocalizationsEn();

  group('NoticePush.tryParse', () {
    test('reads every field of the backend payload (strings only)', () {
      final p = NoticePush.tryParse(pushData())!;
      expect(p.deliveryId, 'd00000000000000000000001');
      expect(p.receipt, 'sig.1760000000');
      expect(p.noticeId, '66f1c0ffee0000000000abcd');
      expect(p.tier, 'important');
      expect(p.groupKey, 'notice:66f1c0ffee0000000000abcd');
      expect(p.office, 'Exam Section');
      expect(p.title, 'Hall tickets are out');
      expect(p.variant, 'published');
      expect(p.count, 1);
      expect(p.location, '/notices/66f1c0ffee0000000000abcd');
    });

    test('a noticeId that is not 24 hex characters is refused (it becomes a route)', () {
      for (final bad in ['x/reach', '../x', '${'a' * 24}?q=1', 'n1', ('a' * 23), '']) {
        expect(NoticePush.tryParse({...pushData(), 'noticeId': bad}), isNull, reason: bad);
      }
    });

    test('a confidential notice has no title', () {
      expect(NoticePush.tryParse(pushData(title: null))!.title, isNull);
    });

    test('a Routine batch opens the attention sheet', () {
      final p = NoticePush.tryParse(pushData(tier: 'routine', count: '3', title: null))!;
      expect(p.isDigest, isTrue);
      expect(p.location, '/attention');
    });

    test('anything that is not a well-formed notice push is ignored', () {
      expect(NoticePush.tryParse({...pushData(), 'kind': 'post'}), isNull);
      expect(NoticePush.tryParse({...pushData(), 'tier': 'loud'}), isNull);
      expect(NoticePush.tryParse(Map.of(pushData())..remove('receipt')), isNull);
      expect(NoticePush.tryParse(const {}), isNull);
    });

    test('the local-notification payload round-trips', () {
      final p = NoticePush.tryParse(pushData(title: null, variant: 'reminder'))!;
      final back = NoticePush.fromPayload(p.toPayload())!;
      expect(back.deliveryId, p.deliveryId);
      expect(back.receipt, p.receipt);
      expect(back.variant, 'reminder');
      expect(back.title, isNull);
      expect(NoticePush.fromPayload('not json'), isNull);
      expect(NoticePush.fromPayload(null), isNull);
    });
  });

  group('trayContent matches the portal tray preview', () {
    test('published: office, then title', () {
      expect(trayContent(NoticePush.tryParse(pushData())!), const TrayContent('Exam Section', 'Hall tickets are out'));
    });
    test('published, confidential: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(title: null))!), TrayContent(l.pushNewNoticeFrom('Exam Section')));
    });
    test('reminder: office, then "Reminder: <title>"', () {
      expect(trayContent(NoticePush.tryParse(pushData(variant: 'reminder'))!), TrayContent('Exam Section', l.pushReminderTitle('Hall tickets are out')));
    });
    test('reminder, confidential: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(variant: 'reminder', title: null))!), TrayContent(l.pushReminderFrom('Exam Section')));
    });
    test('Routine batch of 3: one line', () {
      expect(trayContent(NoticePush.tryParse(pushData(tier: 'routine', count: '3', title: null))!), TrayContent(l.pushDigest(3, 'Exam Section')));
    });
    test('Routine batch of 1 renders like Published', () {
      expect(trayContent(NoticePush.tryParse(pushData(tier: 'routine'))!), const TrayContent('Exam Section', 'Hall tickets are out'));
    });
  });

  group('channels', () {
    test('tier picks the channel; a reminder is always Important', () {
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'urgent'))!).id, 'juvi_urgent');
      expect(channelFor(NoticePush.tryParse(pushData())!).id, 'juvi_important');
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'routine'))!).id, 'juvi_routine');
      expect(channelFor(NoticePush.tryParse(pushData(tier: 'urgent', variant: 'reminder'))!).id, 'juvi_important');
    });
    test('importance and sound per tier; names mirror the arb', () {
      expect([for (final c in pushChannels) (c.id, c.importance, c.sound)], [
        ('juvi_urgent', 'max', true),
        ('juvi_important', 'high', true),
        ('juvi_routine', 'low', false),
      ]);
      expect([for (final c in pushChannels) c.name], [l.pushChannelUrgent, l.pushChannelImportant, l.pushChannelRoutine]);
      expect([for (final c in pushChannels) c.description], [l.settingsTierUrgentDesc, l.settingsTierImportantDesc, l.settingsTierRoutineDesc]);
    });
  });

  test('notification ids are stable per delivery and per group', () {
    final a = NoticePush.tryParse(pushData())!;
    final again = NoticePush.tryParse(pushData())!;
    final other = NoticePush.tryParse(pushData(deliveryId: 'd00000000000000000000002'))!;
    expect(notificationIdFor(a), notificationIdFor(again));
    expect(notificationIdFor(a), isNot(notificationIdFor(other)));
    expect(summaryIdFor(a), summaryIdFor(other));
    expect(notificationIdFor(a), inInclusiveRange(0, 0x7fffffff));
  });
}
