import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/shared/format.dart';

/// A ring that depletes from full (just published) to empty (the deadline), with the
/// time left in the centre; empty and red once the deadline has passed (spec §9).
class DeadlineRing extends StatelessWidget {
  const DeadlineRing({required this.deadline, this.start, this.now, this.size = 40, super.key});
  final DateTime deadline;

  /// When the window opened (the notice's `publishedAt`); without it the ring starts full.
  final DateTime? start;

  /// The current time; injectable so tests and goldens are deterministic.
  final DateTime? now;
  final double size;

  /// The share of the window still left, from 1 down to 0; 0 once the deadline has passed.
  static double remaining({required DateTime deadline, required DateTime now, DateTime? start}) {
    if (!now.isBefore(deadline)) return 0;
    final total = deadline.difference(start ?? now).inSeconds;
    if (total <= 0) return 1;
    return (deadline.difference(now).inSeconds / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final at = now ?? DateTime.now();
    final overdue = !at.isBefore(deadline);
    final left = deadline.difference(at);
    final centre = overdue
        ? '!'
        : left.inDays >= 1
            ? l.deadlineDaysShort(left.inDays)
            : left.inHours >= 1
                ? l.deadlineHoursShort(left.inHours)
                : l.deadlineMinutesShort(math.max(1, left.inMinutes));
    return Semantics(
      label: overdue ? l.deadlinePassed(dayMonthTime(deadline)) : l.deadlineDueBy(dayMonthTime(deadline)),
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _RingPainter(
            fraction: remaining(deadline: deadline, now: at, start: start),
            track: overdue ? scheme.error : scheme.outlineVariant,
            arc: scheme.primary,
          ),
          child: Center(
            child: Text(
              centre,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: overdue ? scheme.error : scheme.onSurface,
                  ),
              textScaler: TextScaler.noScaling,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.track, required this.arc});
  final double fraction;
  final Color track;
  final Color arc;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 4.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);
    if (fraction > 0) canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * fraction, false, paint..color = arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction || old.track != track || old.arc != arc;
}
