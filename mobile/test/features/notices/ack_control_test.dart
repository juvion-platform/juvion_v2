import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/core/models/notices.dart';
import 'package:juvi/features/notices/widgets/ack_control.dart';

import 'host.dart';

void main() {
  late List<AckMethod> acks;
  setUp(() => acks = []);

  Widget control({bool a11y = false, bool busy = false, double textScale = 1}) =>
      noticeHost(AckControl(onAcknowledge: acks.add, busy: busy), accessibleNavigation: a11y, textScale: textScale);

  Finder dialogButton(String label) => find.descendant(of: find.byType(AlertDialog), matching: find.text(label));

  testWidgets('a 1.2 s hold acknowledges with method hold, and no dialog opens', (t) async {
    await t.pumpWidget(control());
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    // The host is a ListView, so the press is recognised after kPressTimeout (100 ms)
    // and the ring starts filling on the next frame.
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 1100));
    expect(acks, isEmpty);
    await t.pump(const Duration(milliseconds: 150));
    expect(acks, [AckMethod.hold]);
    await g.up();
    await t.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(acks, [AckMethod.hold]);
  });

  testWidgets('releasing early does not acknowledge; it offers the confirmation, and Cancel keeps it unacknowledged', (t) async {
    await t.pumpWidget(control());
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 150));
    await t.pump(const Duration(milliseconds: 600));
    await g.up();
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    expect(find.text('Acknowledge this notice?'), findsOneWidget);
    await t.tap(dialogButton('Cancel'));
    await t.pumpAndSettle();
    expect(acks, isEmpty);
  });

  testWidgets('tap then confirm acknowledges with method confirm', (t) async {
    await t.pumpWidget(control());
    await t.tap(find.byType(AckControl));
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    await t.tap(dialogButton('Acknowledge'));
    await t.pumpAndSettle();
    expect(acks, [AckMethod.confirm]);
  });

  testWidgets('under a screen reader a hold never acknowledges; only the confirm path does', (t) async {
    await t.pumpWidget(control(a11y: true));
    expect(find.text('Hold to acknowledge'), findsNothing);
    final g = await t.startGesture(t.getCenter(find.widgetWithText(FilledButton, 'Acknowledge')));
    await t.pump();
    await t.pump(const Duration(milliseconds: 1500));
    expect(acks, isEmpty);
    await g.up();
    await t.pumpAndSettle();
    expect(acks, isEmpty);
    await t.tap(dialogButton('Acknowledge'));
    await t.pumpAndSettle();
    expect(acks, [AckMethod.confirm]);
  });

  testWidgets('the hold control exposes a button whose semantic tap opens the confirmation', (t) async {
    final semantics = t.ensureSemantics();
    await t.pumpWidget(control());
    expect(
      t.getSemantics(find.byType(AckControl)),
      matchesSemantics(label: 'Hold to acknowledge', hint: 'Opens a confirmation', isButton: true, hasTapAction: true),
    );
    semantics.dispose();
  });

  testWidgets('busy shows progress and ignores a hold', (t) async {
    await t.pumpWidget(control(busy: true));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final g = await t.startGesture(t.getCenter(find.byType(AckControl)));
    await t.pump();
    await t.pump(const Duration(milliseconds: 1500));
    await g.up();
    await t.pump();
    expect(acks, isEmpty);
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('text scale 2.0 lays out without overflow and keeps a 44 pt target', (t) async {
    await t.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => t.binding.setSurfaceSize(null));
    await t.pumpWidget(control(textScale: 2));
    expect(t.takeException(), isNull);
    expect(t.getSize(find.byType(AckControl)).height, greaterThanOrEqualTo(44));
  });
}
